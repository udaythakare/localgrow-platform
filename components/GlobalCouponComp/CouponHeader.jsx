import React from "react";
import { RefreshCw, MapPin, Globe } from "lucide-react";

export const CouponHeader = ({
  lastRefreshed,
  loading,
  onRefresh,
  locationSource,
  locationName,
}) => {
  const formatRefreshTime = (date) => {
    if (!date) return "";
    return date.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const isLocal =
    locationSource === "area" ||
    locationSource === "city" ||
    locationSource === "profile_city" ||
    locationSource === "ip_city";

  const LocationBadge = () => (
    <span className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold bg-indigo-50 text-indigo-700 border border-indigo-100 shadow-sm">
      {isLocal && locationName ? (
        <>
          <MapPin size={13} className="text-indigo-600 flex-shrink-0" />
          <span className="capitalize">{locationName} Deals</span>
        </>
      ) : (
        <>
          <Globe size={13} className="text-indigo-600 flex-shrink-0" />
          <span>Local Deals</span>
        </>
      )}
    </span>
  );

  return (
    <div className="flex flex-col gap-2 sm:gap-3 mb-6">
      {/* Top Controls Row */}
      <div className="flex items-center justify-between gap-3 flex-wrap">

        {/* Left: Location pill + updated time */}
        <div className="flex items-center gap-3 flex-wrap">
          <LocationBadge />
          {lastRefreshed && (
            <span className="text-xs text-slate-500 font-medium">
              Updated {formatRefreshTime(lastRefreshed)}
            </span>
          )}
        </div>

        {/* Refresh Button */}
        <button
          type="button"
          onClick={() => onRefresh && onRefresh()}
          disabled={loading}
          className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-xl text-xs font-semibold text-slate-700 bg-white border border-slate-200 hover:bg-slate-50 hover:border-slate-300 active:scale-[0.98] shadow-sm transition disabled:opacity-40 cursor-pointer flex-shrink-0"
        >
          <RefreshCw size={13} className={loading ? "animate-spin text-indigo-600" : "text-slate-500"} />
          <span>Refresh Deals</span>
        </button>

      </div>
    </div>
  );
};