'use client';

import { Loader, FileText, AlertCircle, Check, X } from 'lucide-react';
import { useRouter } from 'next/navigation';
import { ProcessStatus } from '@/types/ProcessState';
import { WaitingScreen } from './WaitingScreen';

interface ProcessProgressProps {
    status: ProcessStatus;
    onStartAnalysis?: () => void;
    onCancel?: () => void;
    onDismiss?: () => void;
    isStartingAnalysis?: boolean;
    isCancelling?: boolean;
}

export function ProcessProgress({
    status,
    onStartAnalysis,
    onCancel,
    onDismiss,
    isStartingAnalysis = false,
    isCancelling = false
}: ProcessProgressProps) {
    const router = useRouter();

    // Extracting state
    if (status.state === 'extracting') {
        return (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-lg p-6 backdrop-blur-sm">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <h3 className="text-lg font-semibold text-white tracking-tight">
                                Extracting Content
                            </h3>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Extracting and chunking content for semantic analysis.
                        </p>
                    </div>
                </div>
            </div>
        );
    }

    // Ready for analysis state
    if (status.state === 'ready_for_analysis') {
        const totalChunks = status.totalChunks || 0;
        const creditsRequired = status.creditsRequired || 0;
        const userCredits = status.userCredits || 0;
        const hasCredits = userCredits > 0;
        const hasEnoughCredits = status.canProceed;

        const estimatedTime = totalChunks <= 5 ? '2-3 min' :
            totalChunks <= 10 ? '3-5 min' :
                totalChunks <= 20 ? '5-15 min' : '15-40 min';

        return (
            <div className="bg-black border border-gray-800 rounded-lg p-6">
                {/* Header */}
                <div className="flex items-start gap-3 mb-6">
                    <div className="mt-1">
                        <div className="w-1.5 h-1.5 bg-white rounded-full"></div>
                    </div>
                    <div className="flex-1">
                        <h3 className="text-base font-normal text-white mb-1">Ready for Analysis</h3>
                        <p className="text-sm text-gray-500 leading-relaxed">
                            Content extraction complete. Begin analysis to process your data.
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={isCancelling}
                        className={`text-xs px-3 py-1.5 border rounded transition-all duration-200 flex items-center gap-1.5 ${isCancelling
                            ? 'text-gray-500 border-gray-700 cursor-not-allowed'
                            : 'text-gray-400 hover:text-white border-gray-600 hover:bg-gray-700/50'
                            }`}
                    >
                        {isCancelling ? (
                            <>
                                <Loader className="w-3 h-3 animate-spin" />
                                Cancelling...
                            </>
                        ) : (
                            'Cancel'
                        )}
                    </button>
                </div>

                {/* Stats Grid */}
                <div className="grid grid-cols-2 gap-3 mb-6">
                    <div className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Chunks</div>
                        <div className="text-2xl font-light text-white tabular-nums">{totalChunks}</div>
                    </div>
                    <div className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Balance</div>
                        <div className={`text-2xl font-light tabular-nums ${userCredits < creditsRequired ? 'text-gray-400' : 'text-white'}`}>
                            {status.hasUnlimited ? '∞' : userCredits}
                        </div>
                    </div>
                    <div className="border border-gray-800 rounded-lg p-4 hover:border-gray-700 transition-colors">
                        <div className="text-xs text-gray-600 uppercase tracking-wider mb-2">Est. Time</div>
                        <div className="text-2xl font-light text-white tabular-nums">{estimatedTime}</div>
                    </div>
                </div>

                {/* Insufficient credits notice */}
                {!hasEnoughCredits && (
                    <div className="border border-gray-800 rounded-lg px-4 py-3 mb-6">
                        <p className="text-sm text-gray-400 flex items-center gap-2">
                            <svg className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z" />
                            </svg>
                            <span>Buy <span className="text-white">{creditsRequired - userCredits}</span> credits to process full job.</span>
                        </p>
                    </div>
                )}

                {/* Action Buttons */}
                <div className="space-y-3">
                    {hasEnoughCredits ? (
                        <button
                            onClick={onStartAnalysis}
                            disabled={isStartingAnalysis}
                            className={`w-full px-5 py-3 rounded-lg text-sm font-normal transition-all flex items-center justify-center gap-2 ${isStartingAnalysis
                                ? 'bg-gray-900 text-gray-500 cursor-wait'
                                : 'bg-white text-black hover:bg-gray-100'
                                }`}
                        >
                            {isStartingAnalysis ? (
                                <>
                                    <Loader className="w-4 h-4 animate-spin" />
                                    <span>Starting...</span>
                                </>
                            ) : (
                                <span>Start Analysis</span>
                            )}
                        </button>
                    ) : (
                        <>
                            {hasCredits && (
                                <button
                                    onClick={onStartAnalysis}
                                    disabled={isStartingAnalysis}
                                    className="w-full bg-gray-900 hover:bg-gray-850 border border-gray-800 hover:border-gray-700 text-white px-5 py-3 rounded-lg text-sm font-normal transition-all flex items-center justify-center gap-2"
                                >
                                    {isStartingAnalysis ? (
                                        <div className="flex items-center gap-2">
                                            <Loader className="w-4 h-4 animate-spin" />
                                            <span className="text-xs text-gray-400">
                                                Reload if too long
                                            </span>
                                        </div>
                                    ) : (
                                        <FileText className="w-4 h-4" />
                                    )}
                                    <span>Process {userCredits} chunks</span>
                                </button>
                            )}

                            <button
                                onClick={() => router.push('/pricing')}
                                className="w-full bg-white hover:bg-gray-100 text-black px-5 py-3 rounded-lg text-sm font-normal transition-all"
                            >
                                Buy Credits
                            </button>
                        </>
                    )}

                </div>
            </div>
        );
    }

    // Analyzing state or building tree state - show the same UI
    if (status.state === 'analyzing' || status.state === 'building_tree') {
        const current = status.currentChunk || 0;
        const total = status.totalChunks || 0;
        const percent = status.progress || (total > 0 ? Math.round((current / total) * 100) : 0);

        // Show waiting screen for large jobs (5+ chunks)
        if (total >= 5) {
            return <WaitingScreen totalChunks={total} fileName={status.fileName} />;
        }

        // Show progress tracking for small jobs (< 5 chunks)
        return (
            <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-lg p-6 backdrop-blur-sm">
                <div className="flex items-start justify-between mb-4">
                    <div className="flex-1">
                        <div className="flex items-center gap-3 mb-2">
                            <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                            <h3 className="text-lg font-semibold text-white tracking-tight">
                                Analyzing Content
                            </h3>
                        </div>
                        <p className="text-sm text-gray-400 leading-relaxed">
                            Processing your content...
                        </p>
                    </div>
                    <button
                        onClick={onCancel}
                        disabled={isCancelling}
                        className={`text-xs px-3 py-1.5 border rounded transition-all duration-200 flex items-center gap-1.5 ${isCancelling
                            ? 'text-gray-500 border-gray-700 cursor-not-allowed'
                            : 'text-gray-400 hover:text-white border-gray-600 hover:bg-gray-700/50'
                            }`}
                    >
                        {isCancelling ? (
                            <>
                                <Loader className="w-3 h-3 animate-spin" />
                                Cancelling...
                            </>
                        ) : (
                            'Cancel'
                        )}
                    </button>
                </div>

                {/* Progress */}
                <div className="space-y-3">
                    <div className="flex items-center justify-between text-sm">
                        <span className="text-gray-500 font-medium">{current} / {total} chunks</span>
                        <span className="text-gray-300 font-semibold tabular-nums">{percent}%</span>
                    </div>
                    <div className="w-full bg-gray-700/30 rounded-full h-1.5 overflow-hidden">
                        <div
                            className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-700 ease-out"
                            style={{ width: `${percent}%` }}
                        />
                    </div>
                </div>
            </div>
        );
    }

    // Completed state
    if (status.state === 'completed') {
        return (
            <div className="bg-gray-900 border border-gray-800 rounded-lg px-4 py-3 flex items-center justify-between">
                <div className="flex items-center gap-3">
                    <Check className="w-4 h-4 text-emerald-500" />
                    <span className="text-sm text-gray-300">Analysis complete</span>
                </div>
                {onDismiss && (
                    <button
                        onClick={onDismiss}
                        className="text-gray-500 hover:text-gray-300 transition-colors"
                        aria-label="Dismiss"
                    >
                        <X className="w-4 h-4" />
                    </button>
                )}
            </div>
        );
    }

    // Failed state
    if (status.state === 'failed') {
        return (
            <div className="bg-gradient-to-br from-red-900/20 to-red-800/20 border border-red-500/30 rounded-lg p-6">
                <div className="flex items-center gap-3">
                    <div className="w-10 h-10 bg-red-500/20 rounded-full flex items-center justify-center">
                        <AlertCircle className="w-5 h-5 text-red-400" />
                    </div>
                    <div>
                        <h3 className="text-lg font-semibold text-white">Processing Failed</h3>
                        <p className="text-sm text-gray-400">{status.error || 'An error occurred during processing'}</p>
                    </div>
                </div>
            </div>
        );
    }

    return null;
}
