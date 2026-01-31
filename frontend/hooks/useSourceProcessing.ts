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
            console.log('[useSourceProcessing] Fetching credit info for:', sourceId);
            const creditResponse = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/sources/${sourceId}/credit-check`
            );

            if (creditResponse.ok) {
                const creditData = await creditResponse.json();
                console.log('[useSourceProcessing] Credit info received:', creditData);
                setCreditInfo({
                    totalChunks: creditData.totalChunks,
                    creditsRequired: creditData.creditsRequired,
                    userCredits: creditData.userCredits,
                    hasUnlimited: creditData.hasUnlimited || false,
                    canProceed: creditData.canProceed
                });
            } else {
                console.error('[useSourceProcessing] Credit check failed with status:', creditResponse.status);
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
    const startAnalysis = useCallback(async (sourceId: string, totalChunks: number, maxChunks?: number) => {
        console.log('[useSourceProcessing] Starting analysis:', { sourceId: sourceId.substring(0, 8), totalChunks, maxChunks });
        
        try {
            const url = `${API_BASE_URL}/api/v2/sources/${sourceId}/start-analysis`;
            console.log('[useSourceProcessing] POST request to:', url);
            
            const response = await makeAuthenticatedRequest(
                url,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ max_chunks: maxChunks }),
                }
            );

            console.log('[useSourceProcessing] Response received:', response.status, response.ok);

            if (!response.ok) {
                const errorData = await response.json().catch(() => ({}));
                const errorMessage = errorData.message || errorData.error || 'Failed to start analysis';
                
                console.error('[useSourceProcessing] Error response:', errorMessage);
                
                if (response.status === 402) {
                    throw new Error('Insufficient credits. Please purchase more credits to continue.');
                }
                
                throw new Error(errorMessage);
            }

            const result = await response.json();
            console.log('[useSourceProcessing] Success response:', result);

            // Show "Analysis Started" modal
            setModalState({
                type: 'analysis_started',
                sourceId,
                totalChunks,
                timeEstimate: getTimeEstimate(totalChunks)
            });

            return result;
        } catch (error) {
            console.error('[useSourceProcessing] Exception caught:', error);
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
