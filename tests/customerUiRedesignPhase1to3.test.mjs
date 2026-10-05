import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('LocalGrow — Customer UI Redesign Phase 1-3 Verification', () => {

  describe('Phase 1: Customer Theme Scoping & Decoupling', () => {
    it('CustomerThemeWrapper exists and defines Plus Jakarta Sans scoped container', () => {
      const wrapperPath = join(process.cwd(), 'components/customer/CustomerThemeWrapper.jsx');
      assert.ok(existsSync(wrapperPath));
      const content = readFileSync(wrapperPath, 'utf8');
      assert.ok(content.includes('Plus_Jakarta_Sans'));
      assert.ok(content.includes('--font-customer-sans'));
      assert.ok(content.includes('customer-theme'));
      assert.ok(content.includes('bg-[#f8fafc]'));
    });

    it('CustomerClaimsCounter exists, is decoupled from vendor, and handles bounded and unbounded counts', () => {
      const counterPath = join(process.cwd(), 'components/GlobalCouponComp/CustomerClaimsCounter.jsx');
      assert.ok(existsSync(counterPath));
      const content = readFileSync(counterPath, 'utf8');
      assert.ok(content.includes('useRealtimeClaimsCount'));
      assert.ok(content.includes('progressbar'));
      assert.ok(content.includes('claimed'));
      assert.ok(content.includes('left'));
      // Verifies vendor component is NOT imported
      assert.ok(!content.includes('app/business/dashboard/coupons/components/ClaimCounter'));
    });

    it('app/coupons/layout.jsx wraps customer route with CustomerThemeWrapper', () => {
      const layoutPath = join(process.cwd(), 'app/coupons/layout.jsx');
      assert.ok(existsSync(layoutPath));
      const content = readFileSync(layoutPath, 'utf8');
      assert.ok(content.includes('CustomerThemeWrapper'));
    });

    it('app/globals.css and app/layout.js global defaults remain untouched', () => {
      const globalsCss = readFileSync(join(process.cwd(), 'app/globals.css'), 'utf8');
      assert.ok(globalsCss.includes('--font-family-default: var(--font-jetbrains-mono);'));

      const rootLayout = readFileSync(join(process.cwd(), 'app/layout.js'), 'utf8');
      assert.ok(rootLayout.includes('DotBackground'));
      assert.ok(rootLayout.includes('jetBrainsMono'));
    });
  });

  describe('Phase 2: Customer Navigation & Global UI Modernization', () => {
    it('Navbar.jsx uses modern translucent surface, subtle borders, and rounded-xl buttons', () => {
      const navPath = join(process.cwd(), 'components/Navbar.jsx');
      assert.ok(existsSync(navPath));
      const content = readFileSync(navPath, 'utf8');
      assert.ok(content.includes('bg-white/95 backdrop-blur-md'));
      assert.ok(content.includes('border-b border-slate-200/80'));
      assert.ok(content.includes('shadow-[0_1px_3px_0_rgba(15,23,42,0.03)]'));
      assert.ok(content.includes('text-indigo-600'));
      // No neo-brutalist border-2 border-black
      assert.ok(!content.includes('border-b-2 border-black'));
    });

    it('BottomBar.jsx uses frosted glass surface and modern tab capsule', () => {
      const barPath = join(process.cwd(), 'components/BottomBar.jsx');
      assert.ok(existsSync(barPath));
      const content = readFileSync(barPath, 'utf8');
      assert.ok(content.includes('backdrop-blur-xl border-t border-slate-200/80'));
      assert.ok(content.includes('bg-indigo-50 text-indigo-600'));
      assert.ok(!content.includes('border-t-2 border-black'));
    });

    it('ConfirmationModal.jsx uses modern rounded-2xl dialog and clean action buttons', () => {
      const modalPath = join(process.cwd(), 'components/ConfirmationModal.jsx');
      assert.ok(existsSync(modalPath));
      const content = readFileSync(modalPath, 'utf8');
      assert.ok(content.includes('rounded-2xl border border-slate-100 shadow-2xl'));
      assert.ok(content.includes('bg-indigo-600 hover:bg-indigo-700'));
      assert.ok(!content.includes('border-4 border-black'));
      assert.ok(!content.includes('bg-yellow-400 border-b-4 border-black'));
    });

    it('NotificationToggle.jsx uses modern Tailwind toast card with indigo action button', () => {
      const togglePath = join(process.cwd(), 'components/NotificationToggle.jsx');
      assert.ok(existsSync(togglePath));
      const content = readFileSync(togglePath, 'utf8');
      assert.ok(content.includes('rounded-2xl border border-slate-200/90 shadow-xl'));
      assert.ok(content.includes('bg-indigo-600 hover:bg-indigo-700'));
      assert.ok(!content.includes('#007bff'));
    });
  });

  describe('Phase 3: /coupons Experience & Modern Deals Cards', () => {
    it('app/coupons/page.jsx features modern discovery hero banner and stats', () => {
      const pagePath = join(process.cwd(), 'app/coupons/page.jsx');
      assert.ok(existsSync(pagePath));
      const content = readFileSync(pagePath, 'utf8');
      assert.ok(content.includes('GlobalCouponSection'));
      assert.ok(content.includes('NotificationToggle'));
      assert.ok(content.includes('Discover The Best'));
      assert.ok(content.includes('Local Deals'));
      assert.ok(content.includes('bg-indigo-600'));
    });

    it('CouponCard.jsx implements the visual hierarchy: Business identity -> Offer -> Claims -> Actions', () => {
      const cardPath = join(process.cwd(), 'components/GlobalCouponComp/CouponCard/CouponCard.jsx');
      const content = readFileSync(cardPath, 'utf8');
      assert.ok(content.includes('border border-slate-200/90 bg-white') && (content.includes('rounded-2xl') || content.includes('rounded-xl')));
      assert.ok(content.includes('CustomerClaimsCounter'));
      assert.ok(content.includes('View Details'));
      assert.ok(content.includes('Claim Deal'));
      assert.ok(content.includes('bg-indigo-600 hover:bg-indigo-700'));
      assert.ok(!content.includes('border-2 border-black'));
      assert.ok(!content.includes('shadow-[4px_4px_0px_0px_#000]'));
    });

    it('GlobalCouponSection.jsx correctly provides isCouponClaimed and passes refreshCouponData to useCouponClaim', () => {
      const sectionPath = join(process.cwd(), 'components/GlobalCouponSection.jsx');
      assert.ok(existsSync(sectionPath));
      const content = readFileSync(sectionPath, 'utf8');
      assert.ok(content.includes('useCouponClaim(refreshCouponData)'));
      assert.ok(content.includes('const isCouponClaimed = (couponId) =>'));
      assert.ok(content.includes('Recommended For You'));
      assert.ok(content.includes('Ending in 24 Hours'));
      assert.ok(content.includes('All Deals'));
    });

    it('EmptyState, LoadingSpinner, and ErrorDisplay use modern soft tokens', () => {
      const emptyContent = readFileSync(join(process.cwd(), 'components/GlobalCouponComp/EmptyState.jsx'), 'utf8');
      assert.ok(emptyContent.includes('rounded-2xl bg-indigo-50 border border-indigo-100'));
      assert.ok(!emptyContent.includes('border-2 border-black'));

      const spinnerContent = readFileSync(join(process.cwd(), 'components/GlobalCouponComp/LoadingSpinner.jsx'), 'utf8');
      assert.ok(spinnerContent.includes('rounded-2xl border border-slate-200'));
      assert.ok(spinnerContent.includes('animate-pulse'));
      assert.ok(!spinnerContent.includes('border-2 border-black'));

      const errorContent = readFileSync(join(process.cwd(), 'components/GlobalCouponComp/ErrorDisplay.jsx'), 'utf8');
      assert.ok(errorContent.includes('bg-rose-50 border border-rose-200'));
      assert.ok(!errorContent.includes('border-2 border-red-500'));
    });
  });

  describe('Safety Verification: Vendor & Admin Code Isolation', () => {
    it('vendor ClaimCounter.jsx exists and has not been modified or replaced', () => {
      const vendorClaimCounter = join(process.cwd(), 'app/business/dashboard/coupons/components/ClaimCounter.jsx');
      assert.ok(existsSync(vendorClaimCounter));
      const content = readFileSync(vendorClaimCounter, 'utf8');
      assert.ok(content.includes('export default function ClaimsCounter'));
      assert.ok(content.includes('border-2 border-black p-2 font-bold'));
    });
  });

});
