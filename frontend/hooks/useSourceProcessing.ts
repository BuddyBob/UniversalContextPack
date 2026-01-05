import { useState, useCallback, useRef, useEffect } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { API_BASE_URL } from '@/lib/api';

// Modal state machine
type ModalState =
    | { type: 'hidden' }
    | {
        type: 'credit_check';
        sourceId: string;
        totalChunks: number;
        creditsRequired: number;
        userCredits: number;
        hasUnlimited: boolean;
        canProceed: boolean;
        creditsNeeded: number;
    }
    | { type: 'analyzing'; sourceId: string }
    | { type: 'building_tree'; sourceId: string };

interface SourceStatus {
    source_id: string;
    status: string;
    progress?: number;
    total_chunks?: number;
    processed_chunks?: number;
}

/**
 * Custom hook for managing source processing flow:
 * Upload → Extract → Ready → Analyze → Building Tree → Completed
 */
export function useSourceProcessing() {
    const { makeAuthenticatedRequest } = useAuth();
    const [modalState, setModalState] = useState<ModalState>({ type: 'hidden' });
    const [analysisLimits, setAnalysisLimits] = useState<Record<string, number>>({});
    // Track sources we've already shown a ready modal for to avoid re-triggering on every poll
    const handledReadySourcesRef = useRef<Set<string>>(new Set());

    // Use refs to track current modal state to avoid stale closures
    const modalSourceRef = useRef<string | null>(null);
    const modalTypeRef = useRef<ModalState['type']>('hidden');

    // Update ref whenever modal state changes
    useEffect(() => {
        if (modalState.type !== 'hidden' && 'sourceId' in modalState) {
            modalSourceRef.current = modalState.sourceId;
        } else {
            modalSourceRef.current = null;
        }
        modalTypeRef.current = modalState.type;
    }, [modalState]);

    /**
     * Handle source reaching ready_for_analysis status
     * Fetches credit check and shows confirmation modal
     */
    const handleSourceReady = useCallback(async (sourceId: string) => {
        // Allow re-triggering if modal is currently hidden
        // This enables manual button clicks even if auto-trigger already happened
        if (handledReadySourcesRef.current.has(sourceId) && modalTypeRef.current !== 'hidden') {
            console.log('[useSourceProcessing] Source already handled and modal is open, skipping');
            return;
        }

        handledReadySourcesRef.current.add(sourceId);

        try {
            const creditResponse = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/sources/${sourceId}/credit-check`
            );

            if (creditResponse.ok) {
                const creditData = await creditResponse.json();
                setModalState({
                    type: 'credit_check',
                    sourceId: creditData.sourceId || sourceId,
                    totalChunks: creditData.totalChunks,
                    creditsRequired: creditData.creditsRequired,
                    userCredits: creditData.userCredits,
                    hasUnlimited: creditData.hasUnlimited,
                    canProceed: creditData.canProceed,
                    creditsNeeded: creditData.creditsNeeded || 0,
                });
            }
        } catch (error) {
            console.error('[useSourceProcessing] Error fetching credit check:', error);
        }
    }, [makeAuthenticatedRequest]);

    /**
     * Start analysis for a source
     */
    const startAnalysis = useCallback(async (sourceId: string, maxChunks?: number) => {
        try {
            // Keep modal open until backend confirms status change
            // This prevents flash of "Ready" state

            const body = maxChunks ? { max_chunks: maxChunks } : {};
            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/sources/${sourceId}/start-analysis`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify(body),
                }
            );

            if (!response.ok) {
                throw new Error('Failed to start analysis');
            }

            const result = await response.json();

            // Store analysis limit if partial analysis
            if (maxChunks && maxChunks < result.total_chunks) {
                setAnalysisLimits((prev) => ({ ...prev, [sourceId]: maxChunks }));
            }

            return result;
        } catch (error) {
            console.error('[useSourceProcessing] Error starting analysis:', error);
            setModalState({ type: 'hidden' });
            throw error;
        }
    }, [makeAuthenticatedRequest]);

    /**
     * Update modal state based on source status
     * Called from polling hook when source status changes
     */
    const updateFromSourceStatus = useCallback((source: SourceStatus) => {
        const status = source.status?.toLowerCase();
        const normalized = status?.replace(/\s+/g, '_');

        // Check if modal is showing for this source using ref (avoids stale closure)
        if (modalSourceRef.current === source.source_id) {
            // If user is still at credit check, do not auto-advance or flicker
            if (modalTypeRef.current === 'credit_check') {
                return;
            }
            console.log(`[useSourceProcessing] Updating modal for source ${source.source_id}, status: ${status}`);

            if (status === 'analyzing' || status === 'processing' || status === 'analyzing_chunks') {
                // Close modal when analyzing starts (was credit_check modal)
                setModalState({ type: 'hidden' });
            } else if (status === 'building_tree' || normalized?.includes('build')) {
                setModalState(prev => prev.type !== 'building_tree' ? { type: 'building_tree', sourceId: source.source_id } : prev);
            } else if (
                status === 'completed' ||
                status === 'failed' ||
                normalized?.includes('complete') ||
                normalized?.includes('built') ||
                normalized?.includes('done') ||
                (typeof source.progress === 'number' && source.progress >= 100)
            ) {
                console.log(`[useSourceProcessing] Source ${source.source_id} ${status ?? 'done'}, closing modal`);
                // Close modal
                setModalState({ type: 'hidden' });
                handledReadySourcesRef.current.delete(source.source_id);
                // Clean up analysis limits
                setAnalysisLimits((prev) => {
                    if (prev[source.source_id]) {
                        const updated = { ...prev };
                        delete updated[source.source_id];
                        return updated;
                    }
                    return prev;
                });
            }
        }
    }, []); // No dependencies - uses ref instead!

    /**
     * Cancel/close modal
     */
    const closeModal = useCallback(() => {
        setModalState({ type: 'hidden' });
    }, []);

    return {
        modalState,
        analysisLimits,
        handleSourceReady,
        startAnalysis,
        updateFromSourceStatus,
        closeModal,
    };
}
