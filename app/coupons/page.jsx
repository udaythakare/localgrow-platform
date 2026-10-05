import GlobalCouponSection from "@/components/GlobalCouponSection";
import NotificationToggle from "@/components/NotificationToggle";
import { getUserId } from "@/helpers/userHelper";
import Link from "next/link";
import { Sparkles, ArrowDown, ShieldCheck, Store, Users } from "lucide-react";

export default async function CouponPage() {
  const userId = await getUserId();

  return (
    <div className="min-h-screen bg-[#f8fafc]">

      {/* ================= HERO DISCOVERY BANNER ================= */}
      <section className="relative w-full overflow-hidden bg-gradient-to-b from-slate-950 via-indigo-950 to-slate-900 text-white py-14 sm:py-20 lg:py-24">
        {/* Subtle background glow effects */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden opacity-30">
          <div className="absolute -top-32 -left-32 w-96 h-96 bg-indigo-500 rounded-full blur-[128px]" />
          <div className="absolute -bottom-32 -right-32 w-96 h-96 bg-violet-600 rounded-full blur-[128px]" />
        </div>

        <div className="relative z-10 max-w-5xl mx-auto px-4 sm:px-6 lg:px-8 text-center">

          {/* Top Deal Pill */}
          <div className="inline-flex items-center gap-2 px-3.5 py-1.5 rounded-full bg-white/10 border border-white/15 backdrop-blur-md text-xs sm:text-sm font-semibold text-indigo-200 mb-6 shadow-sm">
            <Sparkles size={14} className="text-amber-300 animate-pulse" />
            <span>Verified Local Discounts Added Daily</span>
          </div>

          {/* Heading */}
          <h1 className="text-3xl sm:text-5xl lg:text-6xl font-extrabold leading-[1.15] tracking-tight text-white max-w-4xl mx-auto">
            Discover The Best{" "}
            <span className="bg-gradient-to-r from-indigo-300 via-purple-300 to-amber-200 bg-clip-text text-transparent">
              Local Deals
            </span>{" "}
            Near You
          </h1>

          {/* Subtext */}
          <p className="mt-4 sm:mt-5 text-slate-300 max-w-2xl mx-auto text-sm sm:text-base md:text-lg leading-relaxed font-normal">
            Claim instant digital coupons from top neighborhood merchants. Save money on dining, shopping, and everyday services while supporting local shops.
          </p>

          {/* CTA Buttons */}
          <div className="mt-8 flex justify-center items-center gap-3 flex-wrap">
            <Link
              href="#coupons"
              className="inline-flex items-center gap-2 px-6 sm:px-7 py-3 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold rounded-xl shadow-lg shadow-indigo-600/30 transition-all text-sm sm:text-base"
            >
              <span>Explore Deals</span>
              <ArrowDown size={16} />
            </Link>
            <Link
              href="/about"
              className="inline-flex items-center px-6 sm:px-7 py-3 border border-white/20 hover:border-white/40 hover:bg-white/10 active:scale-[0.98] text-white font-medium rounded-xl backdrop-blur-sm transition-all text-sm sm:text-base"
            >
              Learn More
            </Link>
          </div>

          {/* Marketplace Stats Row */}
          <div className="mt-12 sm:mt-16 grid grid-cols-3 gap-3 sm:gap-6 max-w-2xl mx-auto pt-8 border-t border-white/10">
            <div className="flex flex-col items-center">
              <div className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                Daily
              </div>
              <div className="text-slate-400 text-xs sm:text-sm font-medium mt-0.5">
                Fresh Offers
              </div>
            </div>

            <div className="flex flex-col items-center border-x border-white/10">
              <div className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                150+
              </div>
              <div className="text-slate-400 text-xs sm:text-sm font-medium mt-0.5">
                Verified Stores
              </div>
            </div>

            <div className="flex flex-col items-center">
              <div className="text-xl sm:text-3xl font-extrabold text-white tracking-tight">
                10K+
              </div>
              <div className="text-slate-400 text-xs sm:text-sm font-medium mt-0.5">
                Happy Savers
              </div>
            </div>
          </div>

        </div>
      </section>

      {/* ================= NOTIFICATIONS TOAST/BANNER ================= */}
      <NotificationToggle />

      {/* ================= MAIN COUPON SECTION ================= */}
      <div id="coupons" className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 mt-6 sm:mt-8 pb-24 md:pb-12">
        <GlobalCouponSection userId={userId} />
      </div>

    </div>
  );
}