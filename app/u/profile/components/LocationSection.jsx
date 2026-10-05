import LocationForm from "./LocationForm";
import { updateUserLocation } from "../apply-for-investor/actions/userActions";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { cookies } from "next/headers";

/**
 * Fetch existing saved location data for the user.
 * Tries direct database lookup if userId is provided, with graceful HTTP fallback.
 */
export async function fetchLocationData(userId) {
  try {
    if (userId) {
      const { data, error } = await supabaseAdmin
        .from("user_locations")
        .select("*")
        .eq("user_id", userId)
        .maybeSingle();

      if (!error && data) {
        return { success: true, data };
      }
      return { success: true, data: null };
    }
  } catch (error) {
    console.error("Error fetching location data from supabase:", error);
  }

  try {
    const baseUrl = process.env.NEXT_PUBLIC_SITE_URL || "";
    const apiUrl = `${baseUrl}/api/profile/location-data`;
    const response = await fetch(apiUrl, {
      method: "GET",
      credentials: "include",
      headers: {
        "Content-Type": "application/json",
        Cookie: (await cookies()).toString(),
      },
      cache: "no-store",
    });

    if (response.ok) {
      return response.json();
    }
  } catch (error) {
    console.error("Error fetching location data via API:", error);
  }

  return { success: true, data: null };
}

export default async function LocationSection({ userData }) {
  const locationDataResponse = await fetchLocationData(userData?.id);
  const initialLocation = locationDataResponse?.data || null;

  return (
    <section className="w-full">
      {/* Section Header */}
      <div className="mb-6">
        <h2 className="text-xl sm:text-2xl font-bold tracking-tight text-slate-900">
          Your Location
        </h2>
        <p className="text-sm text-slate-500 mt-1">
          Detect and save your location to discover local coupons and deals near you.
        </p>
      </div>

      {/* Modern Location Card */}
      <LocationForm
        initialData={initialLocation}
        onSubmit={updateUserLocation}
      />
    </section>
  );
}