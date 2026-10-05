import React from "react";
import { SearchX, MapPinOff } from "lucide-react";
import { getCouponEmptyStateContent } from "@/helpers/couponFilterHelpers";

export const EmptyState = ({
  locationSource = 'none',
  locationName = '',
  categoryName = null,
  onClearFilters,
  onRefresh,
}) => {
  const content = getCouponEmptyStateContent({
    locationSource,
    locationName,
    categoryName,
  });

  const handleAction = content.buttonText === "Clear Category Filter"
    ? onClearFilters
    : (onRefresh || onClearFilters);

  return (
    <div className="flex flex-col items-center justify-center text-center py-16 px-6 bg-white/70 rounded-3xl border border-slate-200/80 shadow-xs my-6">
      {/* Icon Well */}
      <div className="mb-5 w-16 h-16 rounded-2xl bg-indigo-50 border border-indigo-100/80 flex items-center justify-center text-indigo-600 shadow-xs">
        {content.isLocationUnknown ? (
          <MapPinOff size={32} />
        ) : (
          <SearchX size={32} />
        )}
      </div>

      {/* Title */}
      <h2 className="text-xl sm:text-2xl font-bold text-slate-900 mb-2 tracking-tight">
        {content.title}
      </h2>

      {/* Description */}
      <p className="text-slate-600 max-w-md mb-6 text-sm sm:text-base leading-relaxed font-normal">
        {content.message}
      </p>

      {/* Button */}
      {handleAction && (
        <button
          type="button"
          onClick={() => handleAction && handleAction()}
          className="inline-flex items-center justify-center px-6 py-2.5 rounded-xl font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] shadow-sm hover:shadow transition-all text-sm cursor-pointer"
        >
          {content.buttonText}
        </button>
      )}
    </div>
  );
};