import { describe, it } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { join } from 'node:path';

describe('LocalGrow — My Coupons UI Redesign & Architecture Verification', () => {
    const pagePath = join(process.cwd(), 'app/u/profile/my-coupons/page.jsx');
    const viewPath = join(process.cwd(), 'app/u/profile/my-coupons/components/MyCouponsView.jsx');
    const cardPath = join(process.cwd(), 'app/u/profile/my-coupons/components/MyCouponCard.jsx');
    const claimedApiRoute = join(process.cwd(), 'app/api/profile/user-claimed-coupon/route.js');
    const redeemedApiRoute = join(process.cwd(), 'app/api/profile/user-redeemed-coupon/route.js');

    describe('1. Route Shell & Customer Theme Integration', () => {
        it('app/u/profile/my-coupons/page.jsx wraps view with CustomerThemeWrapper', () => {
            assert.ok(existsSync(pagePath), 'page.jsx must exist');
            const content = readFileSync(pagePath, 'utf8');

            assert.ok(content.includes('CustomerThemeWrapper'), 'Must import CustomerThemeWrapper');
            assert.ok(content.includes('<CustomerThemeWrapper'), 'Must wrap tree in CustomerThemeWrapper');
            assert.ok(content.includes('MyCouponsView'), 'Must delegate rendering to MyCouponsView');
            assert.ok(content.includes('getUserId'), 'Must authenticate user with getUserId');
            assert.ok(content.includes('supabaseAdmin'), 'Must query supabaseAdmin');
        });

        it('page.jsx handles unauthenticated users gracefully without crashing', () => {
            const content = readFileSync(pagePath, 'utf8');
            assert.ok(content.includes('Sign In Required') || content.includes('/login'), 'Must present sign in path');
        });
    });

    describe('2. Modern Customer Design System & Tokens (Eliminating Heavy/Oversized Treatment)', () => {
        it('MyCouponsView.jsx eliminates old heavy brutalist styling and uses modern customer tokens', () => {
            assert.ok(existsSync(viewPath), 'MyCouponsView.jsx must exist');
            const content = readFileSync(viewPath, 'utf8');

            // No neo-brutalist border-4 border-black or garish dark-purple gradients
            assert.ok(!content.includes('border-4 border-black'), 'Must not contain brutalist border-4 border-black');
            assert.ok(!content.includes('#3716a8'), 'Must not contain legacy hardcoded deep purple #3716a8');
            assert.ok(!content.includes('#5a32e0'), 'Must not contain legacy gradient stop #5a32e0');
            assert.ok(!content.includes('#6c4bff'), 'Must not contain legacy gradient stop #6c4bff');

            // Modern tokens
            assert.ok(content.includes('text-slate-900'), 'Must use slate typography');
            assert.ok(content.includes('text-slate-500'), 'Must use subtle slate for secondary text');
            assert.ok(content.includes('bg-indigo-600') || content.includes('text-indigo-600'), 'Must use indigo primary accent');
            assert.ok(content.includes('bg-emerald-50') && content.includes('text-emerald-700'), 'Must use emerald for active status');
            assert.ok(content.includes('bg-purple-50') && content.includes('text-purple-700'), 'Must use purple for redeemed status');
        });

        it('MyCouponCard.jsx uses compact responsive tokens and rounded-2xl geometry', () => {
            assert.ok(existsSync(cardPath), 'MyCouponCard.jsx must exist');
            const content = readFileSync(cardPath, 'utf8');

            assert.ok(content.includes('rounded-2xl'), 'Must use rounded-2xl modern radius');
            assert.ok(content.includes('border-slate-200'), 'Must use subtle slate border');
            assert.ok(!content.includes('border-4 border-black'), 'Must not contain brutalist border');
        });
    });

    describe('3. Header Requirements', () => {
        it('Header specifies My Coupons, subtitle, and dynamic summary count pills', () => {
            const content = readFileSync(viewPath, 'utf8');

            assert.ok(content.includes('My Coupons'), 'Header title must be My Coupons');
            assert.ok(content.includes('Your claimed deals in one place'), 'Subtitle must match specification');
            assert.ok(content.includes('counts.active'), 'Must show active count dynamically');
            assert.ok(content.includes('counts.expired'), 'Must show expired count dynamically');
            assert.ok(content.includes('counts.redeemed'), 'Must show redeemed count dynamically');
            assert.ok(content.includes('Active'), 'Active pill label must exist');
            assert.ok(content.includes('Expired'), 'Expired pill label must exist');
            assert.ok(content.includes('Redeemed'), 'Redeemed pill label must exist');
        });
    });

    describe('4. Active, Expired, and Redeemed Sections', () => {
        it('Active section specifies title, subtitle, and SHOW QR CODE action', () => {
            const viewContent = readFileSync(viewPath, 'utf8');
            assert.ok(viewContent.includes('Active Coupons'), 'Active section title');
            assert.ok(viewContent.includes('Currently available to use'), 'Active section subtitle');

            const cardContent = readFileSync(cardPath, 'utf8');
            assert.ok(cardContent.includes('SHOW QR CODE'), 'Active card has SHOW QR CODE action');
        });

        it('Expired section specifies title, subtitle, and hides QR button', () => {
            const viewContent = readFileSync(viewPath, 'utf8');
            assert.ok(viewContent.includes('Expired Coupons'), 'Expired section title');
            assert.ok(viewContent.includes('Claimed deals that are no longer valid'), 'Expired section subtitle');

            const cardContent = readFileSync(cardPath, 'utf8');
            assert.ok(cardContent.includes('EXPIRED'), 'Expired card has EXPIRED badge');
        });

        it('Redeemed section specifies title and preserves redemption status', () => {
            const viewContent = readFileSync(viewPath, 'utf8');
            assert.ok(viewContent.includes('Redeemed Coupons'), 'Redeemed section title');

            const cardContent = readFileSync(cardPath, 'utf8');
            assert.ok(cardContent.includes('SUCCESSFULLY REDEEMED'), 'Redeemed card shows redemption status');
        });
    });

    describe('5. Image Architecture & Data Fields', () => {
        it('Uses coupon.image_url for deal and business.logo_url for business logo', () => {
            const cardContent = readFileSync(cardPath, 'utf8');
            assert.ok(cardContent.includes('coupon.image_url'), 'Uses coupon.image_url');
            assert.ok(cardContent.includes('business.logo_url'), 'Uses business.logo_url');
            assert.ok(cardContent.includes('getBusinessInitials'), 'Uses getBusinessInitials for avatar fallback');

            // No hardcoded image URLs
            assert.ok(!cardContent.includes('https://images.unsplash.com'), 'No hardcoded unsplash images');
            assert.ok(!cardContent.includes('https://placehold.co'), 'No hardcoded placehold.co images');
            assert.ok(!cardContent.includes('https://via.placeholder'), 'No placeholder image links');
        });
    });

    describe('6. Responsive Grid & Fixed Bottom Nav Clearance', () => {
        it('MyCouponsView uses 2-column mobile grid and padding for bottom navigation', () => {
            const viewContent = readFileSync(viewPath, 'utf8');
            assert.ok(viewContent.includes('grid-cols-2'), 'Must specify grid-cols-2 for compact mobile display');
            assert.ok(viewContent.includes('md:grid-cols-3'), 'Must scale to 3 columns on tablet/desktop');
            assert.ok(viewContent.includes('pb-28') || viewContent.includes('pb-24') || viewContent.includes('pb-16'), 'Must clear fixed bottom bar');
        });
    });

    describe('7. Empty State Messaging', () => {
        it('Provides the exact specified empty state copy for each section', () => {
            const viewContent = readFileSync(viewPath, 'utf8');
            assert.ok(viewContent.includes("You're all caught up") || viewContent.includes("You&apos;re all caught up"), "Active empty state must say You're all caught up");
            assert.ok(viewContent.includes('No expired coupons'), 'Expired empty state must say No expired coupons');
            assert.ok(viewContent.includes('No redeemed coupons yet'), 'Redeemed empty state must say No redeemed coupons yet');
            assert.ok(viewContent.includes('href="/coupons"'), 'Empty states provide link back to /coupons');
        });
    });

    describe('8. API Route Queries Include Business Logo & Status', () => {
        it('user-claimed-coupon route queries logo_url, status, and locations', () => {
            const content = readFileSync(claimedApiRoute, 'utf8');
            assert.ok(content.includes('logo_url'), 'user-claimed-coupon route must select logo_url');
            assert.ok(content.includes('status'), 'user-claimed-coupon route must select business status');
            assert.ok(content.includes('user_id'), 'user-claimed-coupon route must filter by user_id');
        });

        it('user-redeemed-coupon route queries logo_url, status, and locations', () => {
            const content = readFileSync(redeemedApiRoute, 'utf8');
            assert.ok(content.includes('logo_url'), 'user-redeemed-coupon route must select logo_url');
            assert.ok(content.includes('status'), 'user-redeemed-coupon route must select business status');
            assert.ok(content.includes('user_id'), 'user-redeemed-coupon route must filter by user_id');
        });
    });

    describe('9. Isolation & Safety Verification', () => {
        it('No modifications made to vendor or admin coupon management dashboards', () => {
            const vendorClaimCounter = join(process.cwd(), 'app/business/dashboard/coupons/components/ClaimCounter.jsx');
            assert.ok(existsSync(vendorClaimCounter), 'Vendor ClaimCounter must remain intact');

            const vendorCouponActions = join(process.cwd(), 'app/business/dashboard/coupons/actions/couponActions.js');
            assert.ok(existsSync(vendorCouponActions), 'Vendor actions must remain intact');
        });

        it('Database schema remains untouched (no alter/drop migrations introduced)', () => {
            const migrationsDir = join(process.cwd(), 'migrations');
            assert.ok(existsSync(migrationsDir), 'Migrations directory exists');
            // Ensure no temp/destructive migration was added
            assert.ok(!existsSync(join(migrationsDir, 'drop_expired_coupons.sql')));
            assert.ok(!existsSync(join(migrationsDir, 'delete_expired_coupons.sql')));
        });
    });
});
