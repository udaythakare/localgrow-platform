'use client';

import { useState, useEffect } from 'react';
import { Bell, X } from 'lucide-react';
import {
  setupPushNotifications,
  disablePushNotifications,
  checkSubscriptionStatus,
} from '@/lib/push-notifications';

export default function NotificationToggle() {
  const [showPermissionRequest, setShowPermissionRequest] = useState(false);
  const [isLoading, setIsLoading] = useState(false);

  useEffect(() => {
    checkNotificationPermissionPeriodically();
  }, []);

  const checkNotificationPermissionPeriodically = async () => {
    try {
      if (!('Notification' in window)) {
        return;
      }

      const permission = Notification.permission;
      if (permission !== 'granted') {
        const shouldShowPrompt = shouldShowNotificationPrompt();
        if (shouldShowPrompt) {
          setShowPermissionRequest(true);
        }
      }
    } catch (err) {
      console.error('Error checking notification permission:', err);
    }
  };

  const shouldShowNotificationPrompt = () => {
    const PROMPT_INTERVAL = 24 * 60 * 60 * 1000;
    const STORAGE_KEY = 'lastNotificationPrompt';
    const DISMISS_KEY = 'notificationPromptDismissed';

    try {
      const lastPrompt = parseInt(localStorage.getItem(STORAGE_KEY) || '0');
      const wasDismissed = localStorage.getItem(DISMISS_KEY);
      const now = Date.now();

      if (wasDismissed && (now - parseInt(wasDismissed)) < PROMPT_INTERVAL) {
        return false;
      }

      if (now - lastPrompt > PROMPT_INTERVAL) {
        localStorage.setItem(STORAGE_KEY, now.toString());
        return true;
      }

      return false;
    } catch {
      return true;
    }
  };

  const requestNotificationPermission = async () => {
    try {
      setIsLoading(true);
      const permission = await Notification.requestPermission();

      if (permission === 'granted') {
        await setupPushNotifications();
        setShowPermissionRequest(false);
        localStorage.removeItem('notificationPromptDismissed');
      } else {
        setShowPermissionRequest(false);
      }
    } catch (err) {
      console.error('Error requesting notification permission:', err);
    } finally {
      setIsLoading(false);
    }
  };

  const dismissPrompt = () => {
    setShowPermissionRequest(false);
    try {
      localStorage.setItem('notificationPromptDismissed', Date.now().toString());
    } catch (err) {
      console.error('Error storing dismiss timestamp:', err);
    }
  };

  if (!showPermissionRequest) {
    return null;
  }

  return (
    <div className="fixed top-20 right-4 sm:right-6 z-50 max-w-sm w-full bg-white rounded-2xl border border-slate-200/90 shadow-xl p-5 animate-in slide-in-from-top-4 duration-300">
      <div className="flex items-start justify-between gap-3 mb-2">
        <div className="flex items-center gap-2.5">
          <div className="w-8 h-8 rounded-xl bg-indigo-50 text-indigo-600 flex items-center justify-center flex-shrink-0">
            <Bell size={16} />
          </div>
          <h4 className="text-sm font-bold text-slate-900 leading-snug">
            Stay Updated on Deals
          </h4>
        </div>
        <button
          type="button"
          onClick={dismissPrompt}
          className="text-slate-400 hover:text-slate-600 p-1 rounded-lg hover:bg-slate-100 transition"
          aria-label="Dismiss notifications prompt"
        >
          <X size={16} />
        </button>
      </div>

      <p className="text-xs text-slate-600 leading-relaxed mb-4 ml-10">
        Get instant alerts about new coupons, flash discounts, and exclusive offers from your favorite local shops.
      </p>

      <div className="flex items-center justify-end gap-2">
        <button
          type="button"
          onClick={dismissPrompt}
          className="px-3.5 py-1.5 text-xs font-semibold text-slate-600 hover:text-slate-800 hover:bg-slate-100 rounded-xl transition"
        >
          Not now
        </button>
        <button
          type="button"
          onClick={requestNotificationPermission}
          disabled={isLoading}
          className="px-4 py-1.5 text-xs font-semibold text-white bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] rounded-xl shadow-sm transition disabled:opacity-50"
        >
          {isLoading ? 'Setting up...' : 'Allow Alerts'}
        </button>
      </div>
    </div>
  );
}