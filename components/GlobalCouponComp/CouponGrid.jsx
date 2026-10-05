import { CouponCard } from "./CouponCard/CouponCard";

export const CouponGrid = ({
  coupons = [],
  claimingCoupons = {},
  session = true,
  onClaimClick,
  onShowQR,
  userId,
}) => {
  const isCouponClaimed = (couponId) => {
    const coupon = coupons.find((c) => c.id === couponId);
    return coupon?.is_claimed || false;
  };

  return (
    <div className="w-full grid grid-cols-2 md:grid-cols-2 lg:grid-cols-3 gap-2.5 sm:gap-4 md:gap-5">
      {coupons.map((coupon, index) => (
        <CouponCard
          key={coupon.id}
          coupon={coupon}
          index={index}
          isClaimed={isCouponClaimed(coupon.id)}
          claimingStatus={claimingCoupons[coupon.id]}
          session={session}
          onClaimClick={onClaimClick}
          onShowQR={onShowQR}
          userId={userId}
        />
      ))}
    </div>
  );
};