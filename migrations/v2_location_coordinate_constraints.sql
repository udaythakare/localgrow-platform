-- Migration: Add coordinate range validation constraints to public.business_locations
-- Sprint: Sprint 1B (Location Data Integrity)
--
-- Adds database-level coordinate range validation:
-- - Latitude: -90 to +90 (or NULL)
-- - Longitude: -180 to +180 (or NULL)
--
-- Safety:
-- - NULL values are explicitly allowed because valid records may have missing coordinates.
-- - Checks if constraints already exist to avoid duplicate constraint errors.
-- - Does not drop or recreate existing constraints.
-- - Does not alter existing rows, geom values, triggers, or indexes.

DO $$
BEGIN
    -- Add latitude range check constraint if it does not already exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'business_locations_latitude_range_check'
          AND conrelid = 'public.business_locations'::regclass
    ) THEN
        ALTER TABLE public.business_locations
            ADD CONSTRAINT business_locations_latitude_range_check
            CHECK (
                latitude IS NULL
                OR latitude BETWEEN -90 AND 90
            );
    END IF;

    -- Add longitude range check constraint if it does not already exist
    IF NOT EXISTS (
        SELECT 1
        FROM pg_constraint
        WHERE conname = 'business_locations_longitude_range_check'
          AND conrelid = 'public.business_locations'::regclass
    ) THEN
        ALTER TABLE public.business_locations
            ADD CONSTRAINT business_locations_longitude_range_check
            CHECK (
                longitude IS NULL
                OR longitude BETWEEN -180 AND 180
            );
    END IF;
END $$;
