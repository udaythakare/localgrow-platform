-- Migration: Harden Operating Hours RPC Security and Privileges
-- Sprint: Sprint 7B (Vendor Operating Hours Management - Hardening)
--
-- Description:
-- 1. Sets a fixed, safe search_path (public, pg_temp) on public.save_vendor_operating_hours().
-- 2. Revokes EXECUTE privileges from PUBLIC, anon, and authenticated roles.
-- 3. Ensures EXECUTE is granted exclusively to service_role (for server-side Next.js route invocation).
-- 4. Preserves SECURITY INVOKER execution mode and existing business logic.

CREATE OR REPLACE FUNCTION public.save_vendor_operating_hours(
    p_location_id UUID,
    p_timezone VARCHAR,
    p_schedule JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
SET search_path = public, pg_temp
AS $$
BEGIN
    -- 1. Update location timezone
    UPDATE public.business_locations
    SET timezone = p_timezone
    WHERE id = p_location_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Location % not found', p_location_id;
    END IF;

    -- 2. Clear existing schedule entries for this location
    DELETE FROM public.business_hours
    WHERE location_id = p_location_id;

    -- 3. Insert the new complete weekly schedule
    INSERT INTO public.business_hours (
        location_id,
        day_of_week,
        open_time,
        close_time,
        is_closed,
        is_24_hours
    )
    SELECT
        p_location_id,
        (item->>'dayOfWeek')::SMALLINT,
        (item->>'openTime')::TIME,
        (item->>'closeTime')::TIME,
        COALESCE((item->>'isClosed')::BOOLEAN, false),
        COALESCE((item->>'is24Hours')::BOOLEAN, false)
    FROM jsonb_array_elements(p_schedule) AS item;

END;
$$;

-- Restrict execution: Revoke from PUBLIC, anon, and authenticated; grant strictly to service_role
REVOKE ALL ON FUNCTION public.save_vendor_operating_hours(UUID, VARCHAR, JSONB) FROM PUBLIC;
REVOKE ALL ON FUNCTION public.save_vendor_operating_hours(UUID, VARCHAR, JSONB) FROM anon;
REVOKE ALL ON FUNCTION public.save_vendor_operating_hours(UUID, VARCHAR, JSONB) FROM authenticated;
GRANT EXECUTE ON FUNCTION public.save_vendor_operating_hours(UUID, VARCHAR, JSONB) TO service_role;
