import { useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { API_BASE_URL } from '@/lib/api';

// Simplified modal state - only one modal now
type ModalState =
    | { type: 'hidden' }
    | {
        type: 'analysis_started';
        sourceId: string;
        totalChunks: number;
        timeEstimate: string;
    };

interface SourceStatus {
    source_id: string;
    status: string;
    progress?: number;
    total_chunks?: number;
    processed_chunks?: number;
}

export interface CreditInfo {
    totalChunks: number;
    creditsRequired: number;
    userCredits: number;
    hasUnlimited: boolean;
    canProceed: boolean;
}

/**
 * Simplified hook for source processing:
 * Upload → Extract → Ready (show credits inline) → Start Analysis → Show \"Analysis Started\" modal
 */
export function useSourceProcessing() {
    const { makeAuthenticatedRequest } = useAuth();
    const [modalState, setModalState] = useState<ModalState>({ type: 'hidden' });

    // Store credit info for inline display (not modal)
    const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);

    /**
     * Fetch credit check info for inline display (no modal)
     */
    const fetchCreditInfo = useCallback(async (sourceId: string) => {
        try {
            const creditResponse = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/sources/${sourceId}/credit-check`
            );

            if (creditResponse.ok) {
                const creditData = await creditResponse.json();
                setCreditInfo({
                    totalChunks: creditData.totalChunks,
                    creditsRequired: creditData.creditsRequired,
                    userCredits: creditData.userCredits,
                    hasUnlimited: creditData.hasUnlimited || false,
                    canProceed: creditData.canProceed
                });
            }
        } catch (error) {
            console.error('[useSourceProcessing] Error fetching credit info:', error);
        }
    }, [makeAuthenticatedRequest]);

    /**
     * Get time estimate based on chunk count
     */
    const getTimeEstimate = useCallback((chunks: number): string => {
        if (chunks <= 5) return '~2-3 minutes';
        if (chunks <= 10) return '~5 minutes';
        if (chunks <= 20) return '~10-15 minutes';
        return '10-40 minutes';
    }, []);

    /**
     * Start analysis and show confirmation modal
     */
    const startAnalysis = useCallback(async (sourceId: string, totalChunks: number) => {
        try {
            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/sources/${sourceId}/start-analysis`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({}),
                }
            );

            if (!response.ok) {
                throw new Error('Failed to start analysis');
            }

            const result = await response.json();

            // Show "Analysis Started" modal
            setModalState({
                type: 'analysis_started',
                sourceId,
                totalChunks,
                timeEstimate: getTimeEstimate(totalChunks)
            });

            return result;
        } catch (error) {
            console.error('[useSourceProcessing] Error starting analysis:', error);
            throw error;
        }
    }, [makeAuthenticatedRequest, getTimeEstimate]);

    /**
     * Update based on source status (for polling)
     * Simplified - no modal state transitions
     */
    const updateFromSourceStatus = useCallback((_source: SourceStatus) => {
        // No-op now - we don't auto-show/hide modals based on status
        // The only modal is shown explicitly when user clicks "Start Analysis"
    }, []);

    /**
     * Close modal
     */
    const closeModal = useCallback(() => {
        setModalState({ type: 'hidden' });
    }, []);

    return {
        modalState,
        creditInfo,
        fetchCreditInfo,
        startAnalysis,
        updateFromSourceStatus,
        closeModal,
    };
}
