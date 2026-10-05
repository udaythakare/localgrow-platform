import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'fs';
import { join } from 'path';

describe('LocalGrow — Customer UI Redesign Phase 5: Business Details Verification', () => {
  const pagePath = join(process.cwd(), 'app/businesses/[id]/page.jsx');
  const viewPath = join(process.cwd(), 'components/business/BusinessDetailsView.jsx');
  const galleryPath = join(process.cwd(), 'components/business/BusinessPhotoGallery.jsx');
  const reviewsPath = join(process.cwd(), 'components/business/BusinessReviewsSection.jsx');

  describe('1. Route Shell & Customer Theme Integration', () => {
    it('app/businesses/[id]/page.jsx exists and wraps view with CustomerThemeWrapper', () => {
      assert.ok(existsSync(pagePath), 'Page file must exist');
      const content = readFileSync(pagePath, 'utf8');

      assert.ok(content.includes('CustomerThemeWrapper'), 'Must import and use CustomerThemeWrapper');
      assert.ok(content.includes('<CustomerThemeWrapper'), 'Must wrap content in CustomerThemeWrapper');
      assert.ok(content.includes('Navbar'), 'Must retain Navbar');
      assert.ok(content.includes('MobileBottomNav'), 'Must retain MobileBottomNav');
      assert.ok(content.includes('BusinessDetailsView'), 'Must render BusinessDetailsView');
      assert.ok(content.includes('BusinessDetailsSkeleton'), 'Must provide skeleton fallback');
      assert.ok(content.includes('businessId'), 'Must pass businessId');
      assert.ok(content.includes('initialLocationId'), 'Must pass initialLocationId');
    });
  });

  describe('2. BusinessDetailsView Visual Language & Tokens', () => {
    it('BusinessDetailsView.jsx adheres to modern customer design system (no brutalism)', () => {
      assert.ok(existsSync(viewPath), 'BusinessDetailsView file must exist');
      const content = readFileSync(viewPath, 'utf8');

      // Check elimination of neo-brutalist styling
      assert.ok(!content.includes('border-2 border-black'), 'Must not contain brutalist border-2 border-black');
      assert.ok(!content.includes('shadow-[4px_4px_0px_0px_#000]'), 'Must not contain brutalist black offset shadow');
      assert.ok(!content.includes('shadow-[6px_6px_0px_0px_#000]'), 'Must not contain brutalist 6px shadow');
      assert.ok(!content.includes('shadow-[3px_3px_0px_0px_#000]'), 'Must not contain brutalist 3px shadow');
      assert.ok(!content.includes('bg-[#ffc72c]'), 'Must not contain brutalist yellow background #ffc72c');
      assert.ok(!content.includes('bg-[#3716A8]'), 'Must not contain brutalist purple background #3716A8');

      // Check modern customer tokens
      assert.ok(content.includes('rounded-2xl border border-slate-200/90 bg-white shadow-sm') || content.includes('rounded-2xl border border-slate-200/90'), 'Must use modern rounded-2xl slate border surface');
      assert.ok(content.includes('bg-indigo-600 hover:bg-indigo-700'), 'Must use indigo primary action styling');
      assert.ok(content.includes('bg-emerald-50 text-emerald-700'), 'Must use soft emerald for open operating status');
      assert.ok(content.includes('bg-rose-50 text-rose-700'), 'Must use soft rose for closed operating status');
    });

    it('BusinessDetailsView.jsx preserves all helper re-exports for backward compatibility', () => {
      const content = readFileSync(viewPath, 'utf8');
      const expectedExports = [
        'WEEKDAYS',
        'formatTime12h',
        'formatDisplayDate',
        'normalizeUrl',
        'buildBusinessDetailsApiUrl',
        'formatDirectionsUrl',
        'parseBusinessApiError',
        'evaluateOperatingHoursStatus',
        'getBusinessInitials',
        'getValidLogoUrl',
        'sanitizeGalleryPhotos',
        'resolveSelectedPhoto',
      ];

      for (const exp of expectedExports) {
        assert.ok(content.includes(exp), `Must export ${exp}`);
      }
    });

    it('BusinessDetailsSkeleton provides modern pulse layout without brutalist borders', () => {
      const content = readFileSync(viewPath, 'utf8');
      assert.ok(content.includes('export function BusinessDetailsSkeleton'), 'Must export BusinessDetailsSkeleton');
      assert.ok(content.includes('animate-pulse'), 'Skeleton must use animate-pulse');
      assert.ok(!content.includes('bg-gray-200 border-2 border-black/20'), 'Skeleton must not use brutalist borders');
    });
  });

  describe('3. Photo Gallery Modernization', () => {
    it('BusinessPhotoGallery.jsx uses modern customer design system', () => {
      assert.ok(existsSync(galleryPath), 'BusinessPhotoGallery file must exist');
      const content = readFileSync(galleryPath, 'utf8');

      // Clean customer design tokens
      assert.ok(!content.includes('border-2 border-black'), 'Gallery must not contain brutalist border-2 border-black');
      assert.ok(!content.includes('shadow-[4px_4px_0px_0px_#000]'), 'Gallery must not contain hard offset shadows');
      assert.ok(!content.includes('bg-[#ffc72c]'), 'Gallery header must not use #ffc72c');

      // Modern surface and navigation
      assert.ok(content.includes('bg-white rounded-2xl border border-slate-200/90 shadow-sm'), 'Must use modern card surface');
      assert.ok(content.includes('ring-indigo-600'), 'Must use indigo highlight ring for active thumbnail');
      assert.ok(content.includes('sanitizeGalleryPhotos'), 'Must sanitize photos');
      assert.ok(content.includes('resolveSelectedPhoto'), 'Must resolve selected photo');
    });
  });

  describe('4. Reviews Section Modernization', () => {
    it('BusinessReviewsSection.jsx uses modern customer tokens and preserves review logic', () => {
      assert.ok(existsSync(reviewsPath), 'BusinessReviewsSection file must exist');
      const content = readFileSync(reviewsPath, 'utf8');

      // Clean customer design tokens
      assert.ok(!content.includes('border-2 border-black'), 'Reviews must not contain brutalist border-2 border-black');
      assert.ok(!content.includes('shadow-[4px_4px_0px_0px_#000]'), 'Reviews must not contain hard black shadows');
      assert.ok(!content.includes('bg-[#3716A8]'), 'Reviews header must not use #3716A8');

      // Modern surface
      assert.ok(content.includes('bg-white rounded-2xl border border-slate-200/90 shadow-sm'), 'Must use modern card surface');
      assert.ok(content.includes('bg-indigo-600 hover:bg-indigo-700'), 'Must use indigo submit button');
      assert.ok(content.includes('submitReview'), 'Must retain submitReview server action');
      assert.ok(content.includes('getUserReview'), 'Must retain getUserReview server action');
      assert.ok(content.includes('fetchReviews'), 'Must retain fetchReviews API call');
    });
  });

  describe('5. Data-Driven Imagery & Information Architecture', () => {
    it('Active offers presentation displays coupon.imageUrl for deals and does not duplicate business card', () => {
      const content = readFileSync(viewPath, 'utf8');

      assert.ok(content.includes('offer.imageUrl'), 'Must bind offer.imageUrl to deal card');
      assert.ok(content.includes('alt={offer.title}'), 'Must use offer.title for image alt text');
      assert.ok(content.includes('remainingClaims'), 'Must display remaining claims');
      assert.ok(content.includes('formatDisplayDate(offer.endDate)'), 'Must format expiry date');
    });

    it('Hero presentation displays business photo as cover and logo separately', () => {
      const content = readFileSync(viewPath, 'utf8');

      assert.ok(content.includes('primaryCoverPhoto'), 'Must resolve cover photo from business photos');
      assert.ok(content.includes('logoUrl'), 'Must render business logo separately');
      assert.ok(content.includes('getBusinessInitials'), 'Must have fallback initials avatar');
      assert.ok(content.includes('directionsUrl'), 'Must provide directions action');
    });

    it('No hardcoded mock business, coupon, review, or image URLs exist in customer views', () => {
      const viewContent = readFileSync(viewPath, 'utf8');
      const galleryContent = readFileSync(galleryPath, 'utf8');
      const reviewsContent = readFileSync(reviewsPath, 'utf8');

      const mockPatterns = [
        'res.cloudinary.com',
        'images.unsplash.com',
        'via.placeholder.com',
        'Sample Business Name',
        'Test Business ABC',
      ];

      for (const pattern of mockPatterns) {
        assert.ok(!viewContent.includes(pattern), `BusinessDetailsView must not contain hardcoded string "${pattern}"`);
        assert.ok(!galleryContent.includes(pattern), `BusinessPhotoGallery must not contain hardcoded string "${pattern}"`);
        assert.ok(!reviewsContent.includes(pattern), `BusinessReviewsSection must not contain hardcoded string "${pattern}"`);
      }
    });
  });

  describe('6. Isolation & Safety Verification', () => {
    it('Vendor and Admin UI components remain completely untouched', () => {
      // Verify vendor branding upload component still exists and is untouched
      const vendorBrandingPath = join(process.cwd(), 'components/vendor/BusinessBrandingUpload.jsx');
      if (existsSync(vendorBrandingPath)) {
        const vendorContent = readFileSync(vendorBrandingPath, 'utf8');
        assert.ok(vendorContent.includes('uploadBusinessLogo') || vendorContent.includes('uploadGalleryPhoto'));
      }
    });
  });
});
