'use client';

import { useState } from 'react';
import QRScanner from './components/QRScanner';
import { getCouponById } from '../coupons/actions/couponActions';
import { getCouponStatus, getUserData } from '@/helpers/userHelper';
import { acceptCoupon } from './actions/requestCouponAction';
import { useLanguage } from '@/context/LanguageContext';

export default function ScanPage() {

    const { t } = useLanguage();

    const [scanHistory, setScanHistory] = useState([]);
    const [couponData, setCouponData] = useState(null);
    const [userData, setUserData] = useState(null);
    const [loading, setLoading] = useState(false);
    const [showCouponCard, setShowCouponCard] = useState(false);
    const [isRedeemed, setIsRedeemed] = useState(false);
    const [isExpired, setIsExpired] = useState(false);
    const [validUntilDate, setValidUntilDate] = useState(null);

    const handleQRDetected = async (value) => {
        try {
            setLoading(true);

            setScanHistory(prev => [
                { value, timestamp: new Date().toLocaleString() },
                ...prev
            ]);

            const data = JSON.parse(value);
            const couponId = data.couponId;
            const userId = data.userId;

            const fetchedCouponData = await getCouponById(couponId);
            const fetchedUserData = await getUserData(userId);
            const fetchCouponStatus = await getCouponStatus(couponId, userId);

            const isAlreadyRedeemed = fetchCouponStatus?.couponStatus?.coupon_status === "redeemed";
            const isCampaignExpired = fetchedCouponData?.end_date
                ? new Date(fetchedCouponData.end_date).getTime() < Date.now()
                : false;

            setValidUntilDate(fetchedCouponData?.end_date || null);
            setIsRedeemed(isAlreadyRedeemed);
            setIsExpired(isCampaignExpired);

            setCouponData(fetchedCouponData);
            setUserData(fetchedUserData?.user || null);

            setShowCouponCard(true);
        } catch (error) {
            console.error("Error processing QR code:", error);
        } finally {
            setLoading(false);
        }
    };

    const handleAccept = async () => {
        if (!couponData?.id || !userData?.id) {
            alert("Missing coupon or customer information");
            return;
        }

        const response = await acceptCoupon(couponData.id, userData.id);

        if (!response.success) {
            alert(response.error || t?.scanner?.acceptError || "Error accepting coupon");
            return;
        }

        alert(t?.scanner?.acceptSuccess ?? "Coupon accepted successfully!");
        setShowCouponCard(false);
    };

    return (

        <main className="flex min-h-screen flex-col items-center p-6 bg-gray-100">

            <h1 className="text-4xl font-black mt-6 mb-10 text-black tracking-tight transform -rotate-1">

                {t?.scanner?.title ?? "QR CODE SCANNER"}

            </h1>

            <QRScanner onDetected={handleQRDetected} />

            {loading && (

                <div className="mt-8 flex items-center justify-center">

                    <div className="animate-spin h-16 w-16 border-4 border-black"></div>

                </div>

            )}

            {showCouponCard && couponData && userData && (

                <div className="mt-8 w-full max-w-md bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)] overflow-hidden transform rotate-1">

                    <div className="p-6">

                        <h2 className="text-3xl font-black text-black transform -rotate-1">

                            {couponData.title}

                        </h2>

                        <p className="text-black font-bold mt-2">

                            {couponData.description}

                        </p>

                        <div className="mt-6 space-y-3">

                            <div className="flex justify-between font-bold">

                                <span>

                                    {t?.scanner?.validUntil ?? "Valid Until"}

                                </span>

                                <span className="font-black bg-[#df6824] px-2 py-1 border-2 border-black transform rotate-1">

                                    {validUntilDate
                                        ? new Date(validUntilDate).toLocaleString()
                                        : (t?.scanner?.processing ?? "Processing...")}

                                </span>

                            </div>

                            <div className="flex justify-between font-bold">

                                <span>

                                    {t?.scanner?.couponType ?? "Coupon Type"}

                                </span>

                                <span className="font-black bg-[#df6824] px-2 py-1 border-2 border-black transform -rotate-1">

                                    {t?.scanner?.redeemAtStore ?? "Redeem at Store"}

                                </span>

                            </div>

                            {isRedeemed ? (
                                <div className="flex justify-between font-bold">
                                    <span>
                                        {t?.scanner?.status ?? "Status"}
                                    </span>
                                    <span className="font-black bg-black text-white px-2 py-1 border-2 border-black transform -rotate-2">
                                        {t?.scanner?.alreadyRedeemed ?? "Already Redeemed"}
                                    </span>
                                </div>
                            ) : isExpired ? (
                                <div className="flex justify-between font-bold">
                                    <span>
                                        {t?.scanner?.status ?? "Status"}
                                    </span>
                                    <span className="font-black bg-red-600 text-white px-2 py-1 border-2 border-black transform -rotate-2">
                                        Campaign Expired
                                    </span>
                                </div>
                            ) : (
                                <div className="flex justify-between font-bold">
                                    <span>
                                        {t?.scanner?.status ?? "Status"}
                                    </span>
                                    <span className="font-black bg-emerald-600 text-white px-2 py-1 border-2 border-black transform -rotate-1">
                                        Valid & Claimed
                                    </span>
                                </div>
                            )}

                        </div>

                        <div className="mt-6 pt-4 border-t-4 border-black">

                            <h3 className="font-black text-xl">

                                {t?.scanner?.userDetails ?? "User Details"}

                            </h3>

                            <p className="font-bold mt-2">

                                {userData.full_name}

                            </p>

                            <p className="font-bold">

                                {userData.email}

                            </p>

                        </div>

                        {isRedeemed ? (
                            <div className="mt-6 w-full bg-black text-white font-black py-4 px-6 border-4 border-black flex justify-center items-center text-xl uppercase">
                                {t?.scanner?.alreadyRedeemed ?? "Coupon Already Redeemed"}
                            </div>
                        ) : isExpired ? (
                            <div className="mt-6 w-full bg-red-600 text-white font-black py-4 px-6 border-4 border-black flex justify-center items-center text-xl uppercase">
                                Campaign Expired — Cannot Redeem
                            </div>
                        ) : (
                            <button
                                onClick={handleAccept}
                                className="mt-6 w-full bg-[#df6824] text-black font-black py-4 px-6 border-4 border-black shadow-[5px_5px_0px_0px_rgba(0,0,0,1)] hover:translate-y-1 hover:translate-x-1 hover:shadow-[3px_3px_0px_0px_rgba(0,0,0,1)] transition-all text-xl uppercase"
                            >
                                {t?.scanner?.acceptCoupon ?? "Accept Coupon"}
                            </button>
                        )}

                    </div>

                </div>

            )}

            <div className="mt-12 text-center">

                <p className="text-black font-bold text-lg transform rotate-1">

                    {t?.scanner?.instructionDesktop ?? "This scanner works on desktop and mobile"}

                </p>

                <p className="text-black font-bold text-lg transform -rotate-1">

                    {t?.scanner?.allowCamera ?? "Allow camera permission to scan QR codes"}

                </p>

            </div>

        </main>
    );
}