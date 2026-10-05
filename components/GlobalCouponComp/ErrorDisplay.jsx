import React from 'react';
import { X, AlertCircle } from 'lucide-react';

export const ErrorDisplay = ({ error, onClose }) => {
  if (!error) return null;

  return (
    <div className="mb-6 p-4 bg-rose-50 border border-rose-200/80 rounded-2xl text-rose-800 shadow-xs flex items-center justify-between gap-3 text-sm">
      <div className="flex items-center gap-2.5 min-w-0">
        <AlertCircle size={18} className="text-rose-500 flex-shrink-0" />
        <span className="font-medium truncate">{error}</span>
      </div>
      <button
        type="button"
        onClick={onClose}
        className="p-1 rounded-lg text-rose-400 hover:text-rose-700 hover:bg-rose-100 transition flex-shrink-0"
        aria-label="Dismiss error"
      >
        <X size={16} />
      </button>
    </div>
  );
};