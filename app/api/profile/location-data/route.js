import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { getServerSession } from 'next-auth';
import { options } from '@/app/api/auth/[...nextauth]/options';
import { NextResponse } from 'next/server';

export const dynamic = 'force-dynamic'; // Prevents static optimization
export const runtime = 'nodejs'; // Ensures server-side execution

export async function GET(request) {
    // Set headers to force JSON response
    const headers = {
        'Content-Type': 'application/json',
        'Cache-Control': 'no-store, max-age=0'
    };

    try {
        const session = await getServerSession(options);
        // Check if user is authenticated
        if (!session || !session.user) {
            return new NextResponse(
                JSON.stringify({ success: false, message: 'Login required' }),
                { status: 401, headers }
            );
        }

        // Use the actual user ID from the session
        const userId = session.user.id;
        // // console.log(userId, 'this is userid');

        const { data, error } = await supabaseAdmin
            .from("user_locations")
            .select("*")
            .eq("user_id", userId)
            .maybeSingle();

        if (error) {
            console.error("Error fetching user location data:", error);
            return new NextResponse(
                JSON.stringify({
                    success: false,
                    message: 'Could not fetch user location data',
                    error: error.message
                }),
                { status: 500, headers }
            );
        }

        return new NextResponse(
            JSON.stringify({ success: true, data: data || null }),
            { status: 200, headers }
        );
    } catch (err) {
        console.error('Unexpected error in fetchUserData:', err);
        return new NextResponse(
            JSON.stringify({ success: false, message: 'An unexpected error occurred' }),
            { status: 500, headers }
        );
    }
}