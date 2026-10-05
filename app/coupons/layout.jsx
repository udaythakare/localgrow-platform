import CustomerThemeWrapper from "@/components/customer/CustomerThemeWrapper";
import MobileBottomNav from "@/components/BottomBar";
import Navbar from "@/components/Navbar";
import { getUserId } from "@/helpers/userHelper";

const CouponLayout = async ({ children }) => {
    const userId = await getUserId();

    if (!userId) {
        return (
            <CustomerThemeWrapper className="flex items-center justify-center min-h-screen px-4">
                <p className="text-slate-500 text-sm sm:text-base text-center font-medium">
                    Please log in to view coupons.
                </p>
            </CustomerThemeWrapper>
        );
    }

    return (
        <CustomerThemeWrapper>
            <Navbar userId={userId} />

            {/* 
                pb-20  → clears fixed bottom nav on mobile / PWA 
                md:pb-0 → no bottom nav on desktop
            */}
            <main className="pb-24 md:pb-6">
                {children}
            </main>

            <MobileBottomNav />
        </CustomerThemeWrapper>
    );
};

export default CouponLayout;