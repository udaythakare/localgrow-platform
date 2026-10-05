import { NextResponse } from "next/server";
import { getUserId } from "@/helpers/userHelper";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export async function GET() {
  try {
    const userId = await getUserId();

    if (!userId) {
      return NextResponse.json(
        { success: false, message: "User not logged in" },
        { status: 401 }
      );
    }

    // Fetch business
    const { data: business, error: businessError } = await supabaseAdmin
      .from("businesses")
      .select("*")
      .eq("user_id", userId)
      .single();

    if (businessError) {
      console.error(businessError);
      return NextResponse.json(
        { success: false, message: "Failed to fetch business" },
        { status: 500 }
      );
    }

    // Fetch business location
    const { data: location, error: locationError } = await supabaseAdmin
      .from("business_locations")
      .select("*")
      .eq("business_id", business.id)
      .single();

    if (locationError) {
      console.error(locationError);
      return NextResponse.json(
        { success: false, message: "Failed to fetch location" },
        { status: 500 }
      );
    }

    return NextResponse.json({
      success: true,
      businessInfo: {
        ...business,
        ...location,
        locationId: location.id,
        businessId: business.id,
      },
    });
  } catch (error) {
    console.error(error);
    return NextResponse.json(
      { success: false, message: "Internal server error" },
      { status: 500 }
    );
  }
}
