import { NextResponse } from 'next/server';
import { getUserId } from '@/helpers/userHelper';
import { supabaseAdmin } from '@/lib/supabaseAdmin';

export const dynamic = 'force-dynamic';

export async function GET() {
    try {
        const rawUserId = await getUserId();
        const userId = typeof rawUserId === 'string' && rawUserId.trim().length > 0 ? rawUserId.trim() : null;

        if (!userId) {
            return NextResponse.json({ success: false, message: 'User not logged in' }, { status: 401 });
        }

        const { data, error } = await supabaseAdmin
            .from('user_coupons')
            .select('*, coupons(*, businesses(id, name, logo_url, status, business_locations(*)))')
            .eq('user_id', userId)
            .eq('coupon_status', 'claimed')
            .order('id', { ascending: false });

        if (error) {
            console.error('Error fetching claimed coupons:', error);
            return NextResponse.json({ success: false, error }, { status: 500 });
        }

        return NextResponse.json({ success: true, coupons: data || [] });
    } catch (err) {
        console.error('Unexpected error:', err);
        return NextResponse.json({ success: false, error: err.message }, { status: 500 });
    }
}
