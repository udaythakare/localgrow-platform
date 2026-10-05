-- Migration: Customer Reviews & Ratings Table
-- Sprint: Sprint 10, Stage 1 (Customer Reviews Database Migration)
--
-- Summary:
-- 1. Creates public.business_reviews table with:
--    - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
--    - business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE
--    - user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE
--    - rating SMALLINT NOT NULL (1 to 5 stars)
--    - comment VARCHAR(1000) (optional customer feedback, max 1000 characters)
--    - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
--    - updated_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- 2. Enforces integrity constraints:
--    - UNIQUE(business_id, user_id): One review per customer per business (enables edit/update)
--    - CHECK (rating BETWEEN 1 AND 5): Restricts star rating to valid integers 1 to 5
--    - CHECK (comment IS NULL OR char_length(comment) <= 1000): Enforces comment length limit
-- 3. Adds performance indexes:
--    - (business_id, created_at DESC): Fast business review listing in chronological order
--    - (user_id): Fast customer review lookup and profile queries
-- 4. Registers updated_at trigger using existing public.update_updated_at_column() function
--
-- Safety & Idempotency:
-- - Uses CREATE TABLE IF NOT EXISTS and CREATE INDEX IF NOT EXISTS.
-- - Drops and recreates the update trigger safely.
-- - Preserves existing V1/V2 database schema, tables, and records without modifications.
-- - Strictly zero mock or hardcoded business review data.

-- Step 1: Create public.business_reviews table
CREATE TABLE IF NOT EXISTS public.business_reviews (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    user_id UUID NOT NULL REFERENCES public.users(id) ON DELETE CASCADE,
    rating SMALLINT NOT NULL,
    comment VARCHAR(1000),
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT uq_business_reviews_business_user UNIQUE (business_id, user_id),
    CONSTRAINT chk_business_reviews_rating_range CHECK (rating >= 1 AND rating <= 5),
    CONSTRAINT chk_business_reviews_comment_length CHECK (comment IS NULL OR char_length(comment) <= 1000)
);

-- Step 2: Enable Row-Level Security (RLS)
-- Server-side access:
-- - Next.js server actions/handlers use supabaseAdmin (service_role), which has BYPASSRLS.
-- - Spring Boot connects over JDBC as postgres, which has BYPASSRLS.
-- - Client-side access via anon/authenticated key is blocked by default until explicit policies are added.
ALTER TABLE public.business_reviews ENABLE ROW LEVEL SECURITY;

-- Step 3: Index for listing business reviews by creation date (newest first)
CREATE INDEX IF NOT EXISTS idx_business_reviews_business_created
    ON public.business_reviews (business_id, created_at DESC);

-- Step 4: Index for customer review lookup
CREATE INDEX IF NOT EXISTS idx_business_reviews_user_id
    ON public.business_reviews (user_id);

-- Step 5: Trigger for automatic updated_at maintenance
DROP TRIGGER IF EXISTS trg_business_reviews_updated_at ON public.business_reviews;
CREATE TRIGGER trg_business_reviews_updated_at
    BEFORE UPDATE ON public.business_reviews
    FOR EACH ROW
    EXECUTE FUNCTION public.update_updated_at_column();

