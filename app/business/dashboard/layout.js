'use client';

import React, { useState, useEffect } from 'react';
import { usePathname, useRouter } from 'next/navigation';
import Sidebar from './_components/Sidebar';
import VendorBottomBar from '@/components/VendorBottomBar';
import { getUserId } from '@/helpers/userHelper';
import { LanguageProvider } from '@/context/LanguageContext';

export default function DashboardLayout({ children }) {
    const pathname = usePathname();
    const router = useRouter();

    const getActivePageFromPath = (path) => {
        const segments = path.split('/');
        const lastSegment = segments[segments.length - 1];
        return lastSegment === 'dashboard' ? 'dashboard' : lastSegment;
    };

    const [isSidebarOpen, setIsSidebarOpen] = useState(false);
    const [userId, setUserId] = useState(null);
    const [isLoading, setIsLoading] = useState(true);
    const [activePage, setActivePage] = useState(() => getActivePageFromPath(pathname));

    useEffect(() => {
        const fetchUserId = async () => {
            try {
                const id = await getUserId();

                if (!id || id?.msg) {
                    setUserId(null);
                    setIsLoading(false);
                    return;
                }

                // Check business approval status and existence before showing dashboard
                try {
                    const res = await fetch('/api/vendors/my-business')
                    const data = await res.json()

                    if (!data?.data) {
                        router.push('/u/profile/apply-for-business')
                        return
                    }

                    if (data?.data?.status === 'pending') {
                        router.push('/business/pending')
                        return
                    }

                    if (data?.data?.status === 'rejected') {
                        router.push('/business/rejected')
                        return
                    }

                    if (data?.data?.status !== 'approved') {
                        router.push('/u/profile/apply-for-business')
                        return
                    }
                } catch (statusError) {
                    // If status check fails, still allow access
                    // Don't block the dashboard for a network error
                    console.error('Error checking business status:', statusError);
                }

                setUserId(id);

            } catch (error) {
                console.error('Error fetching user ID:', error);
                setUserId(null);
            } finally {
                setIsLoading(false);
            }
        };

        fetchUserId();
    }, []);

    useEffect(() => {
        setActivePage(getActivePageFromPath(pathname));
    }, [pathname]);

    const toggleSidebar = () => {
        setIsSidebarOpen(!isSidebarOpen);
    };

    const handlePageChange = (pageId) => {
        setActivePage(pageId);

        if (pageId === 'dashboard') {
            router.push('/business/dashboard');
        } else {
            router.push(`/business/dashboard/${pageId}`);
        }

        if (window.innerWidth < 768) {
            setIsSidebarOpen(false);
        }
    };

    return (
        <LanguageProvider>
            {isLoading ? (
                <div className="flex items-center justify-center h-screen" style={{ backgroundColor: '#df6824' }}>
                    <div className="text-center">
                        <div className="animate-spin w-12 h-12 border-4 border-black border-t-white rounded-full mx-auto mb-4"></div>
                        <p className="text-lg font-bold text-black">Loading dashboard...</p>
                    </div>
                </div>
            ) : !userId ? (
                <div className="flex items-center justify-center h-screen" style={{ backgroundColor: '#df6824' }}>
                    <div className="text-center p-8 bg-white border-4 border-black shadow-[8px_8px_0px_0px_rgba(0,0,0,1)]">
                        <p className="text-xl font-bold text-gray-700 mb-4">Access Denied</p>
                        <p className="text-gray-600 mb-6">Please log in to view the dashboard.</p>
                        <button
                            onClick={() => router.push('/auth/signin')}
                            style={{ backgroundColor: '#df6824' }}
                            className="px-6 py-3 border-4 border-black font-bold shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] hover:shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] hover:translate-x-[2px] hover:translate-y-[2px] transition-all duration-150 text-black"
                        >
                            Go to Login
                        </button>
                    </div>
                </div>
            ) : (
                <div className="flex h-screen bg-gray-100">
                    {isSidebarOpen && (
                        <div
                            className="md:hidden fixed inset-0 bg-black bg-opacity-50 z-40"
                            onClick={toggleSidebar}
                        ></div>
                    )}

                    <Sidebar
                        isSidebarOpen={isSidebarOpen}
                        toggleSidebar={toggleSidebar}
                        activePage={activePage}
                        setActivePage={handlePageChange}
                    />

                    <div className="flex-1 flex flex-col overflow-hidden">
                        <main className="flex-1 overflow-x-hidden overflow-y-auto bg-gray-100 p-3 sm:p-4 md:p-6 pb-24 md:pb-6">
                            {children}
                        </main>
                        <VendorBottomBar />
                    </div>
                </div>
            )}
        </LanguageProvider>
    );
}