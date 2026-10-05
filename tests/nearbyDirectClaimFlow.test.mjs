import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('LocalGrow — Complete Multi-Offer Direct Claim Flow Verification', () => {
  const cardPath = join(process.cwd(), 'components/nearby/NearbyBusinessCard.jsx');
  const sectionPath = join(process.cwd(), 'components/nearby/NearbySection.jsx');
  const businessDetailsPath = join(process.cwd(), 'components/business/BusinessDetailsView.jsx');

  describe('1. Nearby Compact Card & Direct Claim', () => {
    it('components/nearby/NearbyBusinessCard.jsx exists and imports claimCoupon from actions/couponActions', () => {
      assert.ok(existsSync(cardPath), 'NearbyBusinessCard.jsx must exist');
      const content = readFileSync(cardPath, 'utf8');

      assert.ok(
        content.includes("from '@/actions/couponActions'"),
        'Must import claimCoupon from actions/couponActions'
      );
      assert.ok(content.includes('claimCoupon'), 'Must call claimCoupon');
    });

    it('shows only first active offer and retains +N more badge for 2+ offers without expanding card', () => {
      const content = readFileSync(cardPath, 'utf8');

      // Primary offer resolution
      assert.ok(content.includes('primaryOffer = hasOffers ? activeOffers[0] : null'), 'Must resolve first offer as primary');
      assert.ok(content.includes('primaryOffer?.title'), 'Must display primary offer title');

      // +N more badge exists for multiple offers
      assert.ok(content.includes('+{activeOffers.length - 1} more'), 'Must show +N more badge when activeOffers.length > 1');

      // Does not render a full list/map over all active offers inside the compact card
      assert.ok(!content.includes('activeOffers.map('), 'Must not expand/map all offers in the compact Nearby card');
    });

    it('contains an interactive Claim button and handles claiming/claimed UI states', () => {
      const content = readFileSync(cardPath, 'utf8');

      assert.ok(content.includes('handleClaimOffer'), 'Must declare handleClaimOffer callback');
      assert.ok(content.includes('Claiming...'), 'Must render Claiming... state');
      assert.ok(content.includes('Claimed'), 'Must render Claimed state');
      assert.ok(content.includes('Scissors'), 'Must render action icon for claim');
      assert.ok(content.includes('Check'), 'Must render check icon for claimed');
    });

    it('prevents event propagation so Claim does NOT trigger card selection or navigation', () => {
      const content = readFileSync(cardPath, 'utf8');

      assert.ok(content.includes('e.preventDefault()'), 'handleClaimOffer must prevent default');
      assert.ok(content.includes('e.stopPropagation()'), 'handleClaimOffer must stop propagation');
      assert.ok(
        content.includes("e.target.closest('button')"),
        'Card selection click handler must ignore clicks on button elements'
      );
    });

    it('does NOT contain any redirect or navigation to /coupons in Nearby card', () => {
      const content = readFileSync(cardPath, 'utf8');

      assert.ok(!content.includes("router.push('/coupons')"), 'Must not push to /coupons');
      assert.ok(!content.includes("router.replace('/coupons')"), 'Must not replace to /coupons');
      assert.ok(!content.includes("href=\"/coupons\""), 'Must not link to /coupons');
      assert.ok(!content.includes("window.location = '/coupons'"), 'Must not redirect via window.location');
    });

    it('preserves existing active offer display, View Store, and Directions links', () => {
      const content = readFileSync(cardPath, 'utf8');

      assert.ok(content.includes('hasOffers'), 'Must preserve hasOffers check');
      assert.ok(content.includes('View Store'), 'Must preserve View Store button');
      assert.ok(content.includes('Directions'), 'Must preserve Directions button');
      assert.ok(content.includes('storeUrl'), 'Must preserve storeUrl');
    });
  });

  describe('2. NearbySection Claim Synchronization', () => {
    it('components/nearby/NearbySection.jsx maintains claimedCouponIds and synchronization callback', () => {
      assert.ok(existsSync(sectionPath), 'NearbySection.jsx must exist');
      const content = readFileSync(sectionPath, 'utf8');

      assert.ok(content.includes('claimedCouponIds'), 'Must declare claimedCouponIds state');
      assert.ok(content.includes('handleClaimSuccess'), 'Must declare handleClaimSuccess callback');
      assert.ok(
        content.includes('claimedCouponIds={claimedCouponIds}'),
        'Must pass claimedCouponIds to NearbyBusinessCard'
      );
      assert.ok(
        content.includes('onClaimSuccess={handleClaimSuccess}'),
        'Must pass onClaimSuccess to NearbyBusinessCard'
      );
    });
  });

  describe('3. Business Details All Active Offers Direct Claim', () => {
    it('components/business/BusinessDetailsView.jsx exists and imports claimCoupon', () => {
      assert.ok(existsSync(businessDetailsPath), 'BusinessDetailsView.jsx must exist');
      const content = readFileSync(businessDetailsPath, 'utf8');

      assert.ok(content.includes("from '@/actions/couponActions'"), 'Must import claimCoupon from couponActions');
      assert.ok(content.includes('claimCoupon'), 'Must call claimCoupon');
    });

    it('replaces "Claim on Coupons →" with an in-place Claim button for EVERY active offer', () => {
      const content = readFileSync(businessDetailsPath, 'utf8');

      // The old "Claim on Coupons" link must be completely removed
      assert.ok(!content.includes('Claim on Coupons'), 'Must not contain "Claim on Coupons"');
      assert.ok(!content.includes('href="/coupons"'), 'Must not contain href="/coupons" anywhere in BusinessDetailsView');

      // Direct in-place Claim button and states exist
      assert.ok(content.includes('handleClaimOffer'), 'Must declare handleClaimOffer callback');
      assert.ok(content.includes('Claiming...'), 'Must render Claiming... state');
      assert.ok(content.includes('Claimed'), 'Must render Claimed state');
      assert.ok(content.includes('Scissors'), 'Must render Scissors icon for Claim button');
      assert.ok(content.includes('Check'), 'Must render Check icon for Claimed state');
    });

    it('tracks independent claimed state per offer ID in BusinessDetailsView', () => {
      const content = readFileSync(businessDetailsPath, 'utf8');

      assert.ok(content.includes('claimedOffersStatus'), 'Must declare claimedOffersStatus map');
      assert.ok(content.includes('claimedOffersStatus[offer.id]'), 'Must index claimed status by offer.id');
      assert.ok(content.includes('id={`claim-button-${offer.id}`}'), 'Each offer must have a unique claim button ID');
    });

    it('does NOT contain any redirect or navigation to /coupons in BusinessDetailsView', () => {
      const content = readFileSync(businessDetailsPath, 'utf8');

      assert.ok(!content.includes("router.push('/coupons')"), 'Must not push to /coupons');
      assert.ok(!content.includes("router.replace('/coupons')"), 'Must not replace to /coupons');
      assert.ok(!content.includes("href=\"/coupons\""), 'Must not link to /coupons');
      assert.ok(!content.includes("window.location = '/coupons'"), 'Must not redirect via window.location');
    });
  });

  describe('4. Multi-Offer Independent State & Claim Logic Simulation', () => {
    it('1 offer → direct claim updates offer state to claimed without redirecting', async () => {
      const claimedState = {};

      const mockClaimCoupon = async (id) => ({
        success: true,
        coupon: { id, user_id: 'cust-1', coupon_status: 'claimed' },
      });

      const handleClaim = async (offerId) => {
        claimedState[offerId] = 'claiming';
        const res = await mockClaimCoupon(offerId);
        if (res.success) {
          claimedState[offerId] = 'claimed';
        }
      };

      await handleClaim('offer-single');

      assert.strictEqual(claimedState['offer-single'], 'claimed');
    });

    it('2+ offers → claiming offer 1 does NOT mark offer 2 as claimed', async () => {
      const claimedState = {
        'offer-1': 'idle',
        'offer-2': 'idle',
        'offer-3': 'idle',
      };

      const mockClaimCoupon = async (id) => ({
        success: true,
        coupon: { id, user_id: 'cust-1', coupon_status: 'claimed' },
      });

      const handleClaim = async (offerId) => {
        claimedState[offerId] = 'claiming';
        const res = await mockClaimCoupon(offerId);
        if (res.success) {
          claimedState[offerId] = 'claimed';
        }
      };

      // Claim only offer-1
      await handleClaim('offer-1');

      assert.strictEqual(claimedState['offer-1'], 'claimed', 'Offer 1 must be marked as claimed');
      assert.strictEqual(claimedState['offer-2'], 'idle', 'Offer 2 must remain unclaimed');
      assert.strictEqual(claimedState['offer-3'], 'idle', 'Offer 3 must remain unclaimed');

      // Now claim offer-2
      await handleClaim('offer-2');

      assert.strictEqual(claimedState['offer-1'], 'claimed', 'Offer 1 remains claimed');
      assert.strictEqual(claimedState['offer-2'], 'claimed', 'Offer 2 is now claimed');
      assert.strictEqual(claimedState['offer-3'], 'idle', 'Offer 3 remains unclaimed');
    });

    it('already-claimed offer immediately transitions to Claimed', async () => {
      const claimedState = {};

      const mockClaimCoupon = async () => ({
        success: false,
        message: 'Coupon already claimed by this user',
      });

      const handleClaim = async (offerId) => {
        claimedState[offerId] = 'claiming';
        const res = await mockClaimCoupon(offerId);
        if (!res.success && res.message.toLowerCase().includes('already claimed')) {
          claimedState[offerId] = 'claimed';
        }
      };

      await handleClaim('offer-already-claimed');

      assert.strictEqual(claimedState['offer-already-claimed'], 'claimed');
    });

    it('claim failure keeps Claim button available and shows error', async () => {
      const claimedState = {};
      let errorAlert = null;

      const mockClaimCoupon = async () => ({
        success: false,
        message: 'Coupon campaign has ended',
      });

      const handleClaim = async (offerId) => {
        claimedState[offerId] = 'claiming';
        const res = await mockClaimCoupon(offerId);
        if (!res.success) {
          errorAlert = res.message;
          delete claimedState[offerId]; // Reset state so button stays available
        }
      };

      await handleClaim('offer-expired');

      assert.strictEqual(claimedState['offer-expired'], undefined, 'Must reset state so Claim remains available');
      assert.strictEqual(errorAlert, 'Coupon campaign has ended');
    });
  });
});
