'use client';

import { useEffect, useState, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Upload, AlertCircle, RefreshCw, Download, GitBranch, Check, Activity, FileText, FolderOpen, MessageSquare, HelpCircle, Link2, AlignLeft, X } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { API_BASE_URL } from '@/lib/api';
import { analytics } from '@/lib/analytics';

type WorkflowStage = 'idle' | 'creating_pack' | 'uploading' | 'extracting' | 'analyzing' | 'completed' | 'error';

interface SourceStatus {
    source_id: string;
    status: string;
    source_name?: string;
    file_name?: string;
    progress?: number;
    total_chunks?: number;
    processed_chunks?: number;
    extracted_count?: number;
    error_message?: string;
}

interface PackDetails {
    pack_id?: string;
    pack_name?: string;
    sources?: SourceStatus[];
}

interface CreditInfo {
    needsPurchase?: boolean;
    creditsRequired?: number;
    userCredits?: number;
    totalChunks?: number;
}

interface SourceTile {
    key: string;
    title: string;
    description: string;
    icon: typeof MessageSquare;
    action: () => void;
    help?: boolean;
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
    const [packSources, setPackSources] = useState<SourceStatus[]>([]);
    const [creditInfo, setCreditInfo] = useState<CreditInfo | null>(null);
    const [analysisTargetChunks, setAnalysisTargetChunks] = useState<number | null>(null);
    const [showEmailSentToast, setShowEmailSentToast] = useState(false);
    const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
    const [packName, setPackName] = useState('');
    const [savedPackName, setSavedPackName] = useState('');
    const [isSavingPackName, setIsSavingPackName] = useState(false);
    const [isCreatingPackDraft, setIsCreatingPackDraft] = useState(false);
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [showTextModal, setShowTextModal] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const filePickerRef = useRef<HTMLInputElement | null>(null);
    const abortControllerRef = useRef<{ abort: () => void } | null>(null);
    const pollingIntervalRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const heartbeatIntervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
    const pollingActiveRef = useRef(false);
    const operationIdRef = useRef(0);
    const uploadWatchdogRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const savePackNameTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
    const previousWorkflowStageRef = useRef<WorkflowStage>('idle');
    const backendStatusRef = useRef<SourceStatus | null>(null);
    const pollRequestInFlightRef = useRef(false);
    const packLoadedAtRef = useRef<number | null>(null);
    const uploadStartedRef = useRef(false);
    const hoveredTilesRef = useRef<Set<string>>(new Set());

    const getErrorMessage = (error: unknown) => {
        return error instanceof Error ? error.message : 'An unknown error occurred.';
    };

    const getDefaultPackName = (fileName: string) => {
        const trimmed = fileName.trim();
        if (!trimmed) return 'My Context Pack';

        const lastDotIndex = trimmed.lastIndexOf('.');
        const baseName = lastDotIndex > 0 ? trimmed.slice(0, lastDotIndex) : trimmed;
        return baseName || 'My Context Pack';
    };

    const getSourceTypeForFile = (fileName: string): string => {
        const lower = fileName.toLowerCase();
        if (lower.endsWith('.json') || lower.endsWith('.zip')) return 'chat_export';
        return 'document';
    };

    const isDemoPackId = (packId: string | null | undefined) => !!packId && packId.startsWith('sample-');

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

    const applyPackDetails = (packData: PackDetails, preferredSourceId?: string | null) => {
        if (typeof packData.pack_name === 'string') {
            setPackName(packData.pack_name);
            setSavedPackName(packData.pack_name);
        }

        const sources = packData.sources || [];
        setPackSources(sources);

        const relevantSource = getRelevantSource(sources, preferredSourceId);
        if (relevantSource) {
            setCurrentSourceId(relevantSource.source_id);
        }

        return { sources, relevantSource };
    };

    const upsertPackSource = (source: SourceStatus) => {
        setPackSources((prev) => {
            const existingIndex = prev.findIndex((item) => item.source_id === source.source_id);
            if (existingIndex === -1) {
                return [source, ...prev];
            }

            const next = [...prev];
            next[existingIndex] = { ...next[existingIndex], ...source };
            return next;
        });
    };

