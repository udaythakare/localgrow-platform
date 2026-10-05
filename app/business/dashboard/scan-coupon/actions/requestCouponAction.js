'use server'

import { getUserId } from "@/helpers/userHelper";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function getCouponRedeemRequest(params) {
    // console.log('this is params request')
}

export async function acceptCoupon(couponId, userId) {
    // 1) Verify vendor authentication
    const vendorId = await getUserId();
    if (!vendorId) {
        return { success: false, error: "Unauthorized: Vendor session not found" };
    }

    if (!couponId || !userId) {
        return { success: false, error: "Missing coupon or user identifier" };
    }

    // 2) Fetch coupon details and verify existence, ownership, active status, end_date, and redemption limits
    const { data: coupon, error: couponError } = await supabaseAdmin
        .from("coupons")
        .select("id, user_id, is_active, start_date, end_date, total_coupons, current_redemption")
        .eq("id", couponId)
        .single();

    if (couponError || !coupon) {
        return { success: false, error: "Coupon not found" };
    }

    // Verify coupon belongs to this vendor's shop
    if (coupon.user_id !== vendorId) {
        return { success: false, error: "Coupon does not belong to your shop!" };
    }

    // Verify coupon is currently active
    if (coupon.is_active === false) {
        return { success: false, error: "Coupon is not active" };
    }

    // Verify current server time is within coupon campaign end_date
    if (coupon.end_date) {
        const endDate = new Date(coupon.end_date);
        if (!isNaN(endDate.getTime()) && endDate.getTime() < Date.now()) {
            return { success: false, error: "Coupon campaign has expired" };
        }
    }

    // Verify redemption limit has not been reached (when total_coupons is configured)
    if (coupon.total_coupons != null && coupon.total_coupons > 0) {
        const currentRedemption = coupon.current_redemption || 0;
        if (currentRedemption >= coupon.total_coupons) {
            return { success: false, error: "Coupon redemption limit has been reached" };
        }
    }

    // 3) Verify matching user_coupons record exists and is in 'claimed' status
    const { data: userCouponData, error: userCouponError } = await supabaseAdmin
        .from("user_coupons")
        .select("id, coupon_status")
        .eq("user_id", userId)
        .eq("coupon_id", couponId)
        .single();

    if (userCouponError || !userCouponData) {
        return { success: false, error: "No claim record found for this customer" };
    }

    if (userCouponData.coupon_status === "redeemed") {
        return { success: false, error: "Coupon has already been redeemed" };
    }

    if (userCouponData.coupon_status !== "claimed") {
        return { success: false, error: `Coupon is not in claimed state (current: ${userCouponData.coupon_status})` };
    }

    // 4) Atomic status transition: 'claimed' -> 'redeemed'
    // Enforcing .eq("coupon_status", "claimed") guarantees protection against concurrent or duplicate redemption attempts
    const { data: updatedUserCoupon, error: ucError } = await supabaseAdmin
        .from("user_coupons")
        .update({
            coupon_status: "redeemed"
        })
        .eq("coupon_id", couponId)
        .eq("user_id", userId)
        .eq("coupon_status", "claimed")
        .select("*")
        .single();

    if (ucError || !updatedUserCoupon) {
        return {
            success: false,
            error: "Coupon could not be redeemed (may have been redeemed concurrently or already used)"
        };
    }

    // 5) Increment current_redemption counter ONLY after successful claimed -> redeemed transition
    const nextRedemptionCount = (coupon.current_redemption || 0) + 1;
    const { data: updatedCoupon, error: updError } = await supabaseAdmin
        .from("coupons")
        .update({
            current_redemption: nextRedemptionCount
        })
        .eq("id", couponId)
        .select("*")
        .single();

    if (updError) {
        console.error("Error updating coupon redemption count:", updError);
        // Note: user_coupons was already safely marked redeemed
    }

    return {
        success: true,
        coupon: updatedUserCoupon,
        couponDetails: updatedCoupon || { ...coupon, current_redemption: nextRedemptionCount }
    };
}