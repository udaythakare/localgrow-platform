import Navbar from "@/components/Navbar";
import MobileBottomNav from "@/components/BottomBar";
import NearbySection from "@/components/nearby/NearbySection";
import { getUserId } from "@/helpers/userHelper";

export const metadata = {
  title: "Nearby Businesses - LocalGrow",
  description: "Find verified local businesses and stores near your current location with LocalGrow.",
};

export default async function NearbyPage() {
  const rawUserId = await getUserId();
  const userId = typeof rawUserId === 'string' ? rawUserId : null;

  return (
    <div className="min-h-screen bg-[#f6f6fb]">
      <Navbar userId={userId} />
      <main className="pb-24 md:pb-6">
        <NearbySection />
      </main>
      <MobileBottomNav />
    </div>
  );
}