    const resetWorkflowState = () => {
        setIsProcessing(false);
        setWorkflowStage('idle');
        setErrorMessage(null);
        setCurrentPackId(null);
        setCurrentSourceId(null);
        setBackendStatus(null);
        setPackSources([]);
        setCreditInfo(null);
        setAnalysisTargetChunks(null);
        setShowEmailSentToast(false);
        setIsStartingAnalysis(false);
        setPackName('');
        setSavedPackName('');
        setIsSavingPackName(false);
        setIsCreatingPackDraft(false);
        setShowUrlModal(false);
        setShowTextModal(false);
        setUrlInput('');
        setTextInput('');
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
            if (savePackNameTimeoutRef.current) clearTimeout(savePackNameTimeoutRef.current);
        };
    }, []);

    useEffect(() => {
        const packId = searchParams.get('pack');
        if (!packId) return;
        packLoadedAtRef.current = Date.now();
        analytics.packPageLoaded();

        const handleBeforeUnload = () => {
            if (!uploadStartedRef.current && packLoadedAtRef.current) {
                const seconds = Math.round((Date.now() - packLoadedAtRef.current) / 1000);
                analytics.packAbandoned(seconds);
            }
        };
        window.addEventListener('beforeunload', handleBeforeUnload);
        return () => window.removeEventListener('beforeunload', handleBeforeUnload);
    }, [searchParams]);

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
            if (!packId || !user || pollingActiveRef.current) return;
            
            try {
                setCurrentPackId(packId);
                const data = await fetchPackDetails(packId, 60000);
                if (!data) return;
                const { sources } = applyPackDetails(data);
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
    }, [searchParams, user, session]);

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
                const { sources } = applyPackDetails(data);

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
        console.log('[ProcessV4] File input changed', {
            hasFiles: !!files,
            fileCount: files?.length ?? 0,
            firstFileName: files?.[0]?.name,
        });

        if (!files || files.length === 0 || !user) return;

        analytics.fileSelected();
        const file = files[0];
        if (file.name.toLowerCase().endsWith('.json') && file.name.toLowerCase() !== 'conversations.json') {
            alert("Please upload the specific file named 'conversations.json' from your ChatGPT export.");
            return;
        }

        startWorkflow(file);
    };

    const startWorkflow = async (file: File) => {
        const opId = ++operationIdRef.current;
        const requestedPackName = packName.trim() || getDefaultPackName(file.name);
        console.log('[ProcessV4] Starting workflow', {
            opId,
            fileName: file.name,
            fileSize: file.size,
            requestedPackName,
            existingPackId: searchParams.get('pack'),
        });
        uploadStartedRef.current = true;
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

            if (isDemoPackId(packId)) {
                console.warn('[ProcessV4] Ignoring demo pack id and creating a real pack', { packId });
                packId = null;
            }

            if (packId) {
                console.log('[ProcessV4] Reusing existing pack', { packId });
                setCurrentPackId(packId);
            } else {
                const packData = await createPackOnServer(requestedPackName);
                if (operationIdRef.current !== opId) return;

                packId = packData.pack_id;
                setCurrentPackId(packId);
                setPackName(requestedPackName);
                setSavedPackName(requestedPackName);
            }

            if (packId && searchParams.get('pack') !== packId) {
                router.replace(`/process-v4?pack=${packId}`);
            }

            if (!packId) throw new Error('Could not resolve an active pack ID.');

            setWorkflowStage('uploading');
            console.log('[ProcessV4] Upload bootstrap ready', { packId, fileName: file.name });
            const uploadedSourceId = await uploadFile(packId, file);
            if (operationIdRef.current !== opId) return;

            console.log('[ProcessV4] Upload registered with backend', { packId, uploadedSourceId });
            setCurrentSourceId(uploadedSourceId);
            upsertPackSource({
                source_id: uploadedSourceId,
                source_name: file.name,
                file_name: file.name,
                status: 'extracting',
            });

            // Mirror the more reliable v3 flow: give the backend a moment to persist
            // the uploaded source, then refresh the pack before polling.
            await new Promise((resolve) => setTimeout(resolve, 500));
            if (operationIdRef.current !== opId) return;

            const refreshedPack = await fetchPackDetails(packId, 20000);
            if (operationIdRef.current !== opId) return;

            if (refreshedPack) {
                const { sources } = applyPackDetails(refreshedPack, uploadedSourceId);
                const confirmedSource =
                    sources.find((source) => source.source_id === uploadedSourceId) ||
                    sources.find((source) => (source.file_name || source.source_name) === file.name) ||
                    null;

                if (confirmedSource) {
                    console.log('[ProcessV4] Confirmed uploaded source via pack refresh', {
                        packId,
                        sourceId: confirmedSource.source_id,
                        status: confirmedSource.status,
                    });
                    setCurrentSourceId(confirmedSource.source_id);
                    setBackendStatus(confirmedSource);
                    startPolling(packId, opId, confirmedSource.source_id);
                    return;
                }

                console.warn('[ProcessV4] Upload response returned, but pack refresh did not confirm source yet', {
                    packId,
                    uploadedSourceId,
                    fileName: file.name,
                    sourceCount: sources.length,
                });
            }

            startPolling(packId, opId);

        } catch (error) {
            if (operationIdRef.current !== opId) return;
            console.error('[ProcessV4] Workflow Error:', error);
            handleError(error instanceof Error ? error.message : 'An unknown error occurred.');
        }
    };

    const getAccessToken = async () => {
        if (session?.access_token) {
            console.log('[ProcessV4] Using access token from AuthProvider session');
            return session.access_token;
        }

        console.log('[ProcessV4] Session missing in context, reading from Supabase');
        const fallbackSessionPromise = supabase.auth.getSession();
        const timeoutPromise = new Promise<never>((_, reject) => {
            setTimeout(() => reject(new Error('Timed out while reading auth session.')), 8000);
        });

        const { data: { session: fallbackSession } } = await Promise.race([
            fallbackSessionPromise,
            timeoutPromise,
        ]) as Awaited<typeof fallbackSessionPromise>;

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

    const uploadFile = async (packId: string, file: File): Promise<string> => {
        const { data: { session } } = await supabase.auth.getSession();
        if (!session) throw new Error('Authentication expired.');

        console.log('[ProcessV4] Preparing upload XHR', { packId, fileName: file.name, fileSize: file.size });
        const formData = new FormData();
        formData.append('file', file);
        formData.append('source_type', getSourceTypeForFile(file.name));

        const sourceId = await new Promise<string>((resolve, reject) => {
            const xhr = new XMLHttpRequest();
            let settled = false;
            let uploadStarted = false;
            let startupTimeout: ReturnType<typeof setTimeout> | null = null;

            const cleanup = () => {
                if (startupTimeout) {
                    clearTimeout(startupTimeout);
                    startupTimeout = null;
                }
            };

            const rejectOnce = (error: Error) => {
                if (settled) return;
                settled = true;
                cleanup();
                reject(error);
            };

            const resolveOnce = (nextSourceId: string) => {
                if (settled) return;
                settled = true;
                cleanup();
                resolve(nextSourceId);
            };

            xhr.open('POST', `${API_BASE_URL}/api/v2/packs/${packId}/sources`);
            xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
            xhr.timeout = 10 * 60 * 1000;

            abortControllerRef.current = { abort: () => xhr.abort() };

            xhr.addEventListener('loadstart', () => {
                uploadStarted = true;
                console.log('[ProcessV4] Upload loadstart', { fileName: file.name });
                setUploadPercent((current) => (current > 0 ? current : 1));
            });

            xhr.upload.addEventListener('progress', (event) => {
                uploadStarted = true;
                console.log('[ProcessV4] Upload progress event', {
                    fileName: file.name,
                    loaded: event.loaded,
                    total: event.total,
                    lengthComputable: event.lengthComputable,
                });
                if (!event.lengthComputable) return;
                setUploadPercent(Math.min(100, Math.round((event.loaded / event.total) * 100)));
            });

            xhr.addEventListener('load', async () => {
                console.log('[ProcessV4] Upload request completed', { fileName: file.name, status: xhr.status });
                if (xhr.status >= 200 && xhr.status < 300) {
                    setUploadPercent(100);
                    try {
                        const payload = JSON.parse(xhr.responseText) as { source_id?: string };
                        if (!payload.source_id) {
                            rejectOnce(new Error('Upload succeeded but no source ID was returned.'));
                            return;
                        }
                        resolveOnce(payload.source_id);
                    } catch {
                        rejectOnce(new Error('Upload succeeded but the server response could not be read.'));
                    }
                    return;
                }

                rejectOnce(new Error(`Server rejected upload: ${xhr.status} - ${xhr.responseText}`));
            });

            xhr.addEventListener('error', () => {
                console.error('[ProcessV4] Upload request errored', { fileName: file.name });
                rejectOnce(new Error('Upload failed before the file reached the server.'));
            });

            xhr.addEventListener('timeout', () => {
                console.error('[ProcessV4] Upload request timed out', { fileName: file.name });
                rejectOnce(new Error('Upload timed out before the file finished sending.'));
            });

            xhr.addEventListener('abort', () => {
                console.warn('[ProcessV4] Upload request aborted', { fileName: file.name, uploadStarted });
                rejectOnce(new Error(uploadStarted ? 'Upload was cancelled.' : 'Upload did not start. Please retry the upload.'));
            });

            startupTimeout = setTimeout(() => {
                if (!uploadStarted) {
                    console.warn('[ProcessV4] Upload did not start within watchdog window', { fileName: file.name, packId });
                    xhr.abort();
                }
            }, 15000);

            console.log('[ProcessV4] Sending upload request', { fileName: file.name, packId });
            xhr.send(formData);
        });

        setWorkflowStage('extracting');
        return sourceId;
    };

    const fetchPackDetails = async (packId: string, timeoutMs = 30000) => {
        const response = await fetchWithSession(`${API_BASE_URL}/api/v2/packs/${packId}`, {}, timeoutMs);
        if (!response.ok) return null;
        const packDetails = await response.json() as PackDetails;

        if (packDetails.pack_name) {
            return packDetails;
        }

        try {
            const packsResponse = await fetchWithSession(`${API_BASE_URL}/api/v2/packs`, {}, timeoutMs);
            if (!packsResponse.ok) {
                return packDetails;
            }

            const packs = await packsResponse.json() as Array<{ pack_id?: string; pack_name?: string }>;
            const matchingPack = packs.find((pack) => pack.pack_id === packId);

            if (matchingPack?.pack_name) {
                return {
                    ...packDetails,
                    pack_name: matchingPack.pack_name,
                };
            }
        } catch (error) {
            console.warn('[ProcessV4] Failed to load pack name fallback:', error);
        }

        return packDetails;
    };

    const createPackOnServer = async (requestedPackName: string, timeoutMs = 20000) => {
        console.log('[ProcessV4] Creating pack', { requestedPackName });

        const response = await fetchWithSession(`${API_BASE_URL}/api/v2/packs`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ pack_name: requestedPackName }),
        }, timeoutMs);

        if (!response.ok) {
            const errorText = await response.text().catch(() => '');
            throw new Error(errorText || 'Failed to create pack.');
        }

        const packData = await response.json() as { pack_id: string; pack_name?: string };
        console.log('[ProcessV4] Pack created', { packId: packData.pack_id });
        return packData;
    };

    const createPackDraft = async () => {
        if (currentPackId || isCreatingPackDraft) return;

        const trimmedPackName = packName.trim() || 'My Context Pack';

        try {
            setIsCreatingPackDraft(true);
            const packData = await createPackOnServer(trimmedPackName);
            const newPackId = packData.pack_id as string;

            setCurrentPackId(newPackId);
            setPackName(trimmedPackName);
            setSavedPackName(trimmedPackName);
            router.replace(`/process-v4?pack=${newPackId}`);
        } catch (error) {
            console.error('[ProcessV4] Failed to create pack draft:', error);
            alert(`Could not create pack: ${getErrorMessage(error)}`);
        } finally {
            setIsCreatingPackDraft(false);
        }
    };

    const ensureActivePack = async (fallbackName: string) => {
        if (currentPackId && !isDemoPackId(currentPackId)) return currentPackId;

        const trimmedPackName = packName.trim() || fallbackName;
        const packData = await createPackOnServer(trimmedPackName);
        const newPackId = packData.pack_id as string;

        setCurrentPackId(newPackId);
        setPackName(trimmedPackName);
        setSavedPackName(trimmedPackName);
        router.replace(`/process-v4?pack=${newPackId}`);

        return newPackId;
    };

    const savePackName = async () => {
        if (!currentPackId || isSavingPackName) return;

        const trimmedPackName = packName.trim();
        if (!trimmedPackName || trimmedPackName === savedPackName) return;

        try {
            setIsSavingPackName(true);
            savePackNameTimeoutRef.current = setTimeout(() => {
                setIsSavingPackName(false);
            }, 15000);

            const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${currentPackId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pack_name: trimmedPackName }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || 'Failed to rename pack.');
            }

            const updatedPack = await response.json().catch(() => null) as PackDetails | null;
            const nextPackName = updatedPack?.pack_name?.trim() || trimmedPackName;

            setPackName(nextPackName);
            setSavedPackName(nextPackName);
        } catch (error) {
            console.error('[ProcessV4] Failed to rename pack:', error);
            alert(`Could not rename pack: ${getErrorMessage(error)}`);
        } finally {
            if (savePackNameTimeoutRef.current) {
                clearTimeout(savePackNameTimeoutRef.current);
                savePackNameTimeoutRef.current = null;
            }
            setIsSavingPackName(false);
        }
    };

    const startPolling = (packId: string, opId: number, knownSourceId?: string) => {
        console.log('[ProcessV4] Starting polling', { packId, opId, knownSourceId });
        clearPollingTimers();
        pollingActiveRef.current = true;
        pollRequestInFlightRef.current = false;

        let hasHitReadyForAnalysis = false;
        let resolvedSourceId = knownSourceId || null;
        let nextPollDelayMs = 2000;

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
            upsertPackSource(src);

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
            if (pollRequestInFlightRef.current) {
                pollingIntervalRef.current = setTimeout(poll, nextPollDelayMs);
                return;
            }

            pollRequestInFlightRef.current = true;
            try {
                const packData = await fetchPackDetails(packId, 60000);
                if (operationIdRef.current !== opId || !packData) return;

                const { relevantSource: src } = applyPackDetails(packData, resolvedSourceId);
                if (src) {
                    resolvedSourceId = src.source_id;
                    setCurrentSourceId(src.source_id);
                    await processSourceStatus(src);
                }
                nextPollDelayMs = 2000;
            } catch (err) {
                if (operationIdRef.current !== opId) return;
                console.error('[ProcessV4] Poll error:', err);
                nextPollDelayMs = Math.min(nextPollDelayMs * 2, 10000);
            } finally {
                pollRequestInFlightRef.current = false;
                if (pollingActiveRef.current && operationIdRef.current === opId) {
                    pollingIntervalRef.current = setTimeout(poll, nextPollDelayMs);
                }
            }
        };

        poll();

        heartbeatIntervalRef.current = setInterval(async () => {
            if (!pollingActiveRef.current || operationIdRef.current !== opId || pollRequestInFlightRef.current) return;
            try {
                const packData = await fetchPackDetails(packId);
                if (!packData) return;
                const { relevantSource: latestSource } = applyPackDetails(packData, resolvedSourceId);
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

    const handleUrlUpload = async () => {
        const trimmedUrl = urlInput.trim();
        if (!trimmedUrl || !user) return;

        let sourceName = 'ChatGPT Shared Link';
        try {
            const parsed = new URL(trimmedUrl);
            const identifier = parsed.pathname.split('/').filter(Boolean).pop();
            const host = parsed.hostname.replace(/^www\./, '');
            if (identifier) {
                sourceName = `ChatGPT Shared Link (${identifier.slice(0, 8)})`;
            } else if (host) {
                sourceName = `ChatGPT Shared Link (${host})`;
            }
        } catch {
            alert('Please enter a valid ChatGPT shared link URL.');
            return;
        }

        try {
            const packId = await ensureActivePack('My Context Pack');
            setShowUrlModal(false);
            setIsProcessing(true);
            setErrorMessage(null);
            setWorkflowStage('extracting');

            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/packs/${packId}/sources`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        url: trimmedUrl,
                        source_name: sourceName,
                        source_type: 'url',
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`Failed to upload URL (${response.status}). ${errorText || 'Please check the link format or try again.'}`);
            }

            const payload = await response.json() as { source_id?: string };
            if (payload.source_id) {
                setCurrentSourceId(payload.source_id);
            }

            setUrlInput('');
            startPolling(packId, ++operationIdRef.current, payload.source_id);
        } catch (error) {
            console.error('[ProcessV4] URL upload error:', error);
            handleError(getErrorMessage(error));
        }
    };

    const handleTextUpload = async () => {
        const trimmedText = textInput.trim();
        if (!trimmedText || !user) return;

        try {
            const packId = await ensureActivePack('My Context Pack');
            setShowTextModal(false);
            setIsProcessing(true);
            setErrorMessage(null);
            setWorkflowStage('extracting');

            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/packs/${packId}/sources`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        text_content: trimmedText,
                        source_name: `Pasted Text (${new Date().toLocaleTimeString()})`,
                    }),
                }
            );

            if (!response.ok) {
                const errorText = await response.text().catch(() => '');
                throw new Error(`Failed to upload text (${response.status}). ${errorText || 'Please try again.'}`);
            }

            const payload = await response.json() as { source_id?: string };
            if (payload.source_id) {
                setCurrentSourceId(payload.source_id);
            }

            setTextInput('');
            startPolling(packId, ++operationIdRef.current, payload.source_id);
        } catch (error) {
            console.error('[ProcessV4] Text upload error:', error);
            handleError(getErrorMessage(error));
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
    const needsCreditPurchase = !!(creditInfo?.needsPurchase && workflowStage !== 'analyzing' && workflowStage !== 'completed');
    const isReadyForAnalysis = backendStatus?.status === 'ready_for_analysis' && workflowStage !== 'analyzing' && workflowStage !== 'completed';
    const packNameInputValue = packName || '';
    const packNameDisplay = savedPackName || packNameInputValue || 'Untitled Pack';
    const canSavePackName = !!currentPackId && !!packName.trim() && packName.trim() !== savedPackName;
    const canCreatePackDraft = !currentPackId && !!packName.trim();
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
                title: 'Reading and indexing your content.',
                description: "This takes a few minutes. You'll get an email when it's done — safe to close this tab.",
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
            description: 'Upload a document or export and we will extract, chunk, and prepare it for analysis.',
        };
    })();
    const analysisProgress = workflowStage === 'analyzing' && backendStatus?.total_chunks
        ? Math.round(((backendStatus.processed_chunks ?? 0) / backendStatus.total_chunks) * 100)
        : null;
    const visibleProgress = workflowStage === 'uploading'
        ? uploadPercent
        : workflowStage === 'extracting'
            ? extractionProgress
            : workflowStage === 'analyzing'
                ? analysisProgress
                : null;
    const progressMeta = (() => {
        if (workflowStage === 'uploading') {
            return uploadPercent > 0 ? `${uploadPercent}% uploaded` : 'Stalled... Reload';
        }

        if (workflowStage === 'analyzing') {
            const processed = backendStatus?.processed_chunks;
            const total = backendStatus?.total_chunks;
            if (processed !== undefined && total) {
                return `${processed} of ${total} chunks analyzed`;
            }
            return null;
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
    const getSourceLabel = (source: SourceStatus) => {
        return source.source_name || source.file_name || `Source ${source.source_id.slice(0, 6)}`;
    };
    const downloadFile = async (endpoint: string, filename: string, notFoundMessage?: string) => {
        console.log('[ProcessV4] Download requested', { endpoint, filename });
        const response = await makeAuthenticatedRequest(endpoint);
        if (response.ok) {
            const blob = await response.blob();
            const url = window.URL.createObjectURL(blob);
            const anchor = document.createElement('a');
            anchor.href = url;
            anchor.download = filename;
            document.body.appendChild(anchor);
            anchor.click();
            document.body.removeChild(anchor);
            window.URL.revokeObjectURL(url);
            return;
        }

        if (response.status === 404 && notFoundMessage) {
            alert(notFoundMessage);
            return;
        }

        const errorText = await response.text().catch(() => '');
        console.error('[ProcessV4] Download failed', {
            endpoint,
            status: response.status,
            errorText,
        });
        alert(`Download failed (${response.status}). ${errorText || 'Please try again.'}`);
    };

    const triggerSourcePicker = () => {
        if (!user) return;
        if (filePickerRef.current) {
            filePickerRef.current.value = '';
        }
        analytics.filePickerOpened();
        console.log('[ProcessV4] Opening file picker');
        filePickerRef.current?.click();
    };

    const sourceTiles: SourceTile[] = [
        {
            key: 'chat-export',
            title: 'GPT/Claude Chat Export',
            description: 'Upload conversations.json or ZIP',
            icon: MessageSquare,
            action: triggerSourcePicker,
            help: true,
        },
        {
            key: 'documents',
            title: 'Documents',
            description: 'PDF, TXT, DOCX, CSV',
            icon: FileText,
            action: triggerSourcePicker,
        },
        {
            key: 'paste-url',
            title: 'Paste URL',
            description: 'ChatGPT shared links',
            icon: Link2,
            action: () => setShowUrlModal(true),
        },
        {
            key: 'paste-text',
            title: 'Paste Text',
            description: 'Direct text input',
            icon: AlignLeft,
            action: () => setShowTextModal(true),
        },
    ];

    return (
        <div className="min-h-screen bg-[#121213] text-white">
            <style jsx>{`
                @keyframes indeterminate-sweep {
                    0% { transform: translateX(-40%); }
                    100% { transform: translateX(120%); }
                }
            `}</style>
            {showEmailSentToast && (
                <div className="fixed right-6 top-6 z-50 max-w-sm rounded-xl border border-emerald-400/20 bg-[#181818] px-4 py-3 shadow-[0_16px_48px_rgba(0,0,0,0.35)]">
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

            <div className="relative flex min-h-screen w-full flex-col">
                <input
                    ref={filePickerRef}
                    type="file"
                    accept=".pdf,.txt,.doc,.docx,.csv,.json,.zip"
                    onChange={(e) => {
                        handleFilesDropped(e.target.files);
                        e.currentTarget.value = '';
                    }}
                    className="hidden"
                    disabled={!user}
                />
                <div className="grid min-h-screen grid-cols-1 xl:grid-cols-[336px_minmax(0,1fr)_336px]">
                    <aside className="border-b border-r border-[#2a2a2c] bg-[#1a1a1b] xl:border-b-0">
                        <div className="border-b border-[#2a2a2c] px-5 py-5">
                            <div className="flex items-center justify-between gap-3">
                                <div className="flex items-center gap-2 text-[#d7d7da]">
                                    <FolderOpen className="h-4 w-4" />
                                    <p className="text-[15px] font-medium text-white">{packNameDisplay}</p>
                                </div>
                                <span className="rounded-md bg-[#2563eb] px-3 py-1.5 text-xs font-semibold text-white">
                                    V3 TEST
                                </span>
                            </div>
                        </div>

                        <div className="px-3 py-4">
                            <div className="flex items-center justify-between gap-3">
                                <p className="text-xs font-semibold uppercase tracking-[0.04em] text-[#8f8f94]">Sources ({packSources.length})</p>
                                <span className="rounded-full border border-[#333336] bg-[#232325] px-2.5 py-1 text-[11px] text-[#aab6b1]">
                                    {packSources.length}
                                </span>
                            </div>

                            <div className="mt-4 space-y-3">
                                {packSources.length === 0 ? (
                                    <div className="rounded-xl border border-dashed border-[#353538] bg-[#232325] px-4 py-5 text-sm text-[#7f7f85]">
                                        No sources yet
                                    </div>
                                ) : (
                                    packSources.map((source) => {
                                        const isActiveSource = source.source_id === currentSourceId;
                                        const sourceStatus = source.status.replace(/_/g, ' ');

                                        return (
                                            <div
                                                key={source.source_id}
                                                className={`rounded-xl border px-4 py-4 transition-colors ${
                                                    isActiveSource
                                                        ? 'border-[#4a4a51] bg-[#313133]'
                                                        : 'border-[#353538] bg-[#313133]'
                                                }`}
                                            >
                                                <div className="flex items-start gap-3">
                                                    <div className="mt-0.5 rounded-lg border border-[#404044] bg-[#252527] p-2">
                                                        <FileText className="h-4 w-4 text-[#bdbdc3]" />
                                                    </div>
                                                    <div className="min-w-0 flex-1">
                                                        <p className="truncate text-sm font-medium text-white">
                                                            {getSourceLabel(source)}
                                                        </p>
                                                        <div className="mt-2 flex items-center justify-between gap-3">
                                                            <p className="text-xs text-[#9d9da3]">
                                                                {sourceStatus === 'completed' ? 'Completed' : sourceStatus}
                                                            </p>
                                                            {typeof source.total_chunks === 'number' && source.total_chunks > 0 && (
                                                                <span className="text-xs text-[#aab6b1]">{source.total_chunks} chunks</span>
                                                            )}
                                                        </div>
                                                    </div>
                                                </div>
                                            </div>
                                        );
                                    })
                                )}
                            </div>
                        </div>
                    </aside>

                    <section className="bg-[#101011]">
                        <div className="mx-auto max-w-[980px] px-8 py-10">
                            <div className="mb-7">
                                <h1 className="text-[28px] font-semibold tracking-[-0.03em] text-white">
                                    {currentPackId ? packNameDisplay : 'Create Pack'}
                                </h1>
                                <p className="mt-1 text-[15px] text-[#8b8b93]">
                                    Upload your content to create a portable context pack
                                </p>
                            </div>
                            <div className="mb-6 flex flex-col gap-4 lg:flex-row lg:items-end">
                                <div className="flex-1">
                                    <label
                                        htmlFor="pack-name"
                                        className="mb-2 block text-[11px] uppercase tracking-[0.18em] text-[#7f7f85]"
                                    >
                                        Pack name
                                    </label>
                                    <input
                                        id="pack-name"
                                        type="text"
                                        value={packNameInputValue}
                                        onChange={(e) => setPackName(e.target.value)}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter' && canSavePackName) {
                                                e.preventDefault();
                                                void savePackName();
                                            }
                                        }}
                                        placeholder="Untitled Pack"
                                        maxLength={120}
                                        className="w-full rounded-xl border border-[#303033] bg-[#18181a] px-4 py-3 text-sm text-white outline-none transition-colors placeholder:text-[#6f6f76] focus:border-[#45454a]"
                                    />
                                </div>
                                {currentPackId ? (
                                    <button
                                        onClick={() => void savePackName()}
                                        disabled={!canSavePackName || isSavingPackName}
                                        className="rounded-xl border border-[#303033] bg-[#2f2f31] px-5 py-3 text-sm text-white transition-colors hover:bg-[#3a3a3d] disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        {isSavingPackName ? 'Saving…' : 'Save'}
                                    </button>
                                ) : (
                                    <button
                                        onClick={() => void createPackDraft()}
                                        disabled={!canCreatePackDraft || isCreatingPackDraft}
                                        className="rounded-xl border border-[#303033] bg-[#2f2f31] px-5 py-3 text-sm text-white transition-colors hover:bg-[#3a3a3d] disabled:cursor-not-allowed disabled:opacity-45"
                                    >
                                        {isCreatingPackDraft ? 'Saving…' : 'Save name'}
                                    </button>
                                )}
                            </div>
                            {workflowStage === 'completed' && (
                                <div className="mb-6 flex items-center justify-between rounded-xl border border-[#303033] bg-[#1a1a1b] px-5 py-4">
                                    <div className="flex items-center gap-3">
                                        <Check className="h-5 w-5 text-emerald-400" />
                                        <p className="text-base font-medium text-white">Analysis complete</p>
                                    </div>
                                    <button
                                        onClick={() => setShowEmailSentToast(false)}
                                        className="text-[#6e6e75] transition-colors hover:text-white"
                                        aria-label="Dismiss"
                                    >
                                        <X className="h-4 w-4" />
                                    </button>
                                </div>
                            )}

                            {workflowStage === 'error' ? (
                                <div className="rounded-2xl border border-red-400/16 bg-[linear-gradient(180deg,rgba(127,29,29,0.18),rgba(12,18,16,0.9))] p-8">
                                    <div className="flex flex-col gap-8 lg:flex-row lg:items-start lg:justify-between">
                                        <div className="max-w-xl">
                                            <div className="mb-5 flex h-12 w-12 items-center justify-center rounded-2xl border border-red-400/16 bg-red-400/10">
                                                <AlertCircle className="h-5 w-5 text-red-300" />
                                            </div>
                                            <p className="text-[11px] uppercase tracking-[0.24em] text-red-200/80">Error</p>
                                            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                                {workflowSummary.title}
                                            </h2>
                                        </div>

                                        <button
                                            onClick={cancelWorkflow}
                                            className="inline-flex items-center gap-2 self-start rounded-full border border-white/14 bg-white/[0.05] px-5 py-2.5 text-sm text-white transition-colors hover:bg-white/[0.1]"
                                        >
                                            <RefreshCw className="h-3.5 w-3.5" />
                                            Reset
                                        </button>
                                    </div>
                                </div>
                            ) : needsCreditPurchase ? (
                                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101618]">
                                    <div className="grid gap-0 lg:grid-cols-[1fr_320px]">
                                        <div className="border-b border-white/8 p-8 lg:border-b-0 lg:border-r">
                                            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8f9894]">Ready for analysis</p>
                                            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                                Credits are needed to continue.
                                            </h2>
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
                                                    className="rounded-full border border-white/12 px-5 py-2.5 text-sm text-white transition-colors hover:bg-white/[0.06]"
                                                >
                                                    Add credits
                                                </a>
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
                                                    <span className="text-white">{creditsNeeded}</span>
                                                </p>
                                                {stageEstimate && (
                                                    <p className="mt-2 text-sm text-[#9da8a1]">
                                                        {stageEstimate}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : isReadyForAnalysis ? (
                                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[#101618]">
                                    <div className="grid gap-0 lg:grid-cols-[1fr_280px]">
                                        <div className="border-b border-white/8 p-8 lg:border-b-0 lg:border-r">
                                            <p className="text-[11px] uppercase tracking-[0.24em] text-[#8f9894]">Ready for analysis</p>
                                            <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                                {workflowSummary.title}
                                            </h2>
                                            <div className="mt-8 flex flex-wrap gap-3">
                                                <button
                                                    onClick={triggerManualAnalysis}
                                                    disabled={isStartingAnalysis}
                                                    className="rounded-full bg-white px-5 py-2.5 text-sm font-medium text-black transition-colors hover:bg-[#ebefed]"
                                                >
                                                    {isStartingAnalysis ? 'Starting…' : 'Analyze'}
                                                </button>
                                            </div>
                                        </div>

                                        <div className="grid gap-px bg-white/8 p-px">
                                            <div className="bg-[#111916] p-6">
                                                <p className="text-[11px] uppercase tracking-[0.24em] text-[#7f8d87]">Chunks</p>
                                                <p className="mt-3 text-3xl font-semibold text-white">{chunkCount || 'Pending'}</p>
                                            </div>
                                            <div className="bg-[#111916] p-6">
                                                <p className="text-[11px] uppercase tracking-[0.24em] text-[#7f8d87]">ETA</p>
                                                {stageEstimate && (
                                                    <p className="mt-3 text-sm text-[#c9d1cd]">
                                                        {stageEstimate}
                                                    </p>
                                                )}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ) : isProcessing && workflowStage !== 'completed' ? (
                                <div className="overflow-hidden rounded-2xl border border-white/10 bg-[linear-gradient(180deg,rgba(16,27,23,0.94),rgba(10,18,15,0.98))] p-8">
                                    <p className="text-[11px] uppercase tracking-[0.24em] text-[#8ea096]">
                                        {workflowSummary.label}
                                    </p>
                                    <h2 className="mt-3 text-2xl font-semibold tracking-[-0.03em] text-white">
                                        {workflowSummary.title}
                                    </h2>
                                    {workflowStage === 'analyzing' && (
                                        <p className="mt-2 text-sm text-[#8ea096]">{workflowSummary.description}</p>
                                    )}
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
                                                            ? progressMeta ?? 'Analysis running'
                                                            : 'Extraction and chunking in progress'}
                                                </span>
                                                {workflowStage !== 'analyzing' && progressMeta && (
                                                    <span className="text-xs text-[#91a39b]">
                                                        {progressMeta}
                                                    </span>
                                                )}
                                            </div>
                                            {stageEstimate && <span>{stageEstimate}</span>}
                                        </div>
                                    </div>
                                </div>
                            ) : null}

                            {workflowStage === 'analyzing' && (
                                <div className="mt-4 grid grid-cols-1 gap-3 sm:grid-cols-3">
                                    {[
                                        { heading: 'Works while you wait', body: 'Analysis runs server-side. You can close this tab and come back — we\'ll email you when it\'s done.' },
                                        { heading: 'Export anywhere', body: 'Once ready, copy your pack into ChatGPT, Claude, or Gemini to give any AI instant context about your work.' },
                                        { heading: 'Add more sources', body: 'You can create another pack or add more sources while this one is processing.' },
                                    ].map(({ heading, body }) => (
                                        <div key={heading} className="rounded-xl border border-white/8 bg-[#0d1614] p-5">
                                            <p className="text-xs font-semibold text-[#6fcf97]">{heading}</p>
                                            <p className="mt-1.5 text-sm text-[#7a8f87]">{body}</p>
                                        </div>
                                    ))}
                                </div>
                            )}

                            {(!isProcessing || workflowStage === 'completed') && (
                                <div className={`mt-6 grid grid-cols-1 gap-5 md:grid-cols-2 ${!user ? 'opacity-60' : ''}`}>
                                    {sourceTiles.map((tile) => {
                                        const Icon = tile.icon;
                                        const tileDisabled = !user || (isProcessing && workflowStage !== 'completed');
                                        const content = (
                                            <>
                                                <div className="mb-6 flex h-[66px] w-[66px] items-center justify-center rounded-full bg-[#2f2f31]">
                                                    <Icon className="h-8 w-8 text-[#d8d8dc]" />
                                                </div>
                                                <h3 className="text-[22px] font-semibold tracking-[-0.03em] text-white">
                                                    {tile.title}
                                                </h3>
                                                <p className="mt-2 text-sm font-medium text-[#707078]">
                                                    {tile.description}
                                                </p>
                                                {tile.help && tile.key === 'chat-export' && (
                                                    <div className="mt-4">
                                                        <a
                                                            href="https://chatgpt.com/#settings/DataControls"
                                                            target="_blank"
                                                            rel="noreferrer"
                                                            className="inline-flex items-center gap-2 rounded-full border border-[#3a3a3f] bg-[#202023] px-3 py-2 text-xs font-semibold text-white transition-colors hover:border-[#5b5b62] hover:bg-[#26262b]"
                                                            onClick={(e) => e.stopPropagation()}
                                                        >
                                                            <HelpCircle className="h-4 w-4 text-[#cfd1d6]" />
                                                            <span>Where to find chat export</span>
                                                        </a>
                                                    </div>
                                                )}
                                            </>
                                        );

                                        const sharedClassName = `relative flex h-[220px] flex-col items-center justify-center rounded-2xl border border-[#303033] bg-[#1a1a1b] px-8 text-center transition-colors ${
                                            !tileDisabled ? 'hover:border-[#4a4a50] hover:bg-[#202022]' : 'cursor-not-allowed opacity-60'
                                        }`;

                                        return (
                                            <button
                                                key={tile.key}
                                                onClick={() => {
                                                    analytics.sourceTileClicked(tile.key);
                                                    tile.action();
                                                }}
                                                onMouseEnter={() => {
                                                    if (!hoveredTilesRef.current.has(tile.key)) {
                                                        hoveredTilesRef.current.add(tile.key);
                                                        analytics.sourceTileHovered(tile.key);
                                                    }
                                                }}
                                                disabled={tileDisabled}
                                                className={sharedClassName}
                                            >
                                                {content}
                                            </button>
                                        );
                                    })}
                                </div>
                            )}
                            {!user && (
                                <div className="mt-5 inline-flex items-center gap-2 rounded-full border border-red-400/20 bg-red-400/8 px-4 py-2 text-xs text-red-300">
                                    <AlertCircle className="h-3.5 w-3.5" />
                                    Sign in to add sources
                                </div>
                            )}
                        </div>
                    </section>

                    <aside className="border-l border-[#2a2a2c] bg-[#1a1a1b] p-5">
                        <div className="mb-5 border-b border-[#2a2a2c] pb-4">
                            <p className="text-[15px] font-semibold text-white">Pack Actions</p>
                        </div>
                        {currentPackId && (
                            <div className="grid gap-3">
                                <button
                                    onClick={async () => {
                                        if (!currentPackId) return;
                                        try {
                                            await downloadFile(
                                                `${API_BASE_URL}/api/v2/packs/${currentPackId}/download`,
                                                'context_pack.txt'
                                            );
                                        } catch (e) { console.error(e); }
                                    }}
                                    className="flex items-center justify-center gap-2 rounded-xl border border-[#353538] bg-[#343436] px-4 py-4 text-sm font-medium text-white transition-colors hover:bg-[#3b3b3e]"
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
                                    className="flex items-center justify-center gap-2 rounded-xl border border-[#353538] bg-[#343436] px-4 py-4 text-sm font-medium text-white transition-colors hover:bg-[#3b3b3e]"
                                >
                                    <Download className="h-4 w-4" />
                                    Download Tree JSON
                                </button>
                                <button
                                    onClick={() => currentPackId && router.push(`/tree/${currentPackId}`)}
                                    className="flex items-center justify-center gap-2 rounded-xl bg-white px-4 py-4 text-sm font-medium text-[#171717] transition-colors hover:bg-[#ededed]"
                                >
                                    <GitBranch className="h-4 w-4" />
                                    View Memory Tree
                                </button>
                            </div>
                        )}
                    </aside>
                </div>
            </div>

            {showUrlModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="w-full max-w-2xl rounded-2xl border border-[#303033] bg-[#18181a] p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-xl font-semibold text-white">Paste URL</h3>
                            <button
                                onClick={() => setShowUrlModal(false)}
                                className="text-[#7d7d84] transition-colors hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="mb-4 text-sm text-[#8f8f96]">
                            Paste a ChatGPT shared link and we&apos;ll add it to this pack.
                        </p>

                        <input
                            type="url"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="https://chatgpt.com/share/..."
                            className="mb-4 w-full rounded-xl border border-[#303033] bg-[#101011] px-4 py-3 text-white outline-none transition-colors placeholder:text-[#686870] focus:border-[#45454a]"
                        />

                        <button
                            onClick={() => void handleUrlUpload()}
                            disabled={!urlInput.trim()}
                            className="w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-[#ededed] disabled:cursor-not-allowed disabled:bg-[#303033] disabled:text-[#818188]"
                        >
                            Add URL Source
                        </button>
                    </div>
                </div>
            )}

            {showTextModal && (
                <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/80 p-4">
                    <div className="w-full max-w-3xl rounded-2xl border border-[#303033] bg-[#18181a] p-8">
                        <div className="mb-6 flex items-center justify-between">
                            <h3 className="text-xl font-semibold text-white">Paste Text</h3>
                            <button
                                onClick={() => setShowTextModal(false)}
                                className="text-[#7d7d84] transition-colors hover:text-white"
                            >
                                <X className="h-5 w-5" />
                            </button>
                        </div>

                        <p className="mb-4 text-sm text-[#8f8f96]">
                            Paste direct text input to create a source.
                        </p>

                        <textarea
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="Paste your text here..."
                            rows={10}
                            className="mb-4 w-full resize-none rounded-xl border border-[#303033] bg-[#101011] px-4 py-3 text-white outline-none transition-colors placeholder:text-[#686870] focus:border-[#45454a]"
                        />

                        <button
                            onClick={() => void handleTextUpload()}
                            disabled={!textInput.trim()}
                            className="w-full rounded-xl bg-white px-4 py-3 text-sm font-medium text-black transition-colors hover:bg-[#ededed] disabled:cursor-not-allowed disabled:bg-[#303033] disabled:text-[#818188]"
                        >
                            Add Text Source
                        </button>
                    </div>
                </div>
            )}
        </div>
    );
}
