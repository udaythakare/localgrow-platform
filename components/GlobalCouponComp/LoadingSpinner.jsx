import React from "react";
import { Loader2 } from "lucide-react";

export const LoadingSpinner = () => (
  <div className="w-full py-8">
    {/* Top Indicator */}
    <div className="flex items-center justify-center gap-2 mb-8">
      <Loader2 size={20} className="animate-spin text-indigo-600" />
      <span className="text-xs font-semibold text-slate-500 tracking-wide">
        Loading latest local deals...
      </span>
    </div>

    {/* Modern Shimmer Skeleton Cards Grid */}
    <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
      {[1, 2, 3].map((item) => (
        <div
          key={item}
          className="rounded-2xl border border-slate-200/80 bg-white p-5 shadow-xs animate-pulse flex flex-col justify-between"
        >
          <div>
            {/* Top badges skeleton */}
            <div className="flex justify-between items-center mb-3">
              <div className="h-5 w-20 bg-slate-100 rounded-full" />
              <div className="h-5 w-24 bg-slate-100 rounded-full" />
            </div>

            {/* Merchant info skeleton */}
            <div className="flex items-center gap-3 mb-4">
              <div className="w-11 h-11 rounded-xl bg-slate-100 flex-shrink-0" />
              <div className="flex-1 space-y-1.5">
                <div className="h-4 w-3/4 bg-slate-200 rounded" />
                <div className="h-3 w-1/3 bg-slate-100 rounded" />
              </div>
            </div>

            {/* Offer well skeleton */}
            <div className="p-3.5 rounded-xl bg-slate-50 border border-slate-100 mb-4 space-y-2">
              <div className="h-3.5 w-1/4 bg-indigo-100/60 rounded" />
              <div className="h-4 w-5/6 bg-slate-200 rounded" />
              <div className="h-3 w-full bg-slate-100 rounded" />
            </div>

            {/* Claims bar skeleton */}
            <div className="h-2 w-full bg-slate-100 rounded-full mb-4" />
          </div>

          {/* Action buttons skeleton */}
          <div className="pt-3 border-t border-slate-100 flex gap-2">
            <div className="flex-1 h-9 bg-slate-100 rounded-xl" />
            <div className="flex-1 h-9 bg-indigo-100/70 rounded-xl" />
          </div>
        </div>
      ))}
    </div>
  </div>
);