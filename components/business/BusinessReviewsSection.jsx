'use client';

import React, { useState, useEffect, useCallback } from 'react';
import { Star, MessageSquare, AlertTriangle, CheckCircle2, User, Send, Edit2 } from 'lucide-react';
import { submitReview, getUserReview } from '@/actions/reviewActions';
import Link from 'next/link';

export default function BusinessReviewsSection({ businessId, onReviewSubmitted }) {
    const [reviews, setReviews] = useState([]);
    const [totalReviews, setTotalReviews] = useState(0);
    const [averageRating, setAverageRating] = useState(null);
    const [page, setPage] = useState(0);
    const [totalPages, setTotalPages] = useState(0);
    const [loadingReviews, setLoadingReviews] = useState(true);

    // User's own review state
    const [userReview, setUserReview] = useState(null);
    const [isLoggedIn, setIsLoggedIn] = useState(false);
    
    // Form state
    const [rating, setRating] = useState(0);
    const [hoverRating, setHoverRating] = useState(0);
    const [comment, setComment] = useState('');
    const [isSubmitting, setIsSubmitting] = useState(false);
    const [formError, setFormError] = useState(null);
    const [formSuccess, setFormSuccess] = useState(false);
    const [isEditing, setIsEditing] = useState(false);

    // Fetch paginated reviews from Spring Boot Backend
    const fetchReviews = useCallback(async (pageNum = 0) => {
        try {
            setLoadingReviews(true);
            const res = await fetch(`/api/v2/businesses/${businessId}/reviews?page=${pageNum}&size=5`);
            if (res.ok) {
                const data = await res.json();
                setReviews(data.content || []);
                setTotalReviews(data.totalElements || 0);
                setTotalPages(data.totalPages || 0);
                if (data.summary) {
                    setAverageRating(data.summary.averageRating);
                }
                setPage(pageNum);
            }
        } catch (err) {
            console.error('Error fetching reviews:', err);
        } finally {
            setLoadingReviews(false);
        }
    }, [businessId]);

    // Fetch the current user's review via Server Action
    const fetchUserReview = useCallback(async () => {
        try {
            const res = await getUserReview(businessId);
            if (res.success && res.userId) {
                setIsLoggedIn(true);
            }
            if (res.success && res.review) {
                setUserReview(res.review);
                setRating(res.review.rating);
                setComment(res.review.comment || '');
            } else {
                setUserReview(null);
                setRating(0);
                setComment('');
            }
        } catch (err) {
            console.error('Error fetching user review:', err);
        }
    }, [businessId]);

    useEffect(() => {
        fetchReviews(0);
        fetchUserReview();
    }, [fetchReviews, fetchUserReview]);

    const handleRatingClick = (val) => {
        if (!isEditing && userReview) return;
        setRating(val);
    };

    const handleSubmit = async (e) => {
        e.preventDefault();
        setFormError(null);
        setFormSuccess(false);

        if (rating < 1 || rating > 5) {
            setFormError('Please select a star rating between 1 and 5.');
            return;
        }

        setIsSubmitting(true);
        try {
            const res = await submitReview(businessId, rating, comment);
            if (res.success) {
                setFormSuccess(true);
                setIsEditing(false);
                setUserReview(res.review);
                
                // Refresh reviews list and trigger parent update
                await fetchReviews(0);
                if (onReviewSubmitted) {
                    onReviewSubmitted();
                }
                
                setTimeout(() => setFormSuccess(false), 3000);
            } else {
                setFormError(res.message || 'Failed to submit review.');
            }
        } catch (err) {
            setFormError('An unexpected error occurred.');
        } finally {
            setIsSubmitting(false);
        }
    };

    // Render Stars helper
    const renderStars = (currentRating, interactive = false) => {
        return (
            <div className="flex items-center gap-1">
                {[1, 2, 3, 4, 5].map((star) => {
                    const isFilled = interactive ? (hoverRating || rating) >= star : currentRating >= star;
                    return (
                        <Star
                            key={star}
                            size={interactive ? 24 : 15}
                            strokeWidth={isFilled ? 0 : 1.5}
                            fill={isFilled ? '#f59e0b' : 'transparent'}
                            className={`${isFilled ? 'text-amber-500' : 'text-slate-300'} ${interactive ? 'cursor-pointer transition-transform hover:scale-115' : ''}`}
                            onMouseEnter={() => interactive && setHoverRating(star)}
                            onMouseLeave={() => interactive && setHoverRating(0)}
                            onClick={() => interactive && handleRatingClick(star)}
                        />
                    );
                })}
            </div>
        );
    };

    return (
        <section className="bg-white rounded-2xl border border-slate-200/90 shadow-sm overflow-hidden">
            {/* Header */}
            <div className="flex items-center justify-between px-4 sm:px-6 py-3.5 sm:py-4 border-b border-slate-100">
                <div className="flex items-center gap-2">
                    <div className="w-7 h-7 sm:w-8 sm:h-8 rounded-lg bg-indigo-50 text-indigo-600 flex items-center justify-center">
                        <MessageSquare size={16} />
                    </div>
                    <h2 className="text-sm sm:text-base font-bold text-slate-900 tracking-tight">
                        Customer Reviews
                    </h2>
                </div>
                <div>
                    {averageRating ? (
                        <div className="flex items-center gap-1.5 px-2.5 py-0.5 rounded-full bg-amber-50 text-amber-900 border border-amber-200/80 text-[11px] sm:text-xs font-semibold">
                            <Star size={13} className="fill-amber-400 text-amber-400" />
                            <span>{averageRating.toFixed(1)} / 5.0</span>
                            <span className="text-amber-700/80 font-normal">({totalReviews})</span>
                        </div>
                    ) : (
                        <span className="text-[11px] sm:text-xs text-slate-500 font-medium bg-slate-100 px-2.5 py-0.5 rounded-full border border-slate-200/70">
                            No ratings yet
                        </span>
                    )}
                </div>
            </div>

            <div className="p-4 sm:p-5">
                {/* ── My Review / Add Review Form ── */}
                <div className="mb-5 p-3.5 sm:p-4 rounded-xl border border-slate-200/80 bg-slate-50/70">
                    {!isLoggedIn ? (
                        <div className="text-center py-2.5">
                            <h3 className="text-xs sm:text-sm font-semibold text-slate-900 mb-0.5">Share Your Experience</h3>
                            <p className="text-xs text-slate-500 mb-2.5 font-normal">You must be logged in to leave a review.</p>
                            <Link
                                href="/api/auth/signin"
                                className="inline-flex items-center gap-1.5 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all"
                            >
                                Log In to Review
                            </Link>
                        </div>
                    ) : (
                        <form onSubmit={handleSubmit} className="flex flex-col gap-3">
                            <div className="flex items-center justify-between">
                                <h3 className="text-xs sm:text-sm font-bold text-slate-900">
                                    {userReview && !isEditing ? 'My Review' : 'Write a Review'}
                                </h3>
                                {userReview && !isEditing && (
                                    <button 
                                        type="button" 
                                        onClick={() => setIsEditing(true)}
                                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-lg text-xs font-semibold text-slate-700 bg-white border border-slate-200 shadow-xs hover:bg-slate-50 transition-all cursor-pointer"
                                    >
                                        <Edit2 size={11} /> Edit
                                    </button>
                                )}
                            </div>

                            {formError && (
                                <div className="p-2.5 bg-rose-50 border border-rose-200 text-rose-700 text-xs font-medium rounded-lg flex items-center gap-1.5">
                                    <AlertTriangle size={14} className="shrink-0" /> {formError}
                                </div>
                            )}

                            {formSuccess && (
                                <div className="p-2.5 bg-emerald-50 border border-emerald-200 text-emerald-800 text-xs font-medium rounded-lg flex items-center gap-1.5">
                                    <CheckCircle2 size={14} className="shrink-0" /> Review submitted successfully!
                                </div>
                            )}

                            <div>
                                <label className="block text-[11px] font-semibold text-slate-600 mb-1">Rating</label>
                                {renderStars(rating, !userReview || isEditing)}
                            </div>

                            {(!userReview || isEditing) ? (
                                <>
                                    <div>
                                        <label htmlFor="comment" className="block text-[11px] font-semibold text-slate-600 mb-1">
                                            Comment <span className="text-slate-400 font-normal">(Optional)</span>
                                        </label>
                                        <textarea
                                            id="comment"
                                            rows="2.5"
                                            maxLength={1000}
                                            value={comment}
                                            onChange={(e) => setComment(e.target.value)}
                                            placeholder="Share details of your experience at this business..."
                                            className="w-full p-2.5 text-xs sm:text-sm rounded-xl border border-slate-200 focus:border-indigo-500 focus:ring-2 focus:ring-indigo-100 outline-none resize-none font-normal text-slate-900 bg-white transition-all placeholder:text-slate-400"
                                        />
                                        <div className="text-right text-[10px] text-slate-400 font-normal mt-0.5">
                                            {comment.length} / 1000
                                        </div>
                                    </div>

                                    <div className="flex items-center gap-2 justify-end mt-0.5">
                                        {userReview && isEditing && (
                                            <button 
                                                type="button" 
                                                onClick={() => {
                                                    setIsEditing(false);
                                                    setRating(userReview.rating);
                                                    setComment(userReview.comment || '');
                                                    setFormError(null);
                                                }}
                                                className="px-3 py-1.5 text-xs font-medium text-slate-600 hover:text-slate-900 cursor-pointer"
                                            >
                                                Cancel
                                            </button>
                                        )}
                                        <button 
                                            type="submit" 
                                            disabled={isSubmitting || rating === 0}
                                            className="inline-flex items-center gap-1 px-3.5 py-1.5 rounded-xl text-xs sm:text-sm font-semibold text-white bg-indigo-600 hover:bg-indigo-700 shadow-sm transition-all disabled:opacity-50 disabled:cursor-not-allowed cursor-pointer"
                                        >
                                            <Send size={13} />
                                            {isSubmitting ? 'Saving...' : (userReview ? 'Update Review' : 'Submit Review')}
                                        </button>
                                    </div>
                                </>
                            ) : (
                                <div>
                                    {userReview.comment ? (
                                        <p className="text-xs sm:text-sm text-slate-700 font-normal whitespace-pre-wrap bg-white p-2.5 border border-slate-200/80 rounded-xl">
                                            {userReview.comment}
                                        </p>
                                    ) : (
                                        <p className="text-xs text-slate-400 italic">No written comment provided.</p>
                                    )}
                                </div>
                            )}
                        </form>
                    )}
                </div>

                {/* ── Public Reviews List ── */}
                <div>
                    <h3 className="text-[11px] font-bold uppercase tracking-wider text-slate-400 mb-2.5">
                        Recent Reviews
                    </h3>
                    
                    {loadingReviews && reviews.length === 0 ? (
                        <div className="text-center py-6 text-slate-400 text-xs sm:text-sm font-medium">Loading reviews...</div>
                    ) : reviews.length === 0 ? (
                        <div className="text-center py-6 text-slate-500 text-xs sm:text-sm font-medium bg-slate-50/50 rounded-xl border border-dashed border-slate-200">
                            No reviews yet. Be the first to review!
                        </div>
                    ) : (
                        <div className="flex flex-col gap-2.5">
                            {reviews.map((rev) => (
                                <article key={rev.id} className="p-3 sm:p-3.5 rounded-xl border border-slate-200/80 bg-white hover:border-slate-300 transition-colors">
                                    <div className="flex justify-between items-start mb-1">
                                        <div className="flex items-center gap-2">
                                            <div className="w-7 h-7 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold text-xs border border-indigo-100/80">
                                                {rev.reviewerName ? rev.reviewerName.charAt(0).toUpperCase() : <User size={12} />}
                                            </div>
                                            <div>
                                                <div className="text-xs sm:text-sm font-semibold text-slate-900">{rev.reviewerName || 'Customer'}</div>
                                                <div className="text-[10px] text-slate-400">{new Date(rev.createdAt).toLocaleDateString()}</div>
                                            </div>
                                        </div>
                                        {renderStars(rev.rating)}
                                    </div>
                                    {rev.comment && (
                                        <p className="text-xs sm:text-sm text-slate-600 font-normal mt-1 leading-relaxed">
                                            {rev.comment}
                                        </p>
                                    )}
                                </article>
                            ))}
                        </div>
                    )}

                    {/* Pagination controls */}
                    {totalPages > 1 && (
                        <div className="flex items-center justify-between mt-5 pt-3.5 border-t border-slate-100">
                            <button 
                                onClick={() => fetchReviews(page - 1)}
                                disabled={page === 0}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer"
                            >
                                Previous
                            </button>
                            <span className="text-xs font-medium text-slate-500">
                                Page {page + 1} of {totalPages}
                            </span>
                            <button 
                                onClick={() => fetchReviews(page + 1)}
                                disabled={page === totalPages - 1}
                                className="px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 text-slate-700 hover:bg-slate-50 disabled:opacity-40 disabled:cursor-not-allowed shadow-xs transition-all cursor-pointer"
                            >
                                Next
                            </button>
                        </div>
                    )}
                </div>
            </div>
        </section>
    );
}
