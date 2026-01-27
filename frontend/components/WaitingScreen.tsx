'use client';

import { Mail } from 'lucide-react';

interface WaitingScreenProps {
    totalChunks: number;
    fileName?: string;
}

/**
 * Get estimated processing time based on chunk count
 */
function getEstimatedTime(chunks: number): string {
    if (chunks <= 10) return '2-3 minutes';
    if (chunks <= 30) return '5-10 minutes';
    if (chunks <= 100) return '10-20 minutes';
    return 'up to 30 minutes';
}

/**
 * Minimal waiting screen for large file processing (5+ chunks)
 * Shows email notification message instead of polling progress
 */
export function WaitingScreen({ totalChunks, fileName }: WaitingScreenProps) {
    const estimatedTime = getEstimatedTime(totalChunks);

    return (
        <div className="min-h-[400px] flex items-center justify-center bg-black border border-gray-800 rounded-lg p-12">
            <div className="max-w-md w-full text-center space-y-6">
                {/* Icon */}
                <div className="flex justify-center">
                    <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center">
                        <Mail className="w-8 h-8 text-gray-400" />
                    </div>
                </div>

                {/* Main Message */}
                <div className="space-y-2">
                    <h3 className="text-xl font-normal text-white">
                        Processing in Background
                    </h3>
                    <p className="text-sm text-gray-400 leading-relaxed">
                        Your file is being processed. You'll receive an email when it's ready.
                    </p>
                </div>

                {/* Stats */}
                <div className="bg-gray-800/50 border border-gray-700/50 rounded-lg p-6 space-y-4">
                    <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wider text-gray-500">Chunks</span>
                        <span className="text-lg font-light text-white tabular-nums">{totalChunks}</span>
                    </div>
                    <div className="flex justify-between items-center">
                        <span className="text-xs uppercase tracking-wider text-gray-500">Est. Time</span>
                        <span className="text-lg font-light text-white">{estimatedTime}</span>
                    </div>
                </div>

                {/* Instructions */}
                <div className="space-y-3 pt-4">
                    <p className="text-xs text-gray-500 leading-relaxed">
                        Feel free to close this page. We'll email you when processing is complete.
                    </p>
                    <p className="text-xs text-gray-600">
                        Check your inbox for the completion notification.
                    </p>
                </div>
            </div>
        </div>
    );
}
