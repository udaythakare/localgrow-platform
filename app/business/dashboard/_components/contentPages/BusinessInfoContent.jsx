"use client";

import { useEffect, useState } from "react";
import BusinessInfoForm from "../BusinessInfoForm";
import OperatingHoursManager from "../OperatingHoursManager";
import BusinessBrandingManager from "../BusinessBrandingManager";
import { useLanguage } from "@/context/LanguageContext";

export default function BusinessInfoContent() {

  const [businessInfo, setBusinessInfo] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  const ctx = useLanguage();
  const t = ctx?.t;

  useEffect(() => {

    const controller = new AbortController();
    let isMounted = true;

    const fetchBusinessInfo = async () => {

      try {

        const res = await fetch("/api/business-info", {
          signal: controller.signal
        });

        if (!res.ok) {
          throw new Error("Network response was not ok");
        }

        const data = await res.json();

        if (!data?.success) {
          throw new Error(data?.message || "Failed to fetch business information");
        }

        if (isMounted) {
          setBusinessInfo(data.businessInfo ?? null);
        }

      } catch (err) {

        if (err.name === "AbortError") return;

        console.error("Fetch Error:", err);

        if (isMounted) {
          setError("Failed to load business information");
        }

      } finally {

        if (isMounted) {
          setLoading(false);
        }

      }

    };

    fetchBusinessInfo();

    return () => {
      isMounted = false;
      controller.abort();
    };

  }, []);


  /* -------------------- LOADING -------------------- */

  if (loading) {
    return (
      <div className="p-6 space-y-6">

        <div className="h-8 w-64 bg-gray-200 rounded animate-pulse" />

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">
          {[...Array(6)].map((_, i) => (
            <div
              key={i}
              className="h-28 bg-gray-200 rounded-lg animate-pulse"
            />
          ))}
        </div>

      </div>
    );
  }


  /* -------------------- ERROR -------------------- */

  if (error) {
    return (
      <div className="p-6">

        <div
          className="border p-4 rounded-lg"
          style={{
            borderColor: "#df6824",
            backgroundColor: "#fff7f3",
            color: "#df6824"
          }}
        >

          <h2 className="font-bold text-lg">
            {t?.common?.error ?? "Error"}
          </h2>

          <p className="text-sm mt-1">
            {error}
          </p>

        </div>

      </div>
    );
  }


  /* -------------------- NO DATA -------------------- */

  if (!businessInfo) {
    return (
      <div className="p-6">

        <div
          className="border p-4 rounded-lg"
          style={{
            borderColor: "#df6824",
            backgroundColor: "#fff7f3"
          }}
        >

          <p className="text-sm font-medium">
            {t?.business?.noData ?? "No business information found"}
          </p>

        </div>

      </div>
    );
  }


  /* -------------------- MAIN UI -------------------- */

  return (

    <div className="p-4 md:p-6 space-y-8">


      {/* HEADER */}

      <div className="flex flex-col md:flex-row md:items-center md:justify-between gap-3">

        <div>

          <h1 className="text-2xl md:text-3xl font-black text-gray-900">
            {t?.business?.title ?? "Business Information"}
          </h1>

          <p className="text-sm text-gray-500 mt-1">
            {t?.business?.subtitle ?? "View and manage your registered business details"}
          </p>

        </div>

      </div>


      {/* BUSINESS OVERVIEW */}

      <SectionCard title={`🏢 ${t?.business?.overview ?? "Business Overview"}`}>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          <Info label={t?.business?.name ?? "Business Name"} value={businessInfo?.name} />

          <Info label={t?.business?.category ?? "Category"} value={businessInfo?.category_id} />

          <div className="md:col-span-2 xl:col-span-3">
            <Info
              label={t?.business?.description ?? "Description"}
              value={businessInfo?.description}
              multiline
            />
          </div>

        </div>

      </SectionCard>


      {/* CONTACT */}

      <SectionCard title={`📞 ${t?.business?.contact ?? "Contact Information"}`}>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          <Info label={t?.business?.email ?? "Email"} value={businessInfo?.email} />

          <Info label={t?.business?.phone ?? "Phone"} value={businessInfo?.phone} />

          <Info
            label={t?.business?.website ?? "Website"}
            value={businessInfo?.website}
            isLink
          />

        </div>

      </SectionCard>


      {/* LOCATION */}

      <SectionCard title={`📍 ${t?.business?.location ?? "Business Location"}`}>

        <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-6">

          <Info label={t?.business?.address ?? "Address"} value={businessInfo?.address} />

          <Info label={t?.business?.area ?? "Area"} value={businessInfo?.area} />

          <Info label={t?.business?.city ?? "City"} value={businessInfo?.city} />

          <Info label={t?.business?.state ?? "State"} value={businessInfo?.state} />

          <Info label={t?.business?.postal ?? "Postal Code"} value={businessInfo?.postal_code} />

          <Info label={t?.business?.country ?? "Country"} value={businessInfo?.country} />

        </div>

      </SectionCard>


      {/* OPERATING HOURS */}

      <SectionCard title={`🕒 ${t?.business?.operatingHours ?? "Store Operating Hours"}`}>

        <OperatingHoursManager
          locationId={businessInfo?.locationId || businessInfo?.id}
          initialTimezone={businessInfo?.timezone || "Asia/Kolkata"}
        />

      </SectionCard>


      {/* STORE BRANDING & PHOTOS */}

      <SectionCard title={`🖼️ ${t?.business?.branding ?? "Store Branding & Gallery Photos"}`}>

        <BusinessBrandingManager
          businessId={businessInfo?.businessId || businessInfo?.id}
          initialLogoUrl={businessInfo?.logo_url}
        />

      </SectionCard>


      {/* EDIT FORM */}

      <SectionCard title={`✏️ ${t?.business?.edit ?? "Edit Business Details"}`}>

        <BusinessInfoForm businessInfo={businessInfo} />

      </SectionCard>


    </div>

  );

}


/* -------------------- SECTION CARD -------------------- */

function SectionCard({ title, children }) {

  return (

    <div className="bg-white border-4 border-black rounded-lg shadow-[6px_6px_0px_0px_rgba(0,0,0,1)]">

      <div
        className="px-6 py-4 border-b-4 border-black font-black text-lg"
        style={{ color: "#df6824" }}
      >
        {title}
      </div>

      <div className="p-6">
        {children}
      </div>

    </div>

  );

}


/* -------------------- INFO COMPONENT -------------------- */

function Info({ label, value, multiline = false, isLink = false }) {

  return (

    <div className="space-y-1">

      <p className="text-xs font-bold text-gray-500 uppercase tracking-wide">
        {label}
      </p>

      {isLink && value ? (

        <a
          href={value}
          target="_blank"
          rel="noopener noreferrer"
          className="font-medium hover:underline break-words"
          style={{ color: "#df6824" }}
        >
          {value}
        </a>

      ) : (

        <p
          className={`font-semibold text-gray-900 break-words ${
            multiline ? "whitespace-pre-line" : ""
          }`}
        >
          {value || "—"}
        </p>

      )}

    </div>

  );

}