-- Migration: Atomic Operating Hours Persistence RPC
-- Sprint: Sprint 7B (Vendor Operating Hours Management)
--
-- Description:
-- Creates public.save_vendor_operating_hours() to atomically update a location's
-- timezone and replace its weekly operating schedule in a single transaction.
--
-- Security:
-- - Uses SECURITY INVOKER.
-- - Revoked from PUBLIC; granted to service_role for backend invocation only.
-- - Caller must validate business ownership and approved status prior to execution.

CREATE OR REPLACE FUNCTION public.save_vendor_operating_hours(
    p_location_id UUID,
    p_timezone VARCHAR,
    p_schedule JSONB
)
RETURNS VOID
LANGUAGE plpgsql
SECURITY INVOKER
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

-- Restrict execution to service_role (invoked via Next.js backend)
REVOKE ALL ON FUNCTION public.save_vendor_operating_hours(UUID, VARCHAR, JSONB) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.save_vendor_operating_hours(UUID, VARCHAR, JSONB) TO service_role;
