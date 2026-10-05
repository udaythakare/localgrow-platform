import React from 'react';
import { Plus_Jakarta_Sans } from 'next/font/google';

const plusJakartaSans = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700', '800'],
  variable: '--font-customer-sans',
  display: 'swap',
});

/**
 * CustomerThemeWrapper
 * - Scopes the modern Plus Jakarta Sans font strictly to customer pages.
 * - Leaves global JetBrains Mono configuration untouched for vendor & admin routes.
 * - Masks the global DotBackground canvas with solid bg-[#f8fafc].
 * - Provides the base layout shell and customer tokens for customer views.
 */
export default function CustomerThemeWrapper({ children, className = '' }) {
  return (
    <div
      className={`${plusJakartaSans.variable} font-sans customer-theme relative z-10 min-h-screen bg-[#f8fafc] text-slate-900 antialiased ${className}`}
      style={{
        fontFamily: `var(--font-customer-sans), -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif`,
      }}
    >
      {children}
    </div>
  );
}
