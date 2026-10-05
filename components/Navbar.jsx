'use client';

import { useState, useEffect, useRef } from 'react';
import Link from 'next/link';
import { useRouter, usePathname } from 'next/navigation';
import { supabase } from '@/lib/supabase';

import {
  Menu as MenuIcon,
  X as XIcon,
  User as UserIcon,
  LogOut as LogOutIcon,
  ChevronDown,
  Store,
  TrendingUp,
  Sparkles,
} from 'lucide-react';

import InternalNotifications from './InternalNotifications';

export default function Navbar({ userId }) {
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const [session, setSession] = useState(null);
  const [user, setUser] = useState(null);

  const router = useRouter();
  const pathname = usePathname();
  const profileRef = useRef(null);
  const mobileMenuRef = useRef(null);

  /* CLICK OUTSIDE */
  useEffect(() => {
    function handleClickOutside(event) {
      if (profileRef.current && !profileRef.current.contains(event.target)) setProfileOpen(false);
      if (mobileMenuRef.current && !mobileMenuRef.current.contains(event.target)) setMobileMenuOpen(false);
    }
    document.addEventListener('mousedown', handleClickOutside);
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, []);

  /* SESSION */
  useEffect(() => {
    const fetchSession = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      setSession(session);
      if (session?.user) {
        const { data } = await supabase.from('users').select('*').eq('id', session.user.id).single();
        if (data) setUser(data);
      }
    };
    fetchSession();

    const { data: { subscription } } = supabase.auth.onAuthStateChange(async (_, currentSession) => {
      setSession(currentSession);
      if (currentSession?.user) {
        const { data } = await supabase.from('users').select('*').eq('id', currentSession.user.id).single();
        if (data) setUser(data);
      } else {
        setUser(null);
      }
    });

    return () => subscription?.unsubscribe();
  }, []);

  /* SIGN OUT */
  const handleSignOut = async () => {
    await supabase.auth.signOut();
    setProfileOpen(false);
    router.push('/login');
  };

  /* INVESTOR CHECK */
  const handleBecomeInvestor = async () => {
    if (!userId) { router.push('/auth/signin'); return; }
    try {
      const { data, error } = await supabase.from('investor_profiles').select('id').eq('user_id', userId).maybeSingle();
      if (error) { router.push('/u/profile/apply-for-investor'); return; }
      router.push(data ? '/investors' : '/u/profile/apply-for-investor');
    } catch {
      router.push('/u/profile/apply-for-investor');
    }
    setMobileMenuOpen(false);
  };

  /* BUSINESS CHECK */
  const handleApplyBusiness = async () => {
    if (!userId) { router.push('/auth/signin'); return; }
    try {
      const { data, error } = await supabase.from('businesses').select('id').eq('user_id', userId).maybeSingle();
      if (error) { router.push('/u/profile/apply-for-business'); return; }
      router.push(data ? '/business/dashboard' : '/u/profile/apply-for-business');
    } catch {
      router.push('/u/profile/apply-for-business');
    }
    setMobileMenuOpen(false);
  };

  const navLinks = [
    { href: '/coupons', label: 'Coupons' },
    { href: '/nearby', label: 'Nearby' },
    { href: '/about', label: 'About' },
    { href: '/u/profile', label: 'Profile' },
    { href: '/u/profile/my-coupons', label: 'My Coupons' },
  ];

  return (
    <nav className="sticky top-0 z-50 bg-white/95 backdrop-blur-md border-b border-slate-200/80 shadow-[0_1px_3px_0_rgba(15,23,42,0.03)]">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
        <div className="flex items-center justify-between h-16">

          {/* ── Logo ── */}
          <Link
            href="/"
            className="flex-shrink-0 flex items-center gap-2 group transition"
          >
            <div className="w-8 h-8 rounded-xl bg-gradient-to-tr from-indigo-600 to-violet-500 flex items-center justify-center text-white shadow-sm shadow-indigo-200 group-hover:scale-105 transition-transform">
              <Sparkles size={16} />
            </div>
            <span className="text-xl font-extrabold text-slate-900 tracking-tight group-hover:text-indigo-600 transition-colors">
              Local<span className="text-indigo-600">Grow</span>
            </span>
          </Link>

          {/* ── Desktop Nav Links ── */}
          <div className="hidden lg:flex items-center gap-1.5 text-sm font-medium">
            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3 py-1.5 rounded-xl text-sm font-semibold transition-all ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-600 hover:text-indigo-600 hover:bg-slate-100/70'
                  }`}
                >
                  {label}
                </Link>
              );
            })}
          </div>

          {/* ── Right Actions ── */}
          <div className="flex items-center gap-2 sm:gap-2.5">

            {/* Notifications */}
            {userId && <InternalNotifications userId={userId} />}

            {/* Apply Business — desktop only */}
            <button
              onClick={handleApplyBusiness}
              className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold border border-slate-200
                text-slate-700 bg-white hover:bg-slate-50 hover:border-slate-300 rounded-xl active:scale-[0.98] shadow-sm transition-all"
            >
              <Store size={15} className="text-indigo-600" />
              Business
            </button>

            {/* Become Investor — desktop only */}
            <button
              onClick={handleBecomeInvestor}
              className="hidden lg:flex items-center gap-1.5 px-3.5 py-2 text-xs sm:text-sm font-semibold text-white
                bg-indigo-600 hover:bg-indigo-700 rounded-xl active:scale-[0.98] shadow-sm hover:shadow transition-all"
            >
              <TrendingUp size={15} />
              Investor
            </button>

            {/* Profile Dropdown */}
            {session && (
              <div className="relative" ref={profileRef}>
                <button
                  onClick={() => setProfileOpen(!profileOpen)}
                  className="flex items-center gap-1.5 p-1 rounded-xl hover:bg-slate-100/80 active:scale-95 transition-all"
                  aria-label="Profile menu"
                >
                  <div className="w-8 h-8 rounded-full bg-gradient-to-tr from-indigo-600 to-violet-500 text-white flex items-center justify-center ring-2 ring-indigo-100 shadow-sm">
                    <UserIcon size={15} />
                  </div>
                  <ChevronDown size={14} className={`hidden sm:block transition-transform text-slate-500 ${profileOpen ? 'rotate-180' : ''}`} />
                </button>

                {profileOpen && (
                  <div className="absolute right-0 mt-2 w-56 bg-white rounded-2xl shadow-xl border border-slate-100 divide-y divide-slate-100 overflow-hidden z-50 animate-in fade-in zoom-in-95 duration-150">
                    <div className="px-4 py-3 bg-slate-50/70">
                      <p className="font-bold text-sm text-slate-900 truncate">
                        {user?.username || user?.full_name || 'User'}
                      </p>
                      <p className="text-xs text-slate-500 truncate mt-0.5">
                        {user?.email || session?.user?.email}
                      </p>
                    </div>
                    <div className="py-1">
                      <Link
                        href="/u/profile"
                        className="flex items-center gap-2 px-4 py-2.5 text-sm text-slate-700 hover:bg-slate-50 hover:text-indigo-600 transition"
                        onClick={() => setProfileOpen(false)}
                      >
                        <UserIcon size={15} />
                        Profile
                      </Link>
                    </div>
                    <div className="py-1">
                      <button
                        onClick={handleSignOut}
                        className="flex items-center gap-2 w-full px-4 py-2.5 text-sm text-rose-600 hover:bg-rose-50 transition"
                      >
                        <LogOutIcon size={15} />
                        Sign Out
                      </button>
                    </div>
                  </div>
                )}
              </div>
            )}

            {/* Hamburger for mobile */}
            <button
              onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
              className="lg:hidden p-2 rounded-xl text-slate-700 hover:bg-slate-100 active:scale-95 transition-all"
              aria-label="Toggle menu"
            >
              {mobileMenuOpen ? <XIcon size={22} /> : <MenuIcon size={22} />}
            </button>

          </div>
        </div>
      </div>

      {/* ── Mobile / Tablet Dropdown Menu ── */}
      {mobileMenuOpen && (
        <div
          ref={mobileMenuRef}
          className="lg:hidden border-t border-slate-100 bg-white shadow-xl animate-in slide-in-from-top-2 duration-150"
        >
          <div className="max-w-7xl mx-auto px-4 py-3 flex flex-col gap-1">

            {navLinks.map(({ href, label }) => {
              const isActive = pathname === href || (href !== '/' && pathname?.startsWith(href));
              return (
                <Link
                  key={href}
                  href={href}
                  className={`px-3.5 py-2.5 text-sm font-semibold rounded-xl transition ${
                    isActive
                      ? 'bg-indigo-50 text-indigo-700'
                      : 'text-slate-700 hover:bg-slate-50 hover:text-indigo-600'
                  }`}
                  onClick={() => setMobileMenuOpen(false)}
                >
                  {label}
                </Link>
              );
            })}

            <div className="h-px bg-slate-100 my-2" />

            <div className="flex gap-2 pb-2 sm:hidden">
              <button
                onClick={handleApplyBusiness}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold
                  border border-slate-200 text-slate-700 bg-white rounded-xl hover:bg-slate-50
                  active:scale-95 transition-all shadow-sm"
              >
                <Store size={15} className="text-indigo-600" />
                Business
              </button>
              <button
                onClick={handleBecomeInvestor}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold
                  bg-indigo-600 text-white rounded-xl hover:bg-indigo-700
                  active:scale-95 transition-all shadow-sm"
              >
                <TrendingUp size={15} />
                Investor
              </button>
            </div>

            {/* Show Business/Investor in menu for sm–lg */}
            <div className="hidden sm:flex gap-2 pb-2">
              <button
                onClick={handleApplyBusiness}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold
                  border border-slate-200 text-slate-700 bg-white rounded-xl hover:bg-slate-50
                  active:scale-95 transition-all shadow-sm"
              >
                <Store size={15} className="text-indigo-600" />
                Apply Business
              </button>
              <button
                onClick={handleBecomeInvestor}
                className="flex-1 flex items-center justify-center gap-1.5 py-2.5 text-xs font-semibold
                  bg-indigo-600 text-white rounded-xl hover:bg-indigo-700
                  active:scale-95 transition-all shadow-sm"
              >
                <TrendingUp size={15} />
                Become Investor
              </button>
            </div>

          </div>
        </div>
      )}
    </nav>
  );
}