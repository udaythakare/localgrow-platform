'use client';

import React, { useState, useEffect } from 'react';
import { ListCheck, MapPin, Tag, User } from 'lucide-react';
import { useRouter, usePathname } from 'next/navigation';

export default function MobileBottomNav() {
  const router = useRouter();
  const pathname = usePathname();
  const [activeTab, setActiveTab] = useState('');

  const navItems = [
    { id: '/coupons',              icon: Tag,       label: 'Deals'      },
    { id: '/nearby',               icon: MapPin,    label: 'Nearby'     },
    { id: '/u/profile/my-coupons', icon: ListCheck, label: 'My Coupons' },
    { id: '/u/profile',            icon: User,      label: 'Profile'    },
  ];

  useEffect(() => {
    const matchingItem = navItems.find(item =>
      pathname === item.id || (item.id !== '/' && pathname?.startsWith(`${item.id}/`))
    );
    if (matchingItem) {
      setActiveTab(matchingItem.id);
    }
  }, [pathname]);

  const handleTabChange = (id) => {
    setActiveTab(id);
    router.push(id);
  };

  return (
    <div
      className="fixed bottom-0 left-0 right-0 md:hidden z-40 bg-white/95 backdrop-blur-xl border-t border-slate-200/80 shadow-[0_-4px_20px_rgba(15,23,42,0.04)]"
      style={{
        paddingBottom: 'env(safe-area-inset-bottom, 0px)',
      }}
    >
      <div className="flex items-center justify-around px-3 py-2">
        {navItems.map((item) => {
          const isActive = activeTab === item.id;
          return (
            <button
              key={item.id}
              onClick={() => handleTabChange(item.id)}
              className="flex-1 flex flex-col items-center justify-center gap-1 py-1 active:scale-95 transition-all duration-150"
            >
              {/* Pill capsule */}
              <div
                className={`
                  flex items-center justify-center
                  w-12 h-7 rounded-full transition-all duration-200
                  ${isActive ? 'bg-indigo-50 text-indigo-600' : 'bg-transparent text-slate-500'}
                `}
              >
                <item.icon
                  size={18}
                  strokeWidth={isActive ? 2.3 : 1.7}
                  className={isActive ? 'text-indigo-600' : 'text-slate-500'}
                />
              </div>

              {/* Label */}
              <span
                className={`
                  text-[11px] leading-tight transition-colors duration-200
                  ${isActive ? 'font-bold text-indigo-600' : 'font-medium text-slate-500'}
                `}
              >
                {item.label}
              </span>
            </button>
          );
        })}
      </div>
    </div>
  );
}