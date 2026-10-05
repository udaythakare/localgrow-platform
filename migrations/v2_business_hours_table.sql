-- Migration: Location Operating Hours & Timezone Support
-- Sprint: Sprint 7A (Operating Hours: Database and Spring Boot Backend)
--
-- Summary:
-- 1. Adds 'timezone' column to public.business_locations defaulting existing rows to 'Asia/Kolkata'.
-- 2. Creates public.business_hours table referencing public.business_locations(id) with ON DELETE CASCADE.
-- 3. Enforces UNIQUE(location_id, day_of_week) where day_of_week is ISO-8601 (1 = Monday .. 7 = Sunday).
-- 4. Enforces data integrity check constraints:
--    - day_of_week BETWEEN 1 AND 7
--    - A schedule record cannot be simultaneously closed AND open 24 hours.
--    - When open (neither closed nor 24h), opening time and closing time must not be equal.
-- 5. Adds index on location_id for fast batch query lookups.
--
-- Safety:
-- - Fully idempotent using IF NOT EXISTS and DO $$ BEGIN ... END $$ blocks.
-- - Does not modify existing businesses, coupons, PostGIS geometries, or triggers.
-- - A location without records in public.business_hours represents unconfigured hours.

-- Step 1: Add timezone column to public.business_locations
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'business_locations'
          AND column_name = 'timezone'
    ) THEN
        ALTER TABLE public.business_locations
            ADD COLUMN timezone VARCHAR(50) NOT NULL DEFAULT 'Asia/Kolkata';
    END IF;
END $$;

-- Step 2: Create public.business_hours table
CREATE TABLE IF NOT EXISTS public.business_hours (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    location_id UUID NOT NULL REFERENCES public.business_locations(id) ON DELETE CASCADE,
    day_of_week SMALLINT NOT NULL,
    open_time TIME NOT NULL,
    close_time TIME NOT NULL,
    is_closed BOOLEAN NOT NULL DEFAULT false,
    is_24_hours BOOLEAN NOT NULL DEFAULT false,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT uq_business_hours_location_day UNIQUE (location_id, day_of_week),
    CONSTRAINT chk_business_hours_day_of_week CHECK (day_of_week BETWEEN 1 AND 7),
    CONSTRAINT chk_business_hours_not_both_closed_and_24h CHECK (NOT (is_closed = true AND is_24_hours = true)),
    CONSTRAINT chk_business_hours_open_close_not_equal CHECK (is_closed = true OR is_24_hours = true OR open_time <> close_time)
);

-- Step 3: Add index on location_id for batch loading
CREATE INDEX IF NOT EXISTS idx_business_hours_location_id ON public.business_hours (location_id);
