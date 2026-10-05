'use client';

import React, { useState, useEffect, useRef } from 'react';
import { toast } from 'react-hot-toast';
import { FiUpload, FiTrash2, FiImage, FiAlertCircle, FiCheck, FiLoader } from 'react-icons/fi';
import {
    ALLOWED_IMAGE_MIME_TYPES,
    MAX_LOGO_SIZE_BYTES,
    MAX_PHOTO_SIZE_BYTES,
    MAX_GALLERY_PHOTOS,
    MAX_CAPTION_LENGTH
} from '@/lib/validations/businessImageValidation';

export default function BusinessBrandingManager({ businessId, initialLogoUrl = null }) {
    // Logo state
    const [logoUrl, setLogoUrl] = useState(initialLogoUrl);
    const [logoUploading, setLogoUploading] = useState(false);
    const [logoRemoving, setLogoRemoving] = useState(false);
    const [logoError, setLogoError] = useState(null);
    const logoInputRef = useRef(null);

    // Gallery state
    const [photos, setPhotos] = useState([]);
    const [photosLoading, setPhotosLoading] = useState(true);
    const [photoUploading, setPhotoUploading] = useState(false);
    const [photoDeletingId, setPhotoDeletingId] = useState(null);
    const [galleryError, setGalleryError] = useState(null);

    // Add photo form state
    const [selectedPhotoFile, setSelectedPhotoFile] = useState(null);
    const [photoPreview, setPhotoPreview] = useState(null);
    const [photoCaption, setPhotoCaption] = useState('');
    const photoInputRef = useRef(null);

    // 1. Load initial branding data
    useEffect(() => {
        let isMounted = true;
        const fetchBranding = async () => {
            setPhotosLoading(true);
            try {
                const url = businessId
                    ? `/api/vendors/business-images?businessId=${encodeURIComponent(businessId)}`
                    : '/api/vendors/business-images';
                const res = await fetch(url);
                const data = await res.json();
                if (!res.ok || !data.success) {
                    throw new Error(data.message || 'Failed to load business branding');
                }
                if (isMounted) {
                    if (data.logoUrl !== undefined) {
                        setLogoUrl(data.logoUrl);
                    }
                    setPhotos(data.photos || []);
                }
            } catch (err) {
                console.error('Error loading branding:', err);
                if (isMounted) {
                    setGalleryError(err.message || 'Could not load gallery photos');
                }
            } finally {
                if (isMounted) {
                    setPhotosLoading(false);
                }
            }
        };

        fetchBranding();
        return () => {
            isMounted = false;
        };
    }, [businessId]);

    // 2. Logo Upload Handler
    const handleLogoSelect = async (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setLogoError(null);

        // Client-side quick validation
        const mimeType = (file.type || '').toLowerCase();
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
            const msg = 'Invalid file format. Only JPEG, PNG, and WebP are allowed.';
            setLogoError(msg);
            toast.error(msg);
            if (logoInputRef.current) logoInputRef.current.value = '';
            return;
        }

        if (file.size > MAX_LOGO_SIZE_BYTES) {
            const msg = `Logo file is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is 5MB.`;
            setLogoError(msg);
            toast.error(msg);
            if (logoInputRef.current) logoInputRef.current.value = '';
            return;
        }

        // Upload to server
        setLogoUploading(true);
        const formData = new FormData();
        formData.append('file', file);
        if (businessId) {
            formData.append('businessId', businessId);
        }

        try {
            const res = await fetch('/api/vendors/business-images/logo', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to upload logo');
            }

            setLogoUrl(data.logoUrl);
            toast.success('Business logo updated successfully!');
        } catch (err) {
            console.error('Logo upload error:', err);
            const msg = err.message || 'Failed to upload logo';
            setLogoError(msg);
            toast.error(msg);
        } finally {
            setLogoUploading(false);
            if (logoInputRef.current) logoInputRef.current.value = '';
        }
    };

    // 3. Logo Remove Handler
    const handleRemoveLogo = async () => {
        if (!logoUrl) return;
        if (!window.confirm('Are you sure you want to remove your business logo?')) {
            return;
        }

        setLogoRemoving(true);
        setLogoError(null);

        try {
            const url = businessId
                ? `/api/vendors/business-images/logo?businessId=${encodeURIComponent(businessId)}`
                : '/api/vendors/business-images/logo';
            const res = await fetch(url, { method: 'DELETE' });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to remove logo');
            }

            setLogoUrl(null);
            toast.success('Logo removed successfully');
        } catch (err) {
            console.error('Logo removal error:', err);
            const msg = err.message || 'Failed to remove logo';
            setLogoError(msg);
            toast.error(msg);
        } finally {
            setLogoRemoving(false);
        }
    };

    // 4. Photo Selection for Gallery
    const handlePhotoSelect = (e) => {
        const file = e.target.files?.[0];
        if (!file) return;

        setGalleryError(null);

        const mimeType = (file.type || '').toLowerCase();
        if (!ALLOWED_IMAGE_MIME_TYPES.includes(mimeType)) {
            const msg = 'Invalid file format. Only JPEG, PNG, and WebP are allowed.';
            setGalleryError(msg);
            toast.error(msg);
            if (photoInputRef.current) photoInputRef.current.value = '';
            return;
        }

        if (file.size > MAX_PHOTO_SIZE_BYTES) {
            const msg = `Photo is too large (${(file.size / (1024 * 1024)).toFixed(1)}MB). Maximum size is 10MB.`;
            setGalleryError(msg);
            toast.error(msg);
            if (photoInputRef.current) photoInputRef.current.value = '';
            return;
        }

        setSelectedPhotoFile(file);
        // Create local object URL for preview
        const previewUrl = URL.createObjectURL(file);
        setPhotoPreview(previewUrl);
    };

    const handleCancelPhotoSelection = () => {
        if (photoPreview) {
            URL.revokeObjectURL(photoPreview);
        }
        setSelectedPhotoFile(null);
        setPhotoPreview(null);
        setPhotoCaption('');
        if (photoInputRef.current) photoInputRef.current.value = '';
    };

    // 5. Gallery Photo Upload Handler
    const handleUploadPhoto = async (e) => {
        e.preventDefault();
        if (!selectedPhotoFile) return;

        if (photos.length >= MAX_GALLERY_PHOTOS) {
            toast.error(`Maximum limit of ${MAX_GALLERY_PHOTOS} photos reached.`);
            return;
        }

        setPhotoUploading(true);
        setGalleryError(null);

        const formData = new FormData();
        formData.append('file', selectedPhotoFile);
        if (photoCaption.trim()) {
            formData.append('caption', photoCaption.trim());
        }
        if (businessId) {
            formData.append('businessId', businessId);
        }

        try {
            const res = await fetch('/api/vendors/business-images/gallery', {
                method: 'POST',
                body: formData
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to upload gallery photo');
            }

            // Append new photo to state
            setPhotos((prev) => [...prev, data.photo]);
            handleCancelPhotoSelection();
            toast.success('Gallery photo added successfully!');
        } catch (err) {
            console.error('Gallery photo upload error:', err);
            const msg = err.message || 'Failed to upload gallery photo';
            setGalleryError(msg);
            toast.error(msg);
        } finally {
            setPhotoUploading(false);
        }
    };

    // 6. Delete Gallery Photo Handler
    const handleDeletePhoto = async (photoId) => {
        if (!photoId) return;
        if (!window.confirm('Are you sure you want to delete this photo from your gallery?')) {
            return;
        }

        setPhotoDeletingId(photoId);
        setGalleryError(null);

        try {
            const res = await fetch(`/api/vendors/business-images/gallery/${photoId}`, {
                method: 'DELETE'
            });
            const data = await res.json();

            if (!res.ok || !data.success) {
                throw new Error(data.message || 'Failed to delete photo');
            }

            setPhotos((prev) => prev.filter((p) => p.id !== photoId));
            toast.success('Photo deleted successfully');
        } catch (err) {
            console.error('Error deleting photo:', err);
            const msg = err.message || 'Failed to delete photo';
            setGalleryError(msg);
            toast.error(msg);
        } finally {
            setPhotoDeletingId(null);
        }
    };

    return (
        <div className="space-y-8">
            {/* ══════════════════════════════════════════════════════════════════
                1. LOGO BRANDING SECTION
            ══════════════════════════════════════════════════════════════════ */}
            <div className="border-b pb-6">
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>Store Logo</span>
                            {logoUrl && (
                                <span className="text-xs bg-green-100 text-green-800 font-semibold px-2 py-0.5 rounded-full inline-flex items-center gap-1">
                                    <FiCheck size={12} /> Active
                                </span>
                            )}
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Displayed on your public store page, nearby discovery cards, and offer banners.
                            Allowed formats: JPEG, PNG, WebP (max 5MB).
                        </p>
                    </div>

                    <div className="flex items-center gap-2">
                        {/* Hidden file input */}
                        <input
                            type="file"
                            ref={logoInputRef}
                            onChange={handleLogoSelect}
                            accept="image/jpeg,image/png,image/webp"
                            className="hidden"
                            id="business-logo-input"
                            disabled={logoUploading || logoRemoving}
                        />

                        {/* Upload / Replace button */}
                        <button
                            type="button"
                            onClick={() => logoInputRef.current?.click()}
                            disabled={logoUploading || logoRemoving}
                            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-bold text-white bg-black hover:bg-neutral-800 rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors disabled:opacity-50 cursor-pointer"
                        >
                            {logoUploading ? (
                                <>
                                    <FiLoader className="animate-spin" size={16} />
                                    <span>Uploading...</span>
                                </>
                            ) : (
                                <>
                                    <FiUpload size={16} />
                                    <span>{logoUrl ? 'Replace Logo' : 'Upload Logo'}</span>
                                </>
                            )}
                        </button>

                        {/* Remove button */}
                        {logoUrl && (
                            <button
                                type="button"
                                onClick={handleRemoveLogo}
                                disabled={logoUploading || logoRemoving}
                                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-bold text-red-600 bg-red-50 hover:bg-red-100 border border-red-200 rounded transition-colors disabled:opacity-50 cursor-pointer"
                                title="Remove logo"
                            >
                                {logoRemoving ? (
                                    <FiLoader className="animate-spin" size={16} />
                                ) : (
                                    <FiTrash2 size={16} />
                                )}
                                <span className="hidden sm:inline">Remove</span>
                            </button>
                        )}
                    </div>
                </div>

                {/* Error Banner */}
                {logoError && (
                    <div className="mt-3 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
                        <FiAlertCircle size={16} className="shrink-0" />
                        <span>{logoError}</span>
                    </div>
                )}

                {/* Logo Preview Area */}
                <div className="mt-4 flex items-center gap-4">
                    <div className="relative w-24 h-24 rounded-lg border-2 border-dashed border-gray-300 bg-gray-50 flex items-center justify-center overflow-hidden shrink-0">
                        {logoUrl ? (
                            <img
                                src={logoUrl}
                                alt="Business logo preview"
                                className="w-full h-full object-contain p-1"
                            />
                        ) : (
                            <div className="text-center p-2 text-gray-400">
                                <FiImage size={28} className="mx-auto mb-1 opacity-60" />
                                <span className="text-[10px] uppercase font-bold block">No Logo</span>
                            </div>
                        )}
                    </div>

                    <div className="text-xs text-gray-600 space-y-1">
                        <p className="font-semibold text-gray-800">
                            {logoUrl ? 'Current business logo' : 'No store logo uploaded yet'}
                        </p>
                        <p className="text-gray-500">
                            Square or round logos look best. We recommend an image of at least 250×250 pixels.
                        </p>
                    </div>
                </div>
            </div>

            {/* ══════════════════════════════════════════════════════════════════
                2. GALLERY PHOTOS SECTION
            ══════════════════════════════════════════════════════════════════ */}
            <div>
                <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-2 mb-4">
                    <div>
                        <h2 className="text-lg font-bold text-gray-900 flex items-center gap-2">
                            <span>Store Gallery Photos</span>
                            <span className="text-xs font-semibold px-2 py-0.5 bg-gray-100 text-gray-700 rounded-full border border-gray-200">
                                {photos.length} / {MAX_GALLERY_PHOTOS} photos
                            </span>
                        </h2>
                        <p className="text-xs text-gray-500 mt-0.5">
                            Showcase your storefront, atmosphere, team, and products. Ordered photos will appear on your customer page.
                        </p>
                    </div>
                </div>

                {/* Gallery Error Banner */}
                {galleryError && (
                    <div className="mb-4 p-3 bg-red-50 border border-red-200 text-red-700 text-xs rounded flex items-center gap-2">
                        <FiAlertCircle size={16} className="shrink-0" />
                        <span>{galleryError}</span>
                    </div>
                )}

                {/* Add New Photo Form */}
                {photos.length < MAX_GALLERY_PHOTOS ? (
                    <div className="mb-6 p-4 bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg">
                        <h3 className="text-sm font-bold text-gray-800 mb-2 flex items-center gap-1.5">
                            <FiUpload size={14} style={{ color: '#df6824' }} />
                            <span>Add Photo to Gallery</span>
                        </h3>

                        {!photoPreview ? (
                            <div>
                                <input
                                    type="file"
                                    ref={photoInputRef}
                                    onChange={handlePhotoSelect}
                                    accept="image/jpeg,image/png,image/webp"
                                    className="hidden"
                                    id="gallery-photo-input"
                                    disabled={photoUploading}
                                />
                                <button
                                    type="button"
                                    onClick={() => photoInputRef.current?.click()}
                                    disabled={photoUploading}
                                    className="w-full py-6 border-2 border-dashed border-gray-300 hover:border-black rounded-lg bg-white flex flex-col items-center justify-center gap-2 transition-colors cursor-pointer group"
                                >
                                    <div className="w-10 h-10 rounded-full bg-orange-50 group-hover:bg-orange-100 flex items-center justify-center text-orange-600 transition-colors">
                                        <FiUpload size={18} />
                                    </div>
                                    <div className="text-center">
                                        <span className="text-sm font-bold text-gray-800 block">
                                            Click to choose a photo
                                        </span>
                                        <span className="text-xs text-gray-500">
                                            JPEG, PNG, WebP up to 10MB
                                        </span>
                                    </div>
                                </button>
                            </div>
                        ) : (
                            <form onSubmit={handleUploadPhoto} className="space-y-4">
                                <div className="flex flex-col sm:flex-row gap-4 items-start">
                                    {/* Preview Thumbnail */}
                                    <div className="relative w-32 h-24 rounded border border-gray-300 overflow-hidden shrink-0 bg-black">
                                        <img
                                            src={photoPreview}
                                            alt="Selected preview"
                                            className="w-full h-full object-cover"
                                        />
                                    </div>

                                    {/* Caption & Controls */}
                                    <div className="flex-1 w-full space-y-2">
                                        <div>
                                            <label className="block text-xs font-bold text-gray-700 mb-1">
                                                Caption (Optional)
                                            </label>
                                            <input
                                                type="text"
                                                value={photoCaption}
                                                onChange={(e) => setPhotoCaption(e.target.value)}
                                                maxLength={MAX_CAPTION_LENGTH}
                                                placeholder="e.g. Front entrance, Spice section, Seating area"
                                                className="w-full px-3 py-1.5 border border-gray-300 rounded text-sm focus:outline-none focus:ring-2 focus:ring-orange-500 bg-white"
                                                disabled={photoUploading}
                                            />
                                            <div className="flex justify-between text-[10px] text-gray-400 mt-0.5">
                                                <span>Add context for customers</span>
                                                <span>{photoCaption.length} / {MAX_CAPTION_LENGTH}</span>
                                            </div>
                                        </div>

                                        <div className="flex items-center gap-2 pt-1">
                                            <button
                                                type="submit"
                                                disabled={photoUploading}
                                                className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-bold text-white bg-black hover:bg-neutral-800 rounded shadow-[2px_2px_0px_0px_rgba(0,0,0,1)] transition-colors disabled:opacity-50 cursor-pointer"
                                            >
                                                {photoUploading ? (
                                                    <>
                                                        <FiLoader className="animate-spin" size={14} />
                                                        <span>Uploading Photo...</span>
                                                    </>
                                                ) : (
                                                    <>
                                                        <FiCheck size={14} />
                                                        <span>Save to Gallery</span>
                                                    </>
                                                )}
                                            </button>

                                            <button
                                                type="button"
                                                onClick={handleCancelPhotoSelection}
                                                disabled={photoUploading}
                                                className="px-3 py-1.5 text-sm font-semibold text-gray-600 hover:text-gray-900 border border-gray-300 rounded bg-white hover:bg-gray-100 transition-colors disabled:opacity-50 cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </form>
                        )}
                    </div>
                ) : (
                    <div className="mb-6 p-3 bg-amber-50 border border-amber-200 text-amber-800 text-xs rounded-lg flex items-center gap-2">
                        <FiAlertCircle size={16} className="shrink-0" />
                        <span>Maximum of {MAX_GALLERY_PHOTOS} photos reached. Delete existing photos to upload new ones.</span>
                    </div>
                )}

                {/* Existing Photos Grid */}
                {photosLoading ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {[1, 2, 3].map((i) => (
                            <div key={i} className="h-44 bg-gray-200 rounded-lg animate-pulse" />
                        ))}
                    </div>
                ) : photos.length === 0 ? (
                    <div className="py-8 text-center border-2 border-dashed border-gray-200 rounded-lg bg-gray-50">
                        <FiImage size={36} className="mx-auto text-gray-300 mb-2" />
                        <p className="text-sm font-bold text-gray-600">No gallery photos added yet</p>
                        <p className="text-xs text-gray-400 mt-1 max-w-sm mx-auto">
                            Add photos to give customers a tour of your store, signature products, or friendly team.
                        </p>
                    </div>
                ) : (
                    <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                        {photos.map((photo, index) => (
                            <div
                                key={photo.id || index}
                                className="group bg-white border-2 border-black rounded-lg shadow-[4px_4px_0px_0px_rgba(0,0,0,1)] overflow-hidden flex flex-col justify-between"
                            >
                                <div className="relative aspect-video w-full bg-gray-100 overflow-hidden">
                                    <img
                                        src={photo.imageUrl}
                                        alt={photo.caption || `Business photo ${index + 1}`}
                                        className="w-full h-full object-cover group-hover:scale-105 transition-transform duration-200"
                                        loading="lazy"
                                    />
                                    {/* Display order badge */}
                                    <div className="absolute top-2 left-2 bg-black text-white text-[10px] font-black px-2 py-0.5 rounded shadow">
                                        #{index + 1}
                                    </div>
                                </div>

                                <div className="p-3 flex items-center justify-between gap-2 border-t border-gray-200 bg-white">
                                    <p className="text-xs font-medium text-gray-800 truncate" title={photo.caption || ''}>
                                        {photo.caption || <span className="text-gray-400 italic">No caption</span>}
                                    </p>

                                    <button
                                        type="button"
                                        onClick={() => handleDeletePhoto(photo.id)}
                                        disabled={photoDeletingId === photo.id}
                                        className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded transition-colors disabled:opacity-50 shrink-0 cursor-pointer"
                                        title="Delete photo"
                                    >
                                        {photoDeletingId === photo.id ? (
                                            <FiLoader className="animate-spin" size={16} />
                                        ) : (
                                            <FiTrash2 size={16} />
                                        )}
                                    </button>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>
        </div>
    );
}
