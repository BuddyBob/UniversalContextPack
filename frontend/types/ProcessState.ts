export type ProcessState =
    | 'idle'
    | 'uploading'
    | 'extracting'
    | 'ready_for_analysis'
    | 'analyzing'
    | 'building_tree'
    | 'completed'
    | 'failed';

export interface ProcessStatus {
    state: ProcessState;
    sourceId: string;
    fileName: string;

    // Progress tracking
    currentChunk?: number;
    totalChunks?: number;
    progress?: number; // 0-100

    // Credit info (for ready_for_analysis state)
    creditsRequired?: number;
    userCredits?: number;
    canProceed?: boolean;
    hasUnlimited?: boolean;

    // Error handling
    error?: string;

    // Timestamps
    startedAt?: string;
    estimatedCompletion?: string;
}

/**
 * Maps backend status strings to ProcessState
 */
export function mapBackendStatus(backendStatus: string): ProcessState {
    const statusMap: Record<string, ProcessState> = {
        'uploading': 'uploading',
        'extracting': 'extracting',
        'ready_for_analysis': 'ready_for_analysis',
        'analyzing': 'analyzing',
        'analyzing_chunks': 'analyzing',
        'processing': 'analyzing',
        'building_tree': 'building_tree',
        'completed': 'completed',
        'failed': 'failed',
    };

    return statusMap[backendStatus] || 'idle';
}
