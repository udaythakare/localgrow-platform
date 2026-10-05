'use server';
import { options } from "@/app/api/auth/[...nextauth]/options";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { getServerSession } from "next-auth";

export async function getUserId() {
    const session = await getServerSession(options);
    if (!session?.user?.id) {
        return null;
    }

    return session.user.id;
}

export async function getUser() {
    const session = await getServerSession(options);
    if (!session?.user) {
        return null;
    }

    return session.user;
}
export async function getUserRolesFromDB(userId) {
    if (!userId || typeof userId !== 'string') {
        return [];
    }
    const { data, error } = await supabaseAdmin
        .from("user_roles")
        .select("role")
        .eq("user_id", userId);
    if (error) {
        console.error("Error fetching user roles:", error);
        return { success: false, error };
    }
    const roles = data ? data.map(role => role.role) : [];
    return roles;
}

export async function getSessionData() {
    const session = await getServerSession(options);
    if (!session?.user) {
        return null;
    }

    return session.user;
}

export async function getUserData(userId) {
    if (!userId || typeof userId !== 'string') {
        return { success: false, error: 'User ID required' };
    }
    const { data, error } = await supabaseAdmin
        .from("users")
        .select("*")
        .eq("id", userId)
        .single();

    if (error) {
        console.error("Error fetching user data:", error);
        return { success: false, error };
    }

    return { success: true, user: data };
}

export async function getCouponStatus(couponId, userId) {
    if (!couponId || !userId || typeof userId !== 'string') {
        return { success: false, error: 'Invalid parameters' };
    }
    console.log(couponId, userId, "coupon id and user id in get coupon status");
    // console.log('************************************************************')
    const { data, error } = await supabaseAdmin
        .from("user_coupons")
        .select("*")
        .eq("coupon_id", couponId)
        .eq("user_id", userId)
        .single();


    if (error) {
        console.error("Error fetching coupon status:", error);
        return { success: false, error };
    }

    return { success: true, couponStatus: data };
}

