'use client';

import { useState } from 'react';
import { Star, X } from 'lucide-react';

interface ReviewModalProps {
    packId: string;
    onClose: () => void;
    onSubmitSuccess: () => void;
}

export function ReviewModal({ packId, onClose, onSubmitSuccess }: ReviewModalProps) {
    const [rating, setRating] = useState<number>(0);
    const [hoveredRating, setHoveredRating] = useState<number>(0);
    const [feedbackText, setFeedbackText] = useState<string>('');
    const [isSubmitting, setIsSubmitting] = useState<boolean>(false);
    const [error, setError] = useState<string>('');

    const handleSubmit = async () => {
        if (rating === 0) {
            setError('Please select a rating');
            return;
        }

        setIsSubmitting(true);
        setError('');

        try {
            const { data: { session } } = await (await import('@/lib/supabase')).supabase.auth.getSession();

            if (!session) {
                setError('Authentication required');
                setIsSubmitting(false);
                return;
            }

            const API_BASE_URL = process.env.NEXT_PUBLIC_API_BASE_URL || 'http://localhost:8000';

            const response = await fetch(`${API_BASE_URL}/api/v2/packs/${packId}/review`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${session.access_token}`,
                },
                body: JSON.stringify({
                    rating,
                    feedback_text: feedbackText.trim() || null,
                }),
            });

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({ detail: 'Failed to submit' }));
                throw new Error(errorData.detail || 'Failed to submit');
            }

            onSubmitSuccess();
            onClose();
        } catch (err) {
            console.error('Error submitting review:', err);
            setError(err instanceof Error ? err.message : 'Submission failed');
        } finally {
            setIsSubmitting(false);
        }
    };

    return (
        <>
            {/* Enterprise popover - bottom right */}
            <div className="fixed bottom-6 right-6 z-50 w-[380px] animate-in slide-in-from-bottom-4 duration-300">
                <div className="bg-gray-900/95 backdrop-blur-sm border border-gray-800/50 rounded-lg shadow-2xl">
                    {/* Header - minimal */}
                    <div className="flex items-center justify-between px-4 py-3 border-b border-gray-800/50">
                        <div>
                            <h3 className="text-sm font-semibold text-gray-100">Rate your experience</h3>
                            <p className="text-xs text-gray-500 mt-0.5">Help us improve our service</p>
                        </div>
                        <button
                            onClick={onClose}
                            className="text-gray-500 hover:text-gray-300 transition-colors"
                            disabled={isSubmitting}
                        >
                            <X className="w-4 h-4" />
                        </button>
                    </div>

                    {/* Content */}
                    <div className="p-4 space-y-4">
                        {/* Star Rating - minimal */}
                        <div className="flex items-center gap-1.5">
                            {[1, 2, 3, 4, 5].map((star) => (
                                <button
                                    key={star}
                                    type="button"
                                    onClick={() => setRating(star)}
                                    onMouseEnter={() => setHoveredRating(star)}
                                    onMouseLeave={() => setHoveredRating(0)}
                                    className="transition-colors focus:outline-none focus:ring-1 focus:ring-gray-600 rounded p-0.5"
                                    disabled={isSubmitting}
                                >
                                    <Star
                                        className={`w-6 h-6 transition-colors ${star <= (hoveredRating || rating)
                                            ? 'fill-gray-100 text-gray-100'
                                            : 'text-gray-700 hover:text-gray-600'
                                            }`}
                                    />
                                </button>
                            ))}
                            {rating > 0 && (
                                <span className="ml-2 text-xs text-gray-400">{rating}/5</span>
                            )}
                        </div>

                        {/* Optional Feedback - minimal */}
                        <div>
                            <textarea
                                value={feedbackText}
                                onChange={(e) => setFeedbackText(e.target.value)}
                                placeholder="Additional comments (optional)"
                                maxLength={300}
                                rows={2}
                                disabled={isSubmitting}
                                className="w-full bg-gray-800/50 border border-gray-700/50 rounded px-3 py-2 text-sm text-gray-200 placeholder-gray-600 focus:outline-none focus:ring-1 focus:ring-gray-600 focus:border-transparent resize-none transition-all"
                            />
                            <p className="text-[10px] text-gray-600 mt-1 text-right">{feedbackText.length}/300</p>
                        </div>

                        {/* Error Message - minimal */}
                        {error && (
                            <div className="px-3 py-2 bg-red-900/20 border border-red-800/30 rounded text-xs text-red-400">
                                {error}
                            </div>
                        )}

                        {/* Actions - minimal */}
                        <div className="flex gap-2 pt-1">
                            <button
                                onClick={onClose}
                                disabled={isSubmitting}
                                className="flex-1 px-3 py-2 text-xs font-medium text-gray-400 hover:text-gray-300 hover:bg-gray-800/50 rounded transition-colors disabled:opacity-50"
                            >
                                Skip
                            </button>
                            <button
                                onClick={handleSubmit}
                                disabled={isSubmitting || rating === 0}
                                className="flex-1 px-3 py-2 bg-gray-100 hover:bg-white text-black text-xs font-medium rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-1.5"
                            >
                                {isSubmitting ? (
                                    <>
                                        <div className="w-3 h-3 border-2 border-black/20 border-t-black rounded-full animate-spin" />
                                        <span>Submitting</span>
                                    </>
                                ) : (
                                    'Submit'
                                )}
                            </button>
                        </div>
                    </div>
                </div>
            </div>
        </>
    );
}
