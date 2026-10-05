-- Migration: Business Branding & Photos (Logo and Gallery Support)
-- Sprint: Sprint 9 (Business Images & Branding)
--
-- Summary:
-- 1. Adds nullable 'logo_url' and 'logo_public_id' columns to public.businesses for store logo branding.
-- 2. Creates public.business_photos table for store gallery photos with:
--    - id UUID PRIMARY KEY DEFAULT gen_random_uuid()
--    - business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE
--    - image_url TEXT NOT NULL
--    - public_id TEXT (Cloudinary public ID for asset management and deletion)
--    - caption TEXT (optional photo caption)
--    - display_order INT NOT NULL DEFAULT 0
--    - created_at TIMESTAMPTZ NOT NULL DEFAULT now()
-- 3. Adds compound index on (business_id, display_order) for fast, ordered gallery retrieval.
--
-- Safety:
-- - Fully idempotent using IF NOT EXISTS and DO $$ BEGIN ... END $$ blocks.
-- - Existing rows in public.businesses remain intact with NULL logo columns.
-- - Cascade delete guarantees orphaned photos are cleaned up when a business is removed.

-- Step 1: Add logo_url and logo_public_id to public.businesses
DO $$
BEGIN
    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'logo_url'
    ) THEN
        ALTER TABLE public.businesses
            ADD COLUMN logo_url TEXT;
    END IF;

    IF NOT EXISTS (
        SELECT 1
        FROM information_schema.columns
        WHERE table_schema = 'public'
          AND table_name = 'businesses'
          AND column_name = 'logo_public_id'
    ) THEN
        ALTER TABLE public.businesses
            ADD COLUMN logo_public_id TEXT;
    END IF;
END $$;

-- Step 2: Create public.business_photos table
CREATE TABLE IF NOT EXISTS public.business_photos (
    id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    business_id UUID NOT NULL REFERENCES public.businesses(id) ON DELETE CASCADE,
    image_url TEXT NOT NULL,
    public_id TEXT,
    caption TEXT,
    display_order INT NOT NULL DEFAULT 0,
    created_at TIMESTAMPTZ NOT NULL DEFAULT now(),

    -- Constraints
    CONSTRAINT chk_business_photos_display_order_non_negative CHECK (display_order >= 0)
);

-- Step 3: Add index on (business_id, display_order) for ordered gallery queries
CREATE INDEX IF NOT EXISTS idx_business_photos_business_display_order
    ON public.business_photos (business_id, display_order, created_at ASC);
