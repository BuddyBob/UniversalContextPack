'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, AlertCircle, RefreshCw, Download, GitBranch, Check } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { API_BASE_URL } from '@/lib/api';

type WorkflowStage = 'idle' | 'creating_pack' | 'uploading' | 'extracting' | 'analyzing' | 'completed' | 'error';

interface SourceStatus {
    source_id: string;
    status: string;
    progress?: number;
    total_chunks?: number;
    processed_chunks?: number;
    extracted_count?: number;
    error_message?: string;
}

interface PackDetails {
    sources?: SourceStatus[];
}

interface CreditInfo {
    needsPurchase?: boolean;
    creditsRequired?: number;
    userCredits?: number;
    totalChunks?: number;
}

const ACTIVE_SOURCE_STATUSES = ['extracting', 'ready_for_analysis', 'analyzing', 'building_tree'] as const;
const ACCEPTED_FORMATS = ['PDF', 'TXT', 'DOCX', 'CSV', 'ZIP', 'conversations.json'] as const;

export default function ProcessV4Page() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, session, makeAuthenticatedRequest } = useAuth();

    const [isProcessing, setIsProcessing] = useState(false);
    const [workflowStage, setWorkflowStage] = useState<WorkflowStage>('idle');

    const [currentPackId, setCurrentPackId] = useState<string | null>(null);
    const [currentSourceId, setCurrentSourceId] = useState<string | null>(null);
    const [errorMessage, setErrorMessage] = useState<string | null>(null);

    const [uploadSize, setUploadSize] = useState(0);
    const [uploadPercent, setUploadPercent] = useState(0);
    const [backendStatus, setBackendStatus] = useState<SourceStatus | null>(null);
    const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
    const [analysisTargetChunks, setAnalysisTargetChunks] = useState<number | null>(null);
    const [showEmailSentToast, setShowEmailSentToast] = useState(false);
    const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
    const abortControllerRef = useRef<{ abort: () => void } | null>(null);
    const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollingActiveRef = useRef(false);
    const operationIdRef = useRef(0);
    const uploadWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousWorkflowStageRef = useRef<WorkflowStage>('idle');
    const backendStatusRef = useRef<SourceStatus | null>(null);

    const getErrorMessage = (error: unknown) => {
        return error instanceof Error ? error.message : 'An unknown error occurred.';
    };

    const getCompletedSource = (sources: SourceStatus[] = []) => {
        return sources.find((source) => source.status === 'completed') || null;
    };

    const getRelevantSource = (sources: SourceStatus[] = [], sourceId?: string | null) => {
        if (sourceId) {
            const matchingSource = sources.find((source) => source.source_id === sourceId);
            if (matchingSource) return matchingSource;
        }

        return sources[0] || null;
    };

    const getWorkflowStageForStatus = (status: string): WorkflowStage => {
        if (status === 'analyzing' || status === 'analyzing_chunks' || status === 'building_tree') {
            return 'analyzing';
        }

        if (status === 'completed') return 'completed';
        if (status === 'failed' || status === 'cancelled') return 'error';
        return 'extracting';
    };

    const resetWorkflowState = () => {
        setIsProcessing(false);
        setWorkflowStage('idle');
        setErrorMessage(null);
        setCurrentPackId(null);
        setCurrentSourceId(null);
        setBackendStatus(null);
        setCreditInfo(null);
        setAnalysisTargetChunks(null);
        setShowEmailSentToast(false);
        setIsStartingAnalysis(false);
        setUploadSize(0);
        setUploadPercent(0);
    };

    const clearPollingTimers = () => {
        if (pollingIntervalRef.current) clearTimeout(pollingIntervalRef.current);
        if (heartbeatIntervalRef.current) clearInterval(heartbeatIntervalRef.current);
    };

    const getEstimateForChunks = (chunks: number) => {
        if (chunks <= 0) return null;
        if (chunks <= 5) return '~3-7 min';
        if (chunks <= 10) return '~5-12 min';
        if (chunks <= 20) return '~10-20 min';
        if (chunks <= 50) return '~20-40 min';
        return '~40-90+ min';
    };

    const getExtractionEstimate = (chunks: number, sizeMb: number) => {
        if (chunks > 0) {
            if (chunks <= 10) return '~1-2 min';
            if (chunks <= 25) return '~2-3 min';
            if (chunks <= 50) return '~3-4 min';
            if (chunks <= 100) return '~4-5 min';
            if (chunks <= 150) return '~5-7 min';
            return '~7-10 min';
        }

        if (sizeMb <= 0) return null;
        if (sizeMb < 10) return '~1-2 min';
        if (sizeMb < 50) return '~2-4 min';
        if (sizeMb < 150) return '~4-6 min';
        return '~6-10 min';
    };

    const getEmailEtaMessage = () => {
        const chunks = analysisTargetChunks ?? backendStatus?.total_chunks;
        if (!chunks || chunks <= 0) {
            return "We'll email you when it's ready. Small uploads finish in minutes; larger ones may take longer.";
        }

        const eta = getEstimateForChunks(chunks) || 'minutes';
        return `We’ll email you when it’s ready (${eta}).`;
    };

    useEffect(() => {
        return () => {
            clearPollingTimers();
            if (abortControllerRef.current) abortControllerRef.current.abort();
            if (uploadWatchdogRef.current) clearTimeout(uploadWatchdogRef.current);
        };
    }, []);

    useEffect(() => {
        const previousStage = previousWorkflowStageRef.current;

        if (workflowStage === 'completed' && previousStage !== 'completed') {
            setShowEmailSentToast(true);

            const timeoutId = setTimeout(() => {
                setShowEmailSentToast(false);
            }, 6000);

            previousWorkflowStageRef.current = workflowStage;
            return () => clearTimeout(timeoutId);
        }

        previousWorkflowStageRef.current = workflowStage;
    }, [workflowStage]);

    useEffect(() => {
        backendStatusRef.current = backendStatus;
    }, [backendStatus]);

    useEffect(() => {
        const checkExistingPack = async () => {
            const packId = searchParams.get('pack');
            if (!packId || !user) return;
            
            try {
                const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${packId}`);
                if (!response.ok) return;
                
                const data: PackDetails = await response.json();
                const sources = data.sources || [];
                const activeSource = sources.find((source) => ACTIVE_SOURCE_STATUSES.includes(source.status as (typeof ACTIVE_SOURCE_STATUSES)[number]));
                const completedSource = !activeSource ? getCompletedSource(sources) : null;
                if (completedSource) {
                    setCurrentPackId(packId);
                    setIsProcessing(true);
                    setBackendStatus(completedSource);
                    setWorkflowStage('completed');
                    return;
                }
                
                if (activeSource) {
                    setCurrentPackId(packId);
                    setCurrentSourceId(activeSource.source_id);
                    setBackendStatus(activeSource);
                    setWorkflowStage(getWorkflowStageForStatus(activeSource.status));
                    
                    setIsProcessing(true);
                    startPolling(packId, ++operationIdRef.current, activeSource.source_id);
                }
            } catch (err) {
                console.error('[ProcessV4] Failed to check existing pack state', err);
            }
        };

        checkExistingPack();
    }, [makeAuthenticatedRequest, searchParams, user]);

    useEffect(() => {
        if (!isProcessing || workflowStage !== 'extracting' || backendStatus || !currentPackId) {
            if (uploadWatchdogRef.current) clearTimeout(uploadWatchdogRef.current);
            return;
        }

        uploadWatchdogRef.current = setTimeout(async () => {
            try {
                const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${currentPackId}`);
                if (!response.ok) return;

                const data: PackDetails = await response.json();
                const sources = data.sources || [];

                if (sources.length === 0) {
                    handleError('Upload did not register. Please retry the upload.');
                    return;
                }

                const src = sources[0];
                setBackendStatus(src);
                setCurrentSourceId(src.source_id);

                const opId = ++operationIdRef.current;
                startPolling(currentPackId, opId, src.source_id);
            } catch (e) {
                console.warn('[ProcessV4] Watchdog failed to refresh pack state:', e);
            }
        }, 5000);

        return () => {
            if (uploadWatchdogRef.current) clearTimeout(uploadWatchdogRef.current);
        };
    }, [isProcessing, workflowStage, backendStatus, currentPackId, makeAuthenticatedRequest]);

    const handleFilesDropped = async (files: FileList | null) => {
        if (!files || files.length === 0 || !user) return;

        const file = files[0];
        if (file.name.toLowerCase().endsWith('.json') && file.name.toLowerCase() !== 'conversations.json') {
            alert("Please upload the specific file named 'conversations.json' from your ChatGPT export.");
            return;
        }

        startWorkflow(file);
    };

    const startWorkflow = async (file: File) => {
        const opId = ++operationIdRef.current;
        setIsProcessing(true);
        setErrorMessage(null);
        setUploadSize(file.size);
        setBackendStatus(null);
        setCreditInfo(null);
        setAnalysisTargetChunks(null);
        setShowEmailSentToast(false);
        setIsStartingAnalysis(false);
        setUploadPercent(0);

        try {
            setWorkflowStage('creating_pack');
            let packId = searchParams.get('pack');

            if (packId) {
                setCurrentPackId(packId);
            } else {
                const packName = file.name.split('.')[0] || 'My Context Pack';
                const packRes = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`, {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ pack_name: packName })
                });

                if (operationIdRef.current !== opId) return;
                if (!packRes.ok) throw new Error('Failed to initialize pack server-side.');
                const packData = await packRes.json();
                if (operationIdRef.current !== opId) return;

                packId = packData.pack_id;
                setCurrentPackId(packId);
            }

            if (packId && searchParams.get('pack') !== packId) {
                router.replace(`/process-v4?pack=${packId}`);
            }

            if (!packId) throw new Error('Could not resolve an active pack ID.');

            setWorkflowStage('uploading');
            await uploadFile(packId, file);
            if (operationIdRef.current !== opId) return;

            startPolling(packId, opId);

        } catch (error) {
            if (operationIdRef.current !== opId) return;
            console.error('[ProcessV4] Workflow Error:', error);
            handleError(error instanceof Error ? error.message : 'An unknown error occurred.');
        }
    };

    const getAccessToken = async () => {
        if (session?.access_token) {
            return session.access_token;
        }

        const { data: { session: fallbackSession } } = await supabase.auth.getSession();
        if (!fallbackSession) throw new Error('Authentication expired.');
        return fallbackSession.access_token;
    };

    const fetchWithSession = async (url: string, options: RequestInit = {}, timeoutMs = 30000) => {
        const accessToken = await getAccessToken();

        const controller = new AbortController();
        const timeoutId = setTimeout(() => controller.abort(), timeoutMs);
        const upstreamSignal = options.signal;
        const abortFromUpstream = () => controller.abort();

        if (upstreamSignal) {
            if (upstreamSignal.aborted) {
                controller.abort();
            } else {
                upstreamSignal.addEventListener('abort', abortFromUpstream);
            }
        }

        try {
            const response = await fetch(url, {
                ...options,
                headers: {
                    ...options.headers,
                    Authorization: `Bearer ${accessToken}`,
                },
                cache: 'no-store',
                signal: controller.signal,
            });

            clearTimeout(timeoutId);
            if (upstreamSignal) {
                upstreamSignal.removeEventListener('abort', abortFromUpstream);
            }
            return response;
        } catch (error) {
            clearTimeout(timeoutId);
            if (upstreamSignal) {
                upstreamSignal.removeEventListener('abort', abortFromUpstream);
            }
            throw error;
        }
    };

    const uploadFile = async (packId: string, file: File): Promise<void> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Authentication expired.');

        const formData = new FormData();
        formData.append('file', file);

        await new Promise<void>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            xhr.open('POST', `${API_BASE_URL}/api/v2/packs/${packId}/sources`);
            xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
            xhr.timeout = 10 * 60 * 1000;

            abortControllerRef.current = { abort: () => xhr.abort() };

            xhr.upload.addEventListener('progress', (event) => {
                if (!event.lengthComputable) return;
                setUploadPercent(Math.min(100, Math.round((event.loaded / event.total) * 100)));
            });

            xhr.addEventListener('load', () => {
                if (xhr.status >= 200 && xhr.status < 300) {
                    setUploadPercent(100);
                    resolve();
                    return;
                }

                reject(new Error(`Server rejected upload: ${xhr.status} - ${xhr.responseText}`));
            });

            xhr.addEventListener('error', () => {
                reject(new Error('Upload failed before the file reached the server.'));
            });

            xhr.addEventListener('timeout', () => {
                reject(new Error('Upload timed out before the file finished sending.'));
            });

            xhr.addEventListener('abort', () => {
                reject(new Error('Upload was cancelled.'));
            });

            xhr.send(formData);
        });

        setWorkflowStage('extracting');
    };

    const fetchPackDetails = async (packId: string, timeoutMs = 30000) => {
        const response = await fetchWithSession(`${API_BASE_URL}/api/v2/packs/${packId}`, {}, timeoutMs);
        if (!response.ok) return null;
        return response.json() as Promise<PackDetails>;
    };

    const startPolling = (packId: string, opId: number, knownSourceId?: string) => {
        clearPollingTimers();
        pollingActiveRef.current = true;

        let hasHitReadyForAnalysis = false;
        let resolvedSourceId = knownSourceId || null;

        const processSourceStatus = async (src: SourceStatus) => {
            if (operationIdRef.current !== opId) return;
            const status = src.status;
            const currentStatus = backendStatusRef.current?.status;

            if (
                (status === 'processing' || status === 'extracting') &&
                (currentStatus === 'ready_for_analysis' || currentStatus === 'analyzing' || currentStatus === 'analyzing_chunks' || currentStatus === 'building_tree' || currentStatus === 'completed')
            ) {
                return;
            }

            setBackendStatus(src);

            if (status === 'processing' || status === 'extracting') {
                setWorkflowStage('extracting');
            } else if (status === 'ready_for_analysis') {
                setWorkflowStage('extracting');
                if (!hasHitReadyForAnalysis) {
                    hasHitReadyForAnalysis = true;
                    await triggerAutoAnalysis(src.source_id, src.total_chunks || 0, opId);
                }
            } else if (status === 'analyzing' || status === 'analyzing_chunks' || status === 'building_tree') {
                hasHitReadyForAnalysis = true;
                setWorkflowStage('analyzing');
            } else if (status === 'completed') {
                pollingActiveRef.current = false;
                setWorkflowStage('completed');
            } else if (status === 'failed' || status === 'cancelled') {
                pollingActiveRef.current = false;
                handleError(src.error_message || 'Processing failed.');
            }
        };

        const poll = async () => {
            if (operationIdRef.current !== opId) return;
            try {
                if (resolvedSourceId) {
                    const res = await fetchWithSession(
                        `${API_BASE_URL}/api/v2/sources/${resolvedSourceId}/status`,
                        {},
                        60000
                    );
                    if (operationIdRef.current !== opId) return;
                    if (res.ok) {
                        const src = await res.json();
                        if (operationIdRef.current !== opId) return;
                        setCurrentSourceId(src.source_id);
                        await processSourceStatus(src);
                    }
                } else {
                    const packData = await fetchPackDetails(packId);
                    if (operationIdRef.current !== opId || !packData) return;
                    const src = getRelevantSource(packData.sources, resolvedSourceId);
                    if (src) {
                        resolvedSourceId = src.source_id;
                        setCurrentSourceId(src.source_id);
                        await processSourceStatus(src);
                    }
                }
            } catch (err) {
                if (operationIdRef.current !== opId) return;
                console.error('[ProcessV4] Poll error:', err);

                try {
                    const packData = await fetchPackDetails(packId);
                    if (operationIdRef.current !== opId || !packData) return;
                    const latestSource = getRelevantSource(packData.sources, resolvedSourceId);
                    if (latestSource) {
                        if (latestSource.status === 'completed' || latestSource.status === 'failed' || latestSource.status === 'cancelled') {
                            pollingActiveRef.current = false;
                        }
                        resolvedSourceId = latestSource.source_id;
                        setCurrentSourceId(latestSource.source_id);
                        await processSourceStatus(latestSource);
                        return;
                    }
                } catch (fallbackErr) {
                    if (operationIdRef.current !== opId) return;
                    console.error('[ProcessV4] Pack fallback poll error:', fallbackErr);
                }
            } finally {
                if (pollingActiveRef.current && operationIdRef.current === opId) {
                    pollingIntervalRef.current = setTimeout(poll, 1000);
                }
            }
        };

        poll();

        heartbeatIntervalRef.current = setInterval(async () => {
            if (!pollingActiveRef.current || operationIdRef.current !== opId) return;
            try {
                const packData = await fetchPackDetails(packId);
                if (!packData) return;
                const latestSource = getRelevantSource(packData.sources, resolvedSourceId);
                if (latestSource && operationIdRef.current === opId) {
                    if (latestSource.status === 'completed' || latestSource.status === 'failed' || latestSource.status === 'cancelled') {
                        pollingActiveRef.current = false;
                    }
                    resolvedSourceId = latestSource.source_id;
                    setCurrentSourceId(latestSource.source_id);
                    await processSourceStatus(latestSource);
                }
            } catch (hbErr) {
                console.warn('[ProcessV4] Pack heartbeat poll error:', hbErr);
            }
        }, 10000);
    };

    const triggerAutoAnalysis = async (sourceId: string, totalChunks: number, opId: number) => {
        try {
            const creditRes = await fetchWithSession(`${API_BASE_URL}/api/v2/sources/${sourceId}/credit-check`, {}, 30000);
            if (operationIdRef.current !== opId) return;

            if (!creditRes.ok) {
                // Credit-check failed — don't try to proceed blindly. Surface the gate so the user
                // can take action (retry, buy credits, or see an error message).
                const errBody = creditRes.ok ? null : await creditRes.json().catch(() => ({}));
                const detail = errBody?.detail || 'Could not verify credits.';
                handleError(`Credit check failed: ${detail}`);
                return;
            }

            const info = await creditRes.json();
            if (operationIdRef.current !== opId) return;

            setCreditInfo(info);

            if (info.needsPurchase) {
                return;
            }

            setAnalysisTargetChunks(totalChunks > 0 ? totalChunks : info.totalChunks || null);
            setWorkflowStage('analyzing');

            const startRes = await fetchWithSession(
                `${API_BASE_URL}/api/v2/sources/${sourceId}/start-analysis`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        selected_chunks: [],
                        max_chunks: undefined
                    })
                }
            );

            if (operationIdRef.current !== opId) return;
            if (!startRes.ok) {
                const errData = await startRes.text();
                throw new Error(`Failed to start analysis: ${startRes.status} ${errData}`);
            }
        } catch (e) {
            if (operationIdRef.current !== opId) return;
            handleError(getErrorMessage(e));
        }
    };

    const triggerManualAnalysis = async () => {
        if (!currentSourceId) return;
        
        try {
            setIsStartingAnalysis(true);
            const creditRes = await fetchWithSession(`${API_BASE_URL}/api/v2/sources/${currentSourceId}/credit-check`, {}, 30000);
            if (!creditRes.ok) throw new Error("Could not check credits");
            
            const info = await creditRes.json();
            setCreditInfo(info);

            const totalChunks = backendStatus?.total_chunks || 0;
            
            let maxChunksToProcess: number | undefined = undefined;
            if (info.needsPurchase) {
                maxChunksToProcess = info.userCredits as number;
                if (typeof maxChunksToProcess === 'number' && maxChunksToProcess <= 0) {
                    throw new Error("Insufficient credits. Please buy more credits to continue.");
                }
            }

            const chunksToAnalyze =
                typeof maxChunksToProcess === 'number'
                    ? Math.min(maxChunksToProcess, totalChunks || info.totalChunks || maxChunksToProcess)
                    : (totalChunks || info.totalChunks || null);

            setAnalysisTargetChunks(chunksToAnalyze);
            setWorkflowStage('analyzing');

            const startRes = await fetchWithSession(
                `${API_BASE_URL}/api/v2/sources/${currentSourceId}/start-analysis`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        selected_chunks: [],
                        max_chunks: maxChunksToProcess
                    })
                }
            );

            if (!startRes.ok) {
                const errData = await startRes.text();
                throw new Error(`Failed to start analysis: ${startRes.status} ${errData}`);
            }
        } catch (e) {
            handleError(getErrorMessage(e));
        } finally {
            setIsStartingAnalysis(false);
        }
    };

    const handleError = (msg: string) => {
        pollingActiveRef.current = false;
        setErrorMessage(msg);
        setWorkflowStage('error');
        setIsProcessing(false);
        clearPollingTimers();
        if (abortControllerRef.current) abortControllerRef.current.abort();
    };

    const cancelWorkflow = () => {
        operationIdRef.current++;
        pollingActiveRef.current = false;
        if (abortControllerRef.current) abortControllerRef.current.abort();
        clearPollingTimers();

        if (currentSourceId) {
            makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/sources/${currentSourceId}/cancel`, { method: 'POST' }).catch(() => { });
        }

        resetWorkflowState();
    };

    const creditsNeeded = creditInfo?.creditsRequired || 0;
    const creditsHave = creditInfo?.userCredits ?? 0;
    const creditShortfall = Math.max(0, creditsNeeded - creditsHave);
    const needsCreditPurchase = !!(creditInfo?.needsPurchase && workflowStage !== 'analyzing' && workflowStage !== 'completed');
    const isReadyForAnalysis = backendStatus?.status === 'ready_for_analysis' && workflowStage !== 'analyzing' && workflowStage !== 'completed';
    const pageEyebrow = searchParams.get('pack') ? 'Add Source' : 'Create Pack';
    const chunkCount = backendStatus?.total_chunks ?? 0;
    const chunkLabel = chunkCount > 0 ? `${chunkCount} chunk${chunkCount === 1 ? '' : 's'}` : 'Chunk count pending';
    const uploadMb = uploadSize / 1024 / 1024;
    const extractionProgress = typeof backendStatus?.progress === 'number'
        ? Math.max(0, Math.min(100, Math.round(backendStatus.progress)))
        : null;
    const estimatedProcessableChunks = (() => {
        if (analysisTargetChunks && analysisTargetChunks > 0) return analysisTargetChunks;
        if (needsCreditPurchase && creditsHave > 0) return Math.min(chunkCount || creditsHave, creditsHave);
        return chunkCount;
    })();
    const stageEstimate = (() => {
        if ((workflowStage === 'analyzing' || workflowStage === 'completed' || isReadyForAnalysis || needsCreditPurchase) && estimatedProcessableChunks > 0) {
            return getEstimateForChunks(estimatedProcessableChunks);
        }
        if (workflowStage === 'uploading' || workflowStage === 'extracting' || workflowStage === 'creating_pack') {
            return getExtractionEstimate(chunkCount, uploadMb);
        }
        return null;
    })();
    const workflowSummary = (() => {
        if (isReadyForAnalysis) {
            return {
                label: 'Ready',
                title: 'Extraction is complete.',
                description: 'Your source has been chunked and is ready to analyze.',
            };
        }
        if (workflowStage === 'completed') {
            return {
                label: 'Complete',
                title: 'Your context pack is ready.',
                description: 'Analysis finished successfully. You can open the memory tree or export the processed files.',
            };
        }
        if (workflowStage === 'analyzing') {
            return {
                label: 'Analyzing',
                title: 'Building the knowledge graph.',
                description: 'No action needed. We will email you when analysis is finished.',
            };
        }
        if (workflowStage === 'uploading') {
            return {
                label: 'Uploading',
                title: 'Sending your file to the processing pipeline.',
                description: 'Keep this tab open while the upload is registered.',
            };
        }
        if (workflowStage === 'extracting' || workflowStage === 'creating_pack') {
            return {
                label: 'Preparing',
                title: 'Extracting text and structuring your source.',
                description: 'We are validating the file, splitting it into chunks, and preparing it for analysis.',
            };
        }
        if (workflowStage === 'error') {
            return {
                label: 'Error',
                title: 'The process could not be completed.',
                description: errorMessage || 'Please try again.',
            };
        }
        return {
            label: 'Upload',
            title: 'Drop a source and process it.',
            description: 'Upload a document or export and we will extract, chunk, and prepare it for analysis.',
        };
    })();
    const visibleProgress = workflowStage === 'uploading'
        ? uploadPercent
        : workflowStage === 'extracting'
            ? extractionProgress
            : null;
    const progressMeta = (() => {
        if (workflowStage === 'uploading') {
            return uploadPercent > 0 ? `${uploadPercent}% uploaded` : 'Starting upload…';
        }

        if (workflowStage === 'extracting') {
            if (extractionProgress !== null) {
                const suffix = chunkCount > 0 ? ` · ${chunkLabel}` : '';
                return `${extractionProgress}% complete${suffix}`;
            }

            if (chunkCount > 0) {
                return `${chunkLabel} created`;
            }

            if (typeof backendStatus?.extracted_count === 'number' && backendStatus.extracted_count > 0) {
                return `${backendStatus.extracted_count.toLocaleString()} items extracted`;
            }
        }

        return null;
    })();
    const downloadFile = async (endpoint: string, filename: string, notFoundMessage?: string) => {
        const response = await makeAuthenticatedRequest(endpoint);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            anchor.click();
            window.URL.revokeObjectURL(url);
            return;
        }

        if (response.status === 404 && notFoundMessage) {
            alert(notFoundMessage);
        }
    };

    return (
        <div className="min-h-screen bg-[#08110f] text-white">
            <style jsx>{`
                @keyframes indeterminate-sweep {
                    0% { transform: translateX(-40%); }
                    100% { transform: translateX(120%); }
                }
            `}</style>
            <div className="absolute inset-0 bg-[radial-gradient(circle_at_top_left,rgba(120,180,150,0.16),transparent_34%),radial-gradient(circle_at_80%_20%,rgba(255,255,255,0.06),transparent_28%)] pointer-events-none" />
            {showEmailSentToast && (
                <div className="fixed right-6 top-6 z-50 max-w-sm rounded-2xl border border-emerald-400/20 bg-[#10211a]/95 px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.35)] backdrop-blur-sm">
                    <div className="flex items-start gap-3">
                        <div className="mt-0.5 flex h-8 w-8 items-center justify-center rounded-full bg-emerald-400/12">
                            <Check className="h-4 w-4 text-emerald-300" />
                        </div>
                        <div>
                            <p className="text-sm font-medium text-white">Analysis complete</p>
                            <p className="mt-1 text-sm leading-5 text-[#a8b7b0]">
                                Your pack is ready, and the completion email has been sent.
                            </p>
                        </div>
                    </div>
                </div>
            )}

            <div className="relative mx-auto flex min-h-screen w-full max-w-6xl flex-col px-6 py-10 sm:px-8 lg:px-10">
                <div className="mb-10 flex items-center justify-between">
                    <button
                        onClick={() => router.push('/packs')}
                        className="text-sm text-[#9ca8a1] transition-colors hover:text-white"
                    >
                        ← All Context Packs
                    </button>
                    <span className="rounded-full border border-white/10 bg-white/[0.03] px-3 py-1 text-[11px] uppercase tracking-[0.24em] text-[#8d9993]">
                        v4.0
                    </span>
                </div>

                <div className="mx-auto w-full max-w-4xl">
                    <section className="rounded-[32px] border border-white/10 bg-[#0b1512]/90 p-8 shadow-[0_30px_80px_rgba(0,0,0,0.28)] backdrop-blur-sm sm:p-10">
                        <div className="mb-10 border-b border-white/10 pb-8">
                            <div className="max-w-2xl">
                                <p className="mb-4 text-[11px] uppercase tracking-[0.32em] text-[#8ea096]">
                                    {pageEyebrow}
                                </p>
                                <h1 className="max-w-xl text-4xl font-semibold tracking-[-0.04em] text-white sm:text-5xl">
                                    Drop a source. We handle the processing.
                                </h1>
                                <p className="mt-4 max-w-xl text-base leading-7 text-[#9aa8a1] sm:text-lg">
                                    Upload a file once. We extract the useful content, prepare it for analysis, and notify you when the pack is ready.
                                </p>
                            </div>
                        </div>

                        {!isProcessing ? (
                            <label className="group block cursor-pointer rounded-[28px] border border-dashed border-white/18 bg-[linear-gradient(180deg,rgba(255,255,255,0.04),rgba(255,255,255,0.01))] p-8 transition-all hover:border-white/30 hover:bg-white/[0.05] sm:p-10">
                                <input
                                    type="file"
                                    accept=".pdf,.txt,.doc,.docx,.csv,.json,.zip"
                                    onChange={(e) => handleFilesDropped(e.target.files)}
                                    className="hidden"
                                    disabled={!user}
                                />
                                <div className="flex h-14 w-14 items-center justify-center rounded-2xl border border-white/12 bg-white/[0.04] transition-colors group-hover:border-white/25 group-hover:bg-white/[0.08]">
                                    <Upload className="h-5 w-5 text-[#d7dfdb]" />
                                </div>
                                <h2 className="mt-8 text-2xl font-semibold tracking-[-0.03em] text-white">
                                    Select or drop a file
                                </h2>
                                <div className="mt-8 flex flex-wrap gap-2">
                                    {ACCEPTED_FORMATS.map((format) => (
                                        <span
                                            key={format}
                                            className="rounded-full border border-white/10 bg-white/[0.04] px-3 py-1.5 text-xs text-[#c9d1cd]"
                                        >
                                            {format}
                                        </span>
                                    ))}
                                </div>
                                {!user && (
                                    <div className="mt-8 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/8 px-4 py-2 text-xs text-red-300">
                                        <AlertCircle className="h-3.5 w-3.5" />
                                        Sign in to upload a source
                                    </div>
                                )}
                            </label>
                        ) : workflowStage === 'error' ? (
                            <div className="rounded-[28px] border border-red-400/16 bg-[linear-gradient(180deg,rgba(127,29,29,0.18),rgba(12,18,16,0.9))] p-8">
                                <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                                    <div className="max-w-xl">
                                        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/16 bg-red-400/10">
                                            <AlertCircle className="h-5 w-5 text-red-300" />
                                        </div>
                                        <p className="text-[11px] uppercase tracking-[0.24em] text-red-200/80">Processing issue</p>
                                        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                            {workflowSummary.title}
                                        </h2>
                                        <p className="mt-3 text-sm leading-6 text-[#d5b5b5]">
                                            {workflowSummary.description}
                                        </p>
                                    </div>

                                    <button
                                        onClick={cancelWorkflow}
                                        className="inline-flex items-center gap-2 self-start rounded-full border border-white/14 bg-white/[0.05] px-5 py-2.5 text-sm text-white transition-colors hover:bg-white/[0.1]"
                                    >
                                        <RefreshCw className="h-3.5 w-3.5" />
                                        Reset and try again
                                    </button>
                                </div>
                            </div>
                        ) : needsCreditPurchase ? (
                            <div className="overflow-hidden rounded-[28px] border border-[#d1c29a]/18 bg-[linear-gradient(180deg,rgba(36,31,22,0.9),rgba(11,21,18,0.95))]">
                                <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
                                    <div className="border-b border-white/8 p-8 lg:border-b-0 lg:border-r">
                                        <p className="text-[11px] uppercase tracking-[0.24em] text-[#b7ab87]">Ready for analysis</p>
                                        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                            Credits are needed to continue.
                                        </h2>
                                        <p className="mt-3 max-w-xl text-sm leading-6 text-[#bdb7a6]">
                                            Extraction finished successfully. You can continue with your current balance or add credits to process the full source.
                                        </p>

                                        <div className="mt-8 flex flex-wrap gap-3">
                                            {creditsHave > 0 && (
                                                <button
                                                    onClick={triggerManualAnalysis}
                                                    disabled={isStartingAnalysis}
                                                    className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#ebefed]"
                                                >
                                                    {isStartingAnalysis ? 'Starting…' : `Analyze with ${creditsHave} credits`}
                                                </button>
                                            )}
                                            <a
                                                href="/pricing"
                                                className="rounded-full border border-[#cdbb8d]/28 px-5 py-2.5 text-sm text-[#f0ddaf] transition-colors hover:border-[#e5cf95]/45 hover:text-[#fff1c9]"
                                            >
                                                Add credits
                                            </a>
                                            <button
                                                onClick={cancelWorkflow}
                                                className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-[#a9afa9] transition-colors hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-px bg-white/8 p-px lg:grid-cols-1">
                                        <div className="bg-[#111916] p-6">
                                            <p className="text-[11px] uppercase tracking-[0.24em] text-[#7f8d87]">Chunks extracted</p>
                                            <p className="mt-3 text-3xl font-semibold text-white">{chunkCount}</p>
                                        </div>
                                        <div className="bg-[#111916] p-6">
                                            <p className="text-[11px] uppercase tracking-[0.24em] text-[#7f8d87]">Credit balance</p>
                                            <p className="mt-3 text-3xl font-semibold text-white">
                                                {creditsHave}
                                                <span className="mx-1 text-[#54605b]">/</span>
                                                <span className="text-[#f0ddaf]">{creditsNeeded}</span>
                                            </p>
                                            <p className="mt-2 text-sm text-[#9da8a1]">
                                                {creditShortfall > 0 ? `${creditShortfall} more needed for full analysis` : 'Sufficient balance'}
                                            </p>
                                            {stageEstimate && (
                                                <p className="mt-2 text-sm text-[#9da8a1]">
                                                    Estimate for current balance: {stageEstimate}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : isReadyForAnalysis ? (
                            <div className="overflow-hidden rounded-[28px] border border-[#9fdbc3]/16 bg-[linear-gradient(180deg,rgba(15,41,33,0.88),rgba(10,18,15,0.98))]">
                                <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
                                    <div className="border-b border-white/8 p-8 lg:border-b-0 lg:border-r">
                                        <p className="text-[11px] uppercase tracking-[0.24em] text-[#97ccb7]">Ready for analysis</p>
                                        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                            {workflowSummary.title}
                                        </h2>
                                        <p className="mt-3 max-w-xl text-sm leading-6 text-[#a9bbb4]">
                                            {workflowSummary.description}
                                        </p>

                                        <div className="mt-8 flex flex-wrap gap-3">
                                            <button
                                                onClick={triggerManualAnalysis}
                                                disabled={isStartingAnalysis}
                                                className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#ebefed]"
                                            >
                                                {isStartingAnalysis ? 'Starting…' : 'Analyze'}
                                            </button>
                                            <button
                                                onClick={cancelWorkflow}
                                                className="rounded-full border border-white/10 px-5 py-2.5 text-sm text-[#a9afa9] transition-colors hover:text-white"
                                            >
                                                Cancel
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid gap-px bg-white/8 p-px">
                                        <div className="bg-[#111916] p-6">
                                            <p className="text-[11px] uppercase tracking-[0.24em] text-[#7f8d87]">Chunks</p>
                                            <p className="mt-3 text-3xl font-semibold text-white">{chunkCount || 'Pending'}</p>
                                        </div>
                                        <div className="bg-[#111916] p-6">
                                            <p className="text-[11px] uppercase tracking-[0.24em] text-[#7f8d87]">Next step</p>
                                            <p className="mt-3 text-sm leading-6 text-[#c9d1cd]">
                                                Start analysis to build the knowledge graph for this source.
                                            </p>
                                            {stageEstimate && (
                                                <p className="mt-3 text-sm text-[#9ca9a3]">
                                                    Estimated runtime: {stageEstimate}
                                                </p>
                                            )}
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : workflowStage === 'completed' ? (
                            <div className="overflow-hidden rounded-[28px] border border-emerald-400/16 bg-[linear-gradient(180deg,rgba(17,48,38,0.85),rgba(11,21,18,0.98))]">
                                <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
                                    <div className="border-b border-white/8 p-8 lg:border-b-0 lg:border-r">
                                        <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-emerald-400/18 bg-emerald-400/10">
                                            <Check className="h-5 w-5 text-emerald-300" />
                                        </div>
                                        <p className="text-[11px] uppercase tracking-[0.24em] text-emerald-200/80">Complete</p>
                                        <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                            {workflowSummary.title}
                                        </h2>
                                        <p className="mt-3 max-w-xl text-sm leading-6 text-[#aebbb5]">
                                            {workflowSummary.description}
                                        </p>

                                        <div className="mt-8 grid gap-3 sm:grid-cols-2">
                                            <button
                                                onClick={() => currentPackId && router.push(`/tree/${currentPackId}`)}
                                                className="flex items-center justify-center gap-2 rounded-full bg-white px-5 py-3 text-sm font-medium text-black transition-colors hover:bg-[#ebefed]"
                                            >
                                                <GitBranch className="h-4 w-4" />
                                                Open Memory Tree
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    if (!currentPackId) return;
                                                    try {
                                                        await downloadFile(
                                                            `${API_BASE_URL}/api/v2/packs/${currentPackId}/export/complete`,
                                                            'context_pack.txt'
                                                        );
                                                    } catch (e) { console.error(e); }
                                                }}
                                                className="flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm text-white transition-colors hover:bg-white/[0.1]"
                                            >
                                                <Download className="h-4 w-4" />
                                                Download Pack
                                            </button>

                                            <button
                                                onClick={async () => {
                                                    if (!currentPackId) return;
                                                    try {
                                                        await downloadFile(
                                                            `${API_BASE_URL}/api/v2/packs/${currentPackId}/tree.json`,
                                                            'memory_tree.json',
                                                            'No memory tree file found.'
                                                        );
                                                    } catch (e) { console.error(e); }
                                                }}
                                                className="flex items-center justify-center gap-2 rounded-full border border-white/12 bg-white/[0.05] px-5 py-3 text-sm text-white transition-colors hover:bg-white/[0.1]"
                                            >
                                                <Download className="h-4 w-4" />
                                                Download Tree JSON
                                            </button>
                                        </div>
                                    </div>

                                    <div className="grid grid-cols-2 gap-px bg-white/8 p-px lg:grid-cols-1">
                                        <div className="bg-[#111916] p-6">
                                            <p className="text-[11px] uppercase tracking-[0.24em] text-[#7f8d87]">Processed</p>
                                            <p className="mt-3 text-3xl font-semibold text-white">{chunkLabel}</p>
                                        </div>
                                        <div className="bg-[#111916] p-6">
                                            <p className="text-[11px] uppercase tracking-[0.24em] text-[#7f8d87]">Pack</p>
                                            <p className="mt-3 text-sm leading-6 text-[#c9d1cd]">
                                                Stored under your context packs and ready for downstream browsing or export.
                                            </p>
                                        </div>
                                    </div>
                                </div>
                            </div>
                        ) : (
                            <div className="overflow-hidden rounded-[28px] border border-white/10 bg-[linear-gradient(180deg,rgba(16,27,23,0.94),rgba(10,18,15,0.98))] p-8">
                                <p className="text-[11px] uppercase tracking-[0.24em] text-[#8ea096]">
                                    {workflowSummary.label}
                                </p>
                                <div className="mt-3 flex flex-wrap items-center gap-3">
                                    <h2 className="text-2xl font-semibold tracking-[-0.03em] text-white">
                                        {workflowSummary.title}
                                    </h2>
                                    <button
                                        onClick={cancelWorkflow}
                                        className="rounded-full border border-white/10 px-4 py-1.5 text-xs uppercase tracking-[0.18em] text-[#98a49f] transition-colors hover:text-white"
                                    >
                                        Cancel
                                    </button>
                                </div>
                                <p className="mt-3 max-w-xl text-sm leading-6 text-[#98a49f]">
                                    {workflowStage === 'analyzing' ? getEmailEtaMessage() : workflowSummary.description}
                                </p>

                                <div className="mt-8">
                                    <div className="h-2 overflow-hidden rounded-full bg-white/8">
                                        <div
                                            className="relative h-full rounded-full transition-[width] duration-500 ease-out"
                                            style={{
                                                width: visibleProgress !== null ? `${visibleProgress}%` : '34%',
                                                background: 'linear-gradient(90deg, rgba(111,193,157,0.18), rgba(173,243,215,0.95))',
                                                animation: visibleProgress === null ? 'indeterminate-sweep 1.7s ease-in-out infinite alternate' : 'none',
                                                boxShadow: '0 0 24px rgba(152, 233, 204, 0.28)'
                                            }}
                                        />
                                    </div>
                                    <div className="mt-3 flex flex-wrap items-center justify-between gap-3 text-sm text-[#b5c0bb]">
                                        <div className="flex flex-col gap-1">
                                            <span>
                                                {workflowStage === 'uploading'
                                                    ? 'Upload in progress'
                                                    : workflowStage === 'analyzing'
                                                        ? 'Analysis running in the background'
                                                        : 'Extraction and chunking in progress'}
                                            </span>
                                            {progressMeta && (
                                                <span className="text-xs text-[#91a39b]">
                                                    {progressMeta}
                                                </span>
                                            )}
                                        </div>
                                        {stageEstimate && <span>{stageEstimate}</span>}
                                    </div>
                                </div>
                            </div>
                        )}
                    </section>
                </div>
            </div>
        </div>
    );
}
