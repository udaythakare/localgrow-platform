-- Migration: Atomic Email Verification Token Consumption
-- File: migrations/v3_atomic_email_verification.sql
-- Target: public.user_tokens, public.user_roles
--
-- Context:
--   The verify-email route currently makes two separate UPDATE calls:
--     1. UPDATE user_tokens SET used = true WHERE id = ? AND used = false
--     2. UPDATE user_roles SET is_verified = true WHERE user_id = ?
--
--   Between those two statements, a concurrent request can slip through the
--   used=false guard and also succeed. This migration installs a single
--   SECURITY DEFINER stored procedure that:
--
--     a. Locks the target user_tokens row with SELECT FOR UPDATE (advisory
--        row-level lock that blocks concurrent transactions on the same row).
--     b. Re-checks used, expiry, and type inside the same transaction.
--     c. Marks the token used AND sets user_roles.is_verified = true atomically
--        before returning to the caller.
--
--   The function returns a text status code matched by the application:
--     'ok'      — token valid; account activated
--     'used'    — token was already consumed (concurrent or replay)
--     'expired' — token exists but past expires_at
--     'invalid' — token not found or wrong type
--
--   SECURITY DEFINER is required so the function runs as the postgres/owner
--   role (bypassing RLS) regardless of who calls it via supabaseAdmin
--   (service_role already bypasses RLS, but the explicit DEFINER makes the
--   intent explicit and keeps the function safe to GRANT to other roles later).
--
-- Dependencies:
--   public.user_tokens (id, token text, user_id uuid, type text, used bool, expires_at timestamptz)
--   public.user_roles  (user_id uuid, role text, is_verified bool)
--
-- No table schema changes. No data modifications.
-- Adds one UNIQUE index on user_tokens(token) to convert the lookup from a
-- sequential scan to an O(log n) index scan.
--
-- Idempotency: uses CREATE OR REPLACE FUNCTION and IF NOT EXISTS for the index.
--
-- IMPORTANT: This migration must be reviewed and applied manually via the
-- Supabase dashboard or CLI. Do NOT execute it as part of automated deploys
-- without a human approval step.

BEGIN;

-- ============================================================================
-- Step 1: Add UNIQUE index on user_tokens(token)
--         Converts the SHA-256 hash lookup from O(n) to O(log n) and
--         provides an implicit uniqueness guarantee (hashes are unique by
--         construction, but the constraint makes it explicit).
-- ============================================================================

CREATE UNIQUE INDEX IF NOT EXISTS user_tokens_token_unique
    ON public.user_tokens (token);


-- ============================================================================
-- Step 2: Create atomic consume_verification_token() function
-- ============================================================================

CREATE OR REPLACE FUNCTION public.consume_verification_token(p_hashed_token TEXT)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER          -- runs as table owner; bypasses RLS
SET search_path = public  -- prevents search_path hijacking
AS $$
DECLARE
    v_token_id   UUID;
    v_user_id    UUID;
    v_used       BOOLEAN;
    v_expires_at TIMESTAMPTZ;
    v_type       TEXT;
BEGIN
    -- Lock the matching row for update (serialises concurrent requests for
    -- the same token; SKIP LOCKED would silently skip — we want to block).
    SELECT id, user_id, used, expires_at, type
      INTO v_token_id, v_user_id, v_used, v_expires_at, v_type
      FROM public.user_tokens
     WHERE token = p_hashed_token
       FOR UPDATE;           -- acquires row-level lock

    -- Token not found
    IF NOT FOUND THEN
        RETURN 'invalid';
    END IF;

    -- Wrong type (defensive — caller already filters, but guard here too)
    IF v_type <> 'verification' THEN
        RETURN 'invalid';
    END IF;

    -- Already consumed
    IF v_used THEN
        RETURN 'used';
    END IF;

    -- Expired
    IF v_expires_at < NOW() THEN
        RETURN 'expired';
    END IF;

    -- All checks passed: mark token used and set is_verified atomically
    UPDATE public.user_tokens
       SET used = TRUE
     WHERE id = v_token_id;

    UPDATE public.user_roles
       SET is_verified = TRUE
     WHERE user_id = v_user_id;

    RETURN 'ok';
END;
$$;

-- Restrict direct invocation: only service_role (used by supabaseAdmin) and
-- postgres (owner) may call this function. anon and authenticated cannot.
REVOKE ALL ON FUNCTION public.consume_verification_token(TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.consume_verification_token(TEXT) TO service_role;

-- ============================================================================
-- Step 3: Signal PostgREST to reload schema cache
-- ============================================================================

NOTIFY pgrst, 'reload schema';

COMMIT;


-- ============================================================================
-- Post-Migration Verification Queries (run manually to confirm)
-- ============================================================================
-- 1. Confirm index exists:
--    SELECT indexname, indexdef
--    FROM pg_indexes
--    WHERE tablename = 'user_tokens' AND indexname = 'user_tokens_token_unique';
--
-- 2. Confirm function exists with correct security:
--    SELECT routine_name, security_type
--    FROM information_schema.routines
--    WHERE routine_name = 'consume_verification_token'
--      AND routine_schema = 'public';
--
-- 3. Confirm anon cannot call the function:
--    SET ROLE anon;
--    SELECT public.consume_verification_token('0000000000000000000000000000000000000000000000000000000000000000');
--    -- Expected: permission denied
--    RESET ROLE;
