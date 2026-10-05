import React from 'react';
import { X, Ticket } from 'lucide-react';

/**
 * ConfirmationModal
 * Modern modal dialog for confirming customer actions (such as coupon claiming).
 * Features smooth elevation, rounded-2xl geometry, and clean slate typography.
 */
export const ConfirmationModal = ({
  isOpen,
  onClose,
  onConfirm,
  coupon,
  title = "Confirm Action",
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  showCancel = true,
}) => {
  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-slate-900/60 backdrop-blur-sm transition-opacity animate-in fade-in duration-200"
        onClick={onClose}
        aria-hidden="true"
      />

      {/* Modal Dialog Card */}
      <div
        role="dialog"
        aria-modal="true"
        aria-labelledby="modal-headline"
        className="relative w-full max-w-sm sm:max-w-md bg-white rounded-2xl border border-slate-100 shadow-2xl overflow-hidden z-10 animate-in zoom-in-95 duration-200"
      >
        {/* Header */}
        <div className="px-6 pt-6 pb-3 flex items-center justify-between border-b border-slate-100">
          <h2 id="modal-headline" className="text-lg font-bold text-slate-900 leading-snug">
            {title}
          </h2>
          <button
            type="button"
            onClick={onClose}
            className="p-1.5 rounded-full text-slate-400 hover:text-slate-600 hover:bg-slate-100 transition"
            aria-label="Close dialog"
          >
            <X size={18} />
          </button>
        </div>

        {/* Content Body */}
        <div className="p-6">
          {message && (
            <p className="text-sm text-slate-600 leading-relaxed mb-4">
              {message}
            </p>
          )}

          {/* Coupon summary card if provided */}
          {coupon && (
            <div className="rounded-xl p-3.5 bg-indigo-50/60 border border-indigo-100 mb-5">
              <div className="flex items-center gap-1.5 text-xs font-semibold text-indigo-700 mb-1">
                <Ticket size={14} />
                <span>Selected Offer</span>
              </div>
              <h3 className="font-bold text-sm sm:text-base text-slate-900 leading-snug mb-1">
                {coupon.title}
              </h3>
              {coupon.description && (
                <p className="text-xs text-slate-600 line-clamp-2 mb-2">
                  {coupon.description}
                </p>
              )}
              {coupon.discount && (
                <span className="inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-bold bg-emerald-100 text-emerald-800">
                  {coupon.discount}
                </span>
              )}
            </div>
          )}

          {/* Action buttons */}
          <div className="flex flex-col sm:flex-row-reverse gap-2.5 pt-2">
            <button
              type="button"
              onClick={onConfirm}
              className="w-full sm:flex-1 bg-indigo-600 hover:bg-indigo-700 active:scale-[0.98] text-white font-semibold py-2.5 px-4 rounded-xl shadow-sm transition text-center text-sm"
            >
              {confirmText}
            </button>

            {showCancel && (
              <button
                type="button"
                onClick={onClose}
                className="w-full sm:flex-1 bg-slate-100 hover:bg-slate-200 active:scale-[0.98] text-slate-700 font-semibold py-2.5 px-4 rounded-xl transition text-center text-sm"
              >
                {cancelText}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
