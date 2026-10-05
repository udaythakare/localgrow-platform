'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Camera, ChevronLeft, ChevronRight, Image as ImageIcon } from 'lucide-react';
import {
  sanitizeGalleryPhotos,
  resolveSelectedPhoto
} from '@/helpers/businessDetailsHelpers';

/**
 * Customer-Facing Business Photo Gallery Component
 *
 * Displays an interactive image viewer with a large active photo,
 * photo caption banner, and responsive thumbnail navigation strip.
 * Returns null if no photos are available.
 */
export default function BusinessPhotoGallery({ photos = [], businessName = 'Store' }) {
  const [selectedIndex, setSelectedIndex] = useState(0);

  const sanitizedPhotos = sanitizeGalleryPhotos(photos);
  const totalCount = sanitizedPhotos.length;

  // Reset selected index if photos change
  useEffect(() => {
    setSelectedIndex(0);
  }, [photos]);

  const { selectedPhoto, currentIndex } = resolveSelectedPhoto(sanitizedPhotos, selectedIndex);

  const handlePrev = useCallback(() => {
    if (totalCount <= 1) return;
    setSelectedIndex((prev) => (prev - 1 + totalCount) % totalCount);
  }, [totalCount]);

  const handleNext = useCallback(() => {
    if (totalCount <= 1) return;
    setSelectedIndex((prev) => (prev + 1) % totalCount);
  }, [totalCount]);

  // Keyboard navigation support
  const handleKeyDown = useCallback(
    (e) => {
      if (e.key === 'ArrowLeft') {
        handlePrev();
      } else if (e.key === 'ArrowRight') {
        handleNext();
      }
    },
    [handlePrev, handleNext]
  );

  // Return null gracefully if there are no photos
  if (!sanitizedPhotos || sanitizedPhotos.length === 0 || !selectedPhoto) {
    return null;
  }

  return (
    <section
      aria-label="Store photo gallery"
      onKeyDown={handleKeyDown}
      tabIndex={0}
      className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden focus:outline-none focus:ring-2 focus:ring-indigo-500/20"
    >
      {/* ── Gallery Header ─────────────────────────────────────────── */}
      <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100">
        <div className="flex items-center gap-2">
          <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
            <Camera size={16} />
          </div>
          <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
            Store Gallery
          </h2>
        </div>

        <span className="text-[11px] sm:text-xs font-semibold px-2.5 py-0.5 rounded-full bg-slate-100 text-slate-600 border border-slate-200/70">
          {currentIndex + 1} of {totalCount}
        </span>
      </div>

      <div className="p-3.5 sm:p-5">
        {/* ── Main Large Image Display ──────────────────────────────── */}
        <div className="relative aspect-[16/10] sm:aspect-[16/9] w-full bg-slate-900 rounded-xl overflow-hidden shadow-sm flex items-center justify-center group">
          <img
            key={selectedPhoto.id || currentIndex}
            src={selectedPhoto.imageUrl}
            alt={selectedPhoto.caption || `${businessName} photo ${currentIndex + 1}`}
            className="w-full h-full object-cover transition-opacity duration-300"
            loading="eager"
          />

          {/* Previous Button (if multiple photos) */}
          {totalCount > 1 && (
            <button
              type="button"
              onClick={handlePrev}
              aria-label="View previous photo"
              className="absolute left-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md backdrop-blur-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              <ChevronLeft size={20} />
            </button>
          )}

          {/* Next Button (if multiple photos) */}
          {totalCount > 1 && (
            <button
              type="button"
              onClick={handleNext}
              aria-label="View next photo"
              className="absolute right-3 top-1/2 -translate-y-1/2 w-10 h-10 rounded-full bg-white/90 hover:bg-white text-slate-800 shadow-md backdrop-blur-sm flex items-center justify-center transition-all hover:scale-105 active:scale-95 cursor-pointer opacity-90 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity"
            >
              <ChevronRight size={20} />
            </button>
          )}

          {/* Photo Caption Overlay */}
          {selectedPhoto.caption && (
            <div className="absolute bottom-3 inset-x-3 sm:bottom-4 sm:inset-x-4 bg-slate-950/75 backdrop-blur-md border border-white/10 rounded-xl p-3 text-white">
              <p className="text-xs sm:text-sm font-medium tracking-wide leading-snug">
                {selectedPhoto.caption}
              </p>
            </div>
          )}
        </div>

        {/* ── Thumbnails Strip (if multiple photos) ───────────────────── */}
        {totalCount > 1 && (
          <div className="mt-4">
            <div
              className="flex items-center gap-2.5 overflow-x-auto p-1.5 bg-slate-50/70 border border-slate-200/80 rounded-xl scrollbar-thin"
              role="tablist"
              aria-label="Photo thumbnails"
            >
              {sanitizedPhotos.map((photo, idx) => {
                const isSelected = idx === currentIndex;
                return (
                  <button
                    key={photo.id || idx}
                    type="button"
                    role="tab"
                    aria-selected={isSelected}
                    aria-label={`Select photo ${idx + 1}${photo.caption ? `: ${photo.caption}` : ''}`}
                    onClick={() => setSelectedIndex(idx)}
                    className={`
                      relative flex-shrink-0 w-16 h-12 sm:w-20 sm:h-14 rounded-lg overflow-hidden transition-all cursor-pointer
                      ${
                        isSelected
                          ? 'ring-2 ring-indigo-600 ring-offset-2 scale-[1.02] shadow-sm'
                          : 'opacity-65 hover:opacity-100 border border-slate-200'
                      }
                    `}
                  >
                    <img
                      src={photo.imageUrl}
                      alt={photo.caption || `Thumbnail ${idx + 1}`}
                      className="w-full h-full object-cover"
                      loading="lazy"
                    />
                    <div className="absolute top-1 left-1 bg-slate-900/70 text-white text-[9px] font-semibold px-1.5 py-0.5 rounded">
                      #{idx + 1}
                    </div>
                  </button>
                );
              })}
            </div>
          </div>
        )}
      </div>
    </section>
  );
}
