'use client';

import React from 'react';

export const RADIUS_OPTIONS = [
  { value: 0.5, label: '500 m' },
  { value: 1, label: '1 km' },
  { value: 2, label: '2 km' },
  { value: 3, label: '3 km' },
  { value: 4, label: '4 km' },
  { value: 5, label: '5 km' },
  { value: 6, label: '6 km' },
  { value: 7, label: '7 km' },
  { value: 8, label: '8 km' },
  { value: 9, label: '9 km' },
  { value: 10, label: '10 km' },
];

export default function RadiusSelector({ value = 2, onChange }) {
  return (
    <div className="w-full my-4">
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs sm:text-sm font-bold uppercase tracking-wider text-slate-700">
          Radius: <span className="text-indigo-600">{RADIUS_OPTIONS.find(o => o.value === value)?.label || `${value} km`}</span>
        </label>
        <span className="text-xs text-slate-500 font-medium hidden sm:inline">
          Scroll for more distances
        </span>
      </div>

      {/* 
        Horizontal scrollable chip bar with safe mobile margins and smooth scrolling.
        Zero horizontal page overflow.
      */}
      <div
        role="radiogroup"
        aria-label="Search radius"
        className="flex items-center gap-2 overflow-x-auto pb-2 pt-1 px-1 scroll-smooth [-ms-overflow-style:none] [scrollbar-width:none] [&::-webkit-scrollbar]:hidden"
      >
        {RADIUS_OPTIONS.map((option) => {
          const isSelected = option.value === value;

          return (
            <button
              key={option.value}
              type="button"
              role="radio"
              aria-checked={isSelected}
              aria-label={`Radius ${option.label}`}
              onClick={() => onChange(option.value)}
              className={`
                flex-shrink-0 px-3 py-1.5 rounded-full text-xs sm:text-sm font-semibold
                border transition-all duration-150 cursor-pointer
                ${
                  isSelected
                    ? 'bg-indigo-600 border-indigo-600 text-white shadow-sm'
                    : 'bg-white border-slate-200 text-slate-700 hover:bg-slate-50 hover:border-slate-300 shadow-sm active:scale-95'
                }
              `}
            >
              {option.label}
            </button>
          );
        })}
      </div>
    </div>
  );
}
