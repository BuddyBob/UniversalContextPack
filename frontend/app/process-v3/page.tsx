'use client';

/**
 * Process V3 - Modern pack creation and source processing
 * Features enhanced UI with real-time progress tracking
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader, X, FolderOpen, FileText, Download, MessageSquare, Link as LinkIcon, FileText as FileTextIcon, AlignLeft, HelpCircle } from 'lucide-react';

import { supabase } from '@/lib/supabase';
import { useAuth } from '@/components/AuthProvider';
import { usePackManagement } from '@/hooks/usePackManagement';
import { useSourceProcessing } from '@/hooks/useSourceProcessing';
import { usePolling } from '@/hooks/usePolling';
import { API_BASE_URL } from '@/lib/api';
import { ProcessProgress } from '@/components/ProcessProgress';
import { ProcessStatus, mapBackendStatus } from '@/types/ProcessState';

// File upload progress tracking
interface FileUploadProgress {
    fileName: string;
    fileSize: number;
    uploadedBytes: number;
    uploadPercent: number;
    phase: 'uploading' | 'extracting' | 'complete' | 'error';
    extractionProgress?: number; // Progress percentage during extraction (0-100)
    errorMessage?: string;
}

// Helper to format file size
const formatFileSize = (bytes: number): string => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
};

export default function ProcessV3Page() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, makeAuthenticatedRequest, refreshUserProfile } = useAuth();

    const {
        selectedPack,
        packSources,
        selectPack,
        setPackSources,
    } = usePackManagement();

    const {
        creditInfo,
        fetchCreditInfo,
        startAnalysis,
        updateFromSourceStatus,
    } = useSourceProcessing();

    const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
    const [fileUploadProgress, setFileUploadProgress] = useState<Map<string, FileUploadProgress>>(new Map());
    const [isDownloadingPack, setIsDownloadingPack] = useState(false);
    const [isDownloadingTree, setIsDownloadingTree] = useState(false);

    const [showUrlModal, setShowUrlModal] = useState(false);
    const [showTextModal, setShowTextModal] = useState(false);
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');

    // Handle URL upload
    const handleUrlUpload = async () => {
        if (!urlInput.trim() || !selectedPack) return;

        try {
            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ url: urlInput }),
                }
            );

            if (response.ok) {
                console.log('✅ URL uploaded');
                setUrlInput('');
                await pollPackDetails();
            } else {
                alert('Failed to upload URL');
            }
        } catch (error) {
            console.error('❌ URL upload error:', error);
            alert('Error uploading URL');
        }
    };

    // Handle text upload
    const handleTextUpload = async () => {
        if (!textInput.trim() || !selectedPack) return;

        try {
            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({ text: textInput }),
                }
            );

            if (response.ok) {
                console.log('✅ Text uploaded');
                setTextInput('');
                await pollPackDetails();
            } else {
                alert('Failed to upload text');
            }
        } catch (error) {
            console.error('❌ Text upload error:', error);
            alert('Error uploading text');
        }
    };

    // Handle conversation upload with validation
    const handleConversationUpload = (files: FileList | null) => {
        if (!files) return;

        const fileArray = Array.from(files);
        const invalidFiles = fileArray.filter(f =>
            f.name.toLowerCase().endsWith('.json') &&
            f.name.toLowerCase() !== 'conversations.json'
        );

        if (invalidFiles.length > 0) {
            alert("Please upload the specific file named 'conversations.json' from your ChatGPT export.");
            return;
        }

        handleFileUpload(files);
    };

    // File upload handler with progress tracking
    const handleFileUpload = async (files: FileList | null) => {
        if (!files || !selectedPack) return;

        const fileArray = Array.from(files);
        console.log('[ProcessV3] Starting upload of', fileArray.length, 'file(s)');

        for (const file of fileArray) {
            console.log('[ProcessV3] Uploading file:', file.name, 'size:', file.size, 'type:', file.type);
            setUploadingFiles(prev => new Set(prev).add(file.name));

            // Initialize progress tracking
            setFileUploadProgress(prev => {
                const next = new Map(prev);
                next.set(file.name, {
                    fileName: file.name,
                    fileSize: file.size,
                    uploadedBytes: 0,
                    uploadPercent: 0,
                    phase: 'uploading'
                });
                return next;
            });

            try {
                // Get auth token
                const { data: { session } } = await supabase.auth.getSession();
                if (!session) {
                    throw new Error('No active session');
                }

                const formData = new FormData();
                formData.append('file', file);

                const uploadUrl = `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`;
                console.log('[ProcessV3] Upload URL:', uploadUrl);

                // Use XMLHttpRequest for progress tracking
                await new Promise<void>((resolve, reject) => {
                    const xhr = new XMLHttpRequest();

                    // Track upload progress
                    xhr.upload.addEventListener('progress', (e) => {
                        if (e.lengthComputable) {
                            const percentComplete = Math.round((e.loaded / e.total) * 100);
                            setFileUploadProgress(prev => {
                                const next = new Map(prev);
                                const current = next.get(file.name);
                                if (current) {
                                    next.set(file.name, {
                                        ...current,
                                        uploadedBytes: e.loaded,
                                        uploadPercent: percentComplete,
                                        phase: 'uploading'
                                    });
                                }
                                return next;
                            });
                        }
                    });

                    xhr.addEventListener('load', () => {
                        if (xhr.status >= 200 && xhr.status < 300) {
                            console.log(`✅ Uploaded: ${file.name}`);

                            // Update to extraction phase
                            setFileUploadProgress(prev => {
                                const next = new Map(prev);
                                const current = next.get(file.name);
                                if (current) {
                                    next.set(file.name, {
                                        ...current,
                                        uploadPercent: 100,
                                        phase: 'extracting'
                                    });
                                }
                                return next;
                            });

                            resolve();
                        } else {
                            reject(new Error(`Upload failed with status ${xhr.status}`));
                        }
                    });

                    xhr.addEventListener('error', () => {
                        setFileUploadProgress(prev => {
                            const next = new Map(prev);
                            const current = next.get(file.name);
                            if (current) {
                                next.set(file.name, {
                                    ...current,
                                    phase: 'error',
                                    errorMessage: 'Upload failed'
                                });
                            }
                            return next;
                        });
                        reject(new Error('Upload failed'));
                    });

                    xhr.addEventListener('abort', () => {
                        reject(new Error('Upload cancelled'));
                    });

                    xhr.open('POST', uploadUrl);
                    xhr.setRequestHeader('Authorization', `Bearer ${session.access_token}`);
                    xhr.send(formData);
                });

                // Wait a moment for backend to save
                await new Promise(resolve => setTimeout(resolve, 500));

                // Immediately refetch pack to get the new source
                await pollPackDetails();
                console.log('[ProcessV3] ✅ Pack details refreshed after upload');

                // Extraction progress will be tracked by polling

            } catch (error) {
                console.error('[ProcessV3] Upload error:', error);

                setFileUploadProgress(prev => {
                    const next = new Map(prev);
                    const current = next.get(file.name);
                    if (current) {
                        next.set(file.name, {
                            ...current,
                            phase: 'error',
                            errorMessage: error instanceof Error ? error.message : String(error)
                        });
                    }
                    return next;
                });

                alert(`Upload error: ${file.name}\n${error instanceof Error ? error.message : String(error)}`);
            } finally {
                setUploadingFiles(prev => {
                    const next = new Set(prev);
                    next.delete(file.name);
                    return next;
                });

                // Clean up progress after a delay if error
                setTimeout(() => {
                    setFileUploadProgress(prev => {
                        const next = new Map(prev);
                        const current = next.get(file.name);
                        if (current?.phase === 'error' || current?.phase === 'complete') {
                            next.delete(file.name);
                        }
                        return next;
                    });
                }, 3000);
            }
        }
    };



    // Fetch pack directly by ID from URL
    useEffect(() => {
        const packId = searchParams.get('pack');
        if (!packId || !user) return;

        // If we already have this pack selected, skip
        if (selectedPack?.pack_id === packId) return;

        // Fetch the pack directly by ID
        console.log('[ProcessV3] Fetching pack by ID:', packId);
        (async () => {
            try {
                const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${packId}`);
                if (response.ok) {
                    const data = await response.json();
                    const pack = {
                        pack_id: data.pack_id || packId,
                        pack_name: data.pack_name || data.name || 'Pack',
                        description: data.description,
                        custom_system_prompt: data.custom_system_prompt,
                        total_sources: data.total_sources || 0,
                        total_tokens: data.total_tokens || 0,
                        created_at: data.created_at,
                        updated_at: data.updated_at,
                    } as any;
                    await selectPack(pack);

                    // Load sources immediately from initial response
                    const sources = data.sources || [];
                    setPackSources(sources);
                    console.log('[ProcessV3] Loaded', sources.length, 'sources');
                }
            } catch (error) {
                console.error('[ProcessV3] Error fetching pack:', error);
            }
        })();
    }, [searchParams, selectedPack, user, makeAuthenticatedRequest, selectPack, setPackSources]);

    // Polling logic - uses robust usePolling hook
    // Keep polling if any source is in a non-terminal state OR if files are extracting
    const hasExtractingFiles = Array.from(fileUploadProgress.values()).some(
        progress => progress.phase === 'extracting'
    );
    const shouldPoll = !!selectedPack && (
        hasExtractingFiles ||
        packSources.some(s => {
            const terminalStates = ['completed', 'failed', 'cancelled'];
            return !terminalStates.includes(s.status);
        })
    );

    const pollPackDetails = useCallback(async () => {
        if (!selectedPack) return;

        try {
            // Use fast endpoint like test suite - fetch pack details
            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}?t=${Date.now()}`
            );

            if (!response.ok) {
                console.error('[ProcessV3] Poll failed:', response.status);
                return;
            }

            const data = await response.json();
            const sources = data.sources || [];

            // Update sources state
            setPackSources(sources);

            // Update process states for each source
            sources.forEach((source: any) => {
                updateFromSourceStatus(source);
            });

            // Poll for extraction progress updates
            setFileUploadProgress(prev => {
                const next = new Map(prev);
                sources.forEach((source: any) => {
                    const fileName = source.file_name || source.source_name;
                    const existingProgress = next.get(fileName);

                    if (existingProgress && existingProgress.phase === 'extracting') {
                        if (source.status === 'ready_for_analysis' || source.status === 'completed') {
                            // Extraction complete - reload to refresh UI
                            window.location.reload();
                        } else if (source.status === 'failed') {
                            // Show error
                            next.set(fileName, {
                                ...existingProgress,
                                phase: 'error',
                                errorMessage: source.error_message || 'Extraction failed'
                            });
                        } else if (source.status === 'processing' || source.status === 'extracting') {
                            // Update progress
                            const extractionProgress = source.progress ? Math.round(source.progress) : undefined;
                            next.set(fileName, {
                                ...existingProgress,
                                extractionProgress
                            });
                        }
                    }
                });
                return next;
            });
        } catch (error) {
            console.error('[ProcessV3] Polling error:', error);
            // Don't throw - let polling continue on next interval
        }
    }, [selectedPack, makeAuthenticatedRequest, setPackSources, updateFromSourceStatus]);

    usePolling({
        enabled: shouldPoll,
        interval: 2000,
        onPoll: pollPackDetails,
    });

    // Auto-fetch credit info
    useEffect(() => {
        const readySource = packSources.find(s => s.status === 'ready_for_analysis');
        if (readySource && !creditInfo) {
            fetchCreditInfo(readySource.source_id);
        }
    }, [packSources, creditInfo, fetchCreditInfo]);

    // NEW: Helper to convert packSources to ProcessStatus
    const getCurrentProcessStatus = useCallback((): ProcessStatus | null => {
        const activeSource = packSources.find(s =>
            ['extracting', 'ready_for_analysis', 'analyzing', 'processing', 'analyzing_chunks', 'building_tree', 'completed', 'failed', 'cancelled'].includes(s.status)
        );

        if (!activeSource) return null;

        const mappedState = mapBackendStatus(activeSource.status);
        const partialLimit = typeof window !== 'undefined'
            ? parseInt(localStorage.getItem(`processing_limit_${activeSource.source_id}`) || '0', 10)
            : 0;

        const totalChunks = activeSource.total_chunks || 0;
        const displayTotal = (partialLimit > 0 && partialLimit < totalChunks) ? partialLimit : totalChunks;

        const status: ProcessStatus = {
            state: mappedState,
            sourceId: activeSource.source_id,
            fileName: activeSource.file_name || 'Unknown file',
            currentChunk: activeSource.processed_chunks || 0,
            totalChunks: displayTotal,
            progress: typeof activeSource.progress === 'number'
                ? Math.round(activeSource.progress)
                : (displayTotal > 0 ? Math.round(((activeSource.processed_chunks || 0) / displayTotal) * 100) : 0),
        };

        if (mappedState === 'ready_for_analysis' && creditInfo) {
            status.creditsRequired = creditInfo.creditsRequired;
            status.userCredits = creditInfo.userCredits;
            status.canProceed = creditInfo.canProceed;
            status.hasUnlimited = creditInfo.hasUnlimited;
        }

        return status;
    }, [packSources, creditInfo]);

    // Handle cancel and delete (Stop & Reset)
    const handleCancelProcessing = async () => {
        if (!selectedPack) return;

        const processingSource = packSources.find(s =>
            ['extracting', 'ready_for_analysis', 'analyzing', 'processing', 'analyzing_chunks', 'building_tree'].includes(s.status)
        );

        if (processingSource) {
            setIsCancelling(true);

            try {
                // 1. Cancel active processing if needed
                if (['analyzing', 'processing', 'analyzing_chunks', 'building_tree'].includes(processingSource.status)) {
                    console.log('[ProcessV3] Cancelling processing for:', processingSource.source_id);
                    await makeAuthenticatedRequest(
                        `${API_BASE_URL}/api/v2/sources/${processingSource.source_id}/cancel`,
                        { method: 'POST' }
                    );
                    // Wait a moment for cancellation to register
                    await new Promise(resolve => setTimeout(resolve, 1000));
                }

                // 2. Optimistically remove from UI for immediate feedback
                setPackSources(prev => prev.filter(s => s.source_id !== processingSource.source_id));
                setUploadingFiles(prev => {
                    const next = new Set(prev);
                    next.delete(processingSource.file_name || '');
                    return next;
                });

                // 3. Delete the source from backend
                console.log('[ProcessV3] Deleting source:', processingSource.source_id);
                const deleteResponse = await makeAuthenticatedRequest(
                    `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources/${processingSource.source_id}`,
                    { method: 'DELETE' }
                );

                if (deleteResponse.ok) {
                    console.log('✅ Source deleted successfully');
                    // Force reload to ensure completely clean state
                    window.location.reload();
                } else {
                    console.error('❌ Failed to delete source');
                    // Reload anyway to resync with server state
                    window.location.reload();
                }

            } catch (error) {
                console.error('[ProcessV3] Cancel/Delete error:', error);
                // Reload to resync with server
                window.location.reload();
            }
        }
    };

    // Handle pack download
    const handleDownloadPack = async () => {
        if (!selectedPack || isDownloadingPack) return;

        setIsDownloadingPack(true);
        try {
            console.log('[Download] Requesting pack download:', selectedPack.pack_id);
            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/export/complete`
            );

            console.log('[Download] Response status:', response.status, response.ok);

            if (response.ok) {
                const blob = await response.blob();
                console.log('[Download] Blob size:', blob.size);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                // Ensure .txt extension is properly added
                const packName = selectedPack.pack_name.replace(/[^a-zA-Z0-9_-]/g, '_');
                a.download = `${packName}_pack.txt`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                console.log('[Download] Pack download initiated successfully');
            } else {
                const errorText = await response.text();
                console.error('[Download] Pack download failed:', response.status, errorText);
                alert(`Download failed: ${response.status}`);
            }
        } catch (error) {
            console.error('[Download] Pack download error:', error);
            alert('Download error. Please try again.');
        } finally {
            setIsDownloadingPack(false);
        }
    };

    // Handle tree download
    const handleDownloadTree = async () => {
        if (!selectedPack || isDownloadingTree) return;

        setIsDownloadingTree(true);
        try {
            console.log('[Download] Requesting tree JSON:', selectedPack.pack_id);
            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/tree.json`
            );

            console.log('[Download] Tree response:', response.status, response.ok);

            if (response.ok) {
                const blob = await response.blob();
                console.log('[Download] Tree blob size:', blob.size);
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selectedPack.pack_name}_tree.json`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
                console.log('[Download] Tree download initiated');
            } else {
                const errorText = await response.text();
                console.error('[Download] Tree download failed:', response.status, errorText);
                if (response.status === 404) {
                    alert('No memory tree found for this pack yet.');
                }
            }
        } catch (error) {
            console.error('[Download] Tree download error:', error);
        } finally {
            setIsDownloadingTree(false);
        }
    };

    if (!user) {
        return (
            <div className="min-h-screen bg-gray-950 flex items-center justify-center">
                <div className="text-center">
                    <h2 className="text-2xl font-bold text-white mb-4">Please sign in</h2>
                    <p className="text-gray-400">You need to be authenticated to access this page</p>
                </div>
            </div>
        );
    }

    if (!selectedPack) {
        return (
            <div className="min-h-screen bg-gray-950 text-white p-8">
                <div className="max-w-4xl mx-auto text-center flex flex-col items-center justify-center" style={{ minHeight: '60vh' }}>
                    <div className="animate-spin rounded-full h-16 w-16 border-b-2 border-blue-500 mb-4"></div>
                    <p className="text-gray-400">Pack is processing, check email for updates...</p>
                </div>
            </div>
        );
    }

    const processStatus = getCurrentProcessStatus();

    // Disable inputs when processing or ready for analysis
    const processingDisabled = !!(processStatus?.state && ['extracting', 'ready_for_analysis', 'analyzing', 'processing', 'analyzing_chunks', 'building_tree'].includes(processStatus.state));

    return (
        <div className="min-h-screen bg-gray-950 text-white flex">
            {/* LEFT SIDEBAR */}
            <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800">
                    <div className="flex items-center gap-2">
                        <FolderOpen className="w-5 h-5 text-gray-400" />
                        <h2 className="text-sm font-semibold text-white">{selectedPack.pack_name}</h2>
                        <span className="ml-auto text-xs px-2 py-1 bg-blue-600 rounded">V3 TEST</span>
                    </div>
                </div>

                <div className="flex-1 overflow-y-auto p-4">
                    <div className="text-xs font-semibold text-gray-400 uppercase mb-3">
                        Sources ({packSources.length})
                    </div>
                    {packSources.length === 0 ? (
                        <p className="text-xs text-gray-500">No sources yet</p>
                    ) : (
                        <div className="space-y-2">
                            {packSources.map((source: any) => (
                                <div key={source.source_id} className="bg-gray-800 rounded-lg p-3">
                                    <div className="flex items-start gap-2">
                                        <FileText className="w-4 h-4 text-gray-400 mt-0.5" />
                                        <div className="flex-1 min-w-0">
                                            <div className="text-xs font-medium text-white truncate">
                                                {source.file_name || source.source_name}
                                            </div>
                                            <div className="text-[10px] text-gray-400 capitalize mt-0.5">
                                                {source.status?.replace('_', ' ')}
                                            </div>
                                        </div>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* MAIN CONTENT */}
            <div className="flex-1 overflow-y-auto p-8">
                <div className="max-w-4xl mx-auto space-y-6">
                    <div className="flex items-center justify-between">
                        <div>
                            <h2 className="text-2xl font-bold">Create Pack</h2>
                            <p className="text-sm text-gray-400 mt-1">Upload your content to create a portable context pack</p>
                        </div>

                    </div>

                    {/* NEW: Unified ProcessProgress Component */}
                    {processStatus && (
                        <ProcessProgress
                            status={processStatus}
                            onStartAnalysis={async () => {
                                if (isStartingAnalysis) {
                                    console.log('[ProcessV3] Already starting analysis, ignoring duplicate click');
                                    return;
                                }

                                setIsStartingAnalysis(true);
                                console.log('[ProcessV3] Start analysis clicked');

                                try {
                                    const readySource = packSources.find(s => s.status === 'ready_for_analysis');
                                    if (!readySource || !creditInfo) {
                                        console.error('[ProcessV3] Missing readySource or creditInfo', { readySource, creditInfo });
                                        alert('Unable to start analysis. Missing required information.');
                                        return;
                                    }

                                    const isPartial = !creditInfo.canProceed && creditInfo.userCredits > 0;
                                    const maxChunks = isPartial ? creditInfo.userCredits : creditInfo.totalChunks;

                                    if (isPartial && typeof window !== 'undefined') {
                                        localStorage.setItem(`processing_limit_${readySource.source_id}`, creditInfo.userCredits.toString());
                                    }

                                    console.log(`[ProcessV3] Calling startAnalysis for source ${readySource.source_id.substring(0, 8)} with max_chunks:`, maxChunks);

                                    // Add timeout protection
                                    const analysisPromise = startAnalysis(readySource.source_id, creditInfo.totalChunks, isPartial ? maxChunks : undefined);
                                    const timeoutPromise = new Promise((_, reject) =>
                                        setTimeout(() => reject(new Error('Start analysis request timed out after 30 seconds')), 30000)
                                    );

                                    await Promise.race([analysisPromise, timeoutPromise]);
                                    console.log('[ProcessV3] ✅ Analysis started successfully');

                                    // Poll once to get updated state
                                    await pollPackDetails();
                                } catch (error) {
                                    console.error('[ProcessV3] Failed to start analysis:', error);
                                    const errorMessage = error instanceof Error ? error.message : 'Failed to start analysis. Please try again.';
                                    alert(errorMessage);
                                } finally {
                                    console.log('[ProcessV3] Resetting isStartingAnalysis');
                                    setIsStartingAnalysis(false);
                                }
                            }}
                            onCancel={handleCancelProcessing}
                            isStartingAnalysis={isStartingAnalysis}
                            isCancelling={isCancelling}
                        />
                    )}

                    {/* NEW 4-Box Minimal Grid */}
                    <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${processingDisabled ? 'opacity-50 pointer-events-none' : ''}`}>

                        {/* 1. Conversations.json or ZIP */}
                        <div className="relative group bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all h-48">
                            <label className={`absolute inset-0 cursor-pointer flex flex-col items-center justify-center z-10 ${processingDisabled ? 'cursor-not-allowed' : ''}`}>
                                <input
                                    type="file"
                                    accept=".json,.zip"
                                    onChange={(e) => handleConversationUpload(e.target.files)}
                                    className="hidden"
                                    disabled={processingDisabled}
                                />
                                <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                    <MessageSquare className="w-7 h-7 text-gray-400 group-hover:text-white transition-colors" />
                                </div>
                                <h3 className="font-semibold text-lg text-gray-200 group-hover:text-white mb-1">GPT/Claude Chat Export</h3>
                                <p className="text-xs text-gray-500 font-medium">Upload conversations.json or ZIP</p>
                            </label>

                            {/* Helper Link - z-20 to sit above the file input label */}
                            <a
                                href="https://chatgpt.com/#settings/DataControls"
                                target="_blank"
                                rel="noopener noreferrer"
                                className="absolute top-4 right-4 z-20 text-gray-600 hover:text-blue-400 transition-colors"
                                title="Where do I get this?"
                                onClick={(e) => e.stopPropagation()}
                                style={{ pointerEvents: 'auto' }} // Allow clicking help even if disabled
                            >
                                <HelpCircle className="w-5 h-5" />
                            </a>
                        </div>

                        {/* 2. Documents */}
                        <label className={`group bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer h-48 ${processingDisabled ? 'cursor-not-allowed' : ''}`}>
                            <input
                                type="file"
                                multiple
                                accept=".pdf,.txt,.doc,.docx,.csv"
                                onChange={(e) => handleFileUpload(e.target.files)}
                                className="hidden"
                                disabled={processingDisabled}
                            />
                            <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <FileText className="w-7 h-7 text-gray-400 group-hover:text-white transition-colors" />
                            </div>
                            <h3 className="font-semibold text-lg text-gray-200 group-hover:text-white mb-1">Documents</h3>
                            <p className="text-xs text-gray-500 font-medium">PDF, TXT, DOCX, CSV</p>
                        </label>

                        {/* 3. Chat URL */}
                        <button
                            onClick={() => setShowUrlModal(true)}
                            disabled={processingDisabled}
                            className={`group bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer h-48 ${processingDisabled ? 'cursor-not-allowed' : ''}`}
                        >
                            <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <LinkIcon className="w-7 h-7 text-gray-400 group-hover:text-white transition-colors" />
                            </div>
                            <h3 className="font-semibold text-lg text-gray-200 group-hover:text-white mb-1">Paste URL</h3>
                            <p className="text-xs text-gray-500 font-medium">ChatGPT shared links</p>
                        </button>

                        {/* 4. Paste Text */}
                        <button
                            onClick={() => setShowTextModal(true)}
                            disabled={processingDisabled}
                            className={`group bg-gray-900 border border-gray-800 hover:border-gray-600 rounded-xl p-8 flex flex-col items-center justify-center text-center transition-all cursor-pointer h-48 ${processingDisabled ? 'cursor-not-allowed' : ''}`}
                        >
                            <div className="w-14 h-14 bg-gray-800 rounded-full flex items-center justify-center mb-4 group-hover:scale-110 transition-transform">
                                <AlignLeft className="w-7 h-7 text-gray-400 group-hover:text-white transition-colors" />
                            </div>
                            <h3 className="font-semibold text-lg text-gray-200 group-hover:text-white mb-1">Paste Text</h3>
                            <p className="text-xs text-gray-500 font-medium">Direct text input</p>
                        </button>

                    </div>

                    {/* Upload Progress Display */}
                    {fileUploadProgress.size > 0 && (
                        <div className="space-y-3">
                            {Array.from(fileUploadProgress.values()).map((progress) => (
                                <div
                                    key={progress.fileName}
                                    className={`border rounded-lg p-4 ${progress.phase === 'error'
                                        ? 'bg-red-900/20 border-red-500/30'
                                        : progress.phase === 'extracting'
                                            ? 'bg-emerald-900/20 border-emerald-500/30'
                                            : 'bg-blue-900/20 border-blue-500/30'
                                        }`}
                                >
                                    <div className="flex items-start justify-between mb-2">
                                        <div className="flex-1 min-w-0">
                                            <div className="text-sm font-medium text-white truncate">
                                                {progress.fileName}
                                            </div>
                                            <div className="text-xs text-gray-400 mt-0.5">
                                                {formatFileSize(progress.fileSize)}
                                            </div>
                                        </div>
                                        <div className="ml-4">
                                            {progress.phase === 'uploading' && progress.uploadPercent < 100 && (
                                                <span className="text-sm font-semibold text-blue-300">
                                                    {progress.uploadPercent}%
                                                </span>
                                            )}
                                            {(progress.phase === 'extracting' || (progress.phase === 'uploading' && progress.uploadPercent === 100)) && (
                                                <span className="text-sm font-semibold text-emerald-300">
                                                    {progress.extractionProgress !== undefined
                                                        ? `Extracting... ${progress.extractionProgress}%`
                                                        : 'Extracting...'}
                                                </span>
                                            )}
                                            {progress.phase === 'error' && (
                                                <span className="text-sm font-semibold text-red-300">
                                                    Error
                                                </span>
                                            )}
                                        </div>
                                    </div>

                                    {/* Progress Bar */}
                                    {progress.phase === 'uploading' && progress.uploadPercent < 100 && (
                                        <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                            <div
                                                className="bg-blue-500 h-full transition-all duration-300 ease-out"
                                                style={{ width: `${progress.uploadPercent}%` }}
                                            />
                                        </div>
                                    )}

                                    {(progress.phase === 'extracting' || (progress.phase === 'uploading' && progress.uploadPercent === 100)) && (
                                        <>
                                            <div className="w-full bg-gray-800 rounded-full h-2 overflow-hidden">
                                                <div
                                                    className={`bg-emerald-500 h-full ${progress.extractionProgress === undefined ? 'animate-pulse' : 'transition-all duration-300'}`}
                                                    style={{ width: progress.extractionProgress !== undefined ? `${progress.extractionProgress}%` : '100%' }}
                                                />
                                            </div>
                                            <p className="text-xs text-emerald-300/70 mt-2">
                                                Processing and chunking content... This may take up to 2-3 minutes for large files.
                                            </p>
                                        </>
                                    )}

                                    {progress.phase === 'error' && progress.errorMessage && (
                                        <p className="text-xs text-red-300 mt-2">
                                            {progress.errorMessage}
                                        </p>
                                    )}
                                </div>
                            ))}
                        </div>
                    )}
                </div>
            </div>

            {/* URL Input Modal */}
            {showUrlModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-2xl w-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">One Chat</h3>
                            <button
                                onClick={() => setShowUrlModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-4">
                                <LinkIcon className="w-8 h-8 text-gray-400" />
                            </div>
                            <h4 className="text-lg font-semibold mb-2">Paste ChatGPT Conversation URL</h4>
                            <p className="text-sm text-gray-400">
                                Ran out of space. Don't restart. Drop the link here, we'll pull the context and keep going.
                            </p>
                        </div>

                        <input
                            type="url"
                            value={urlInput}
                            onChange={(e) => setUrlInput(e.target.value)}
                            placeholder="https://chatgpt.com/share/..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4 focus:border-gray-600 focus:outline-none"
                        />

                        <button
                            onClick={() => {
                                handleUrlUpload();
                                setShowUrlModal(false);
                            }}
                            disabled={!urlInput.trim()}
                            className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-700 disabled:text-gray-500 text-black px-6 py-3 rounded-lg font-medium transition-colors mb-4"
                        >
                            Start Extraction
                        </button>

                        <p className="text-xs text-gray-500 text-center">
                            🔒 We never store your data. Files are processed securely in your session.
                        </p>
                    </div>
                </div>
            )}

            {/* Text Input Modal */}
            {showTextModal && (
                <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-gray-800 rounded-xl p-8 max-w-3xl w-full">
                        <div className="flex justify-between items-center mb-6">
                            <h3 className="text-xl font-bold">Add sources</h3>
                            <button
                                onClick={() => setShowTextModal(false)}
                                className="text-gray-400 hover:text-white transition-colors"
                            >
                                <X className="w-6 h-6" />
                            </button>
                        </div>

                        <div className="text-center mb-6">
                            <div className="w-16 h-16 bg-gray-800 rounded-lg flex items-center justify-center mx-auto mb-4">
                                <AlignLeft className="w-8 h-8 text-gray-400" />
                            </div>
                            <h4 className="text-lg font-semibold mb-2">Paste Text Content</h4>
                            <p className="text-sm text-gray-400">
                                Paste any text content directly here. We'll analyze it just like a file.
                            </p>
                        </div>

                        <textarea
                            value={textInput}
                            onChange={(e) => setTextInput(e.target.value)}
                            placeholder="Paste your text here..."
                            className="w-full bg-gray-800 border border-gray-700 rounded-lg px-4 py-3 text-white mb-4 focus:border-gray-600 focus:outline-none resize-none"
                            rows={10}
                        />

                        <button
                            onClick={() => {
                                handleTextUpload();
                                setShowTextModal(false);
                            }}
                            disabled={!textInput.trim()}
                            className="w-full bg-white hover:bg-gray-100 disabled:bg-gray-700 disabled:text-gray-500 text-black px-6 py-3 rounded-lg font-medium transition-colors mb-4"
                        >
                            Process Text
                        </button>

                        <p className="text-xs text-gray-500 text-center">
                            🔒 Content is processed securely in your session.
                        </p>
                    </div>
                </div>
            )}

            {/* RIGHT SIDEBAR - Pack Actions */}
            <div className="w-80 bg-gray-900 border-l border-gray-800 flex flex-col">
                <div className="p-4 border-b border-gray-800">
                    <h3 className="text-sm font-semibold">Pack Actions</h3>
                </div>
                <div className="flex-1 overflow-y-auto p-4 space-y-3">
                    <button
                        onClick={handleDownloadPack}
                        disabled={isDownloadingPack}
                        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-3 rounded-lg text-sm font-normal transition-all flex items-center justify-center gap-2 disabled:bg-gray-800 disabled:cursor-not-allowed"
                    >
                        {isDownloadingPack ? (
                            <>
                                <Loader className="h-4 w-4 animate-spin text-blue-400" />
                                <span className="text-gray-300">Preparing Pack...</span>
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                <span>Download Pack</span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={handleDownloadTree}
                        disabled={isDownloadingTree}
                        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-700 text-white px-4 py-3 rounded-lg text-sm font-normal transition-all flex items-center justify-center gap-2 disabled:bg-gray-800 disabled:cursor-not-allowed"
                    >
                        {isDownloadingTree ? (
                            <>
                                <Loader className="h-4 w-4 animate-spin text-emerald-400" />
                                <span className="text-gray-300">Fetching Tree...</span>
                            </>
                        ) : (
                            <>
                                <Download className="h-4 w-4" />
                                <span>Download Memory Tree </span>
                            </>
                        )}
                    </button>

                    <button
                        onClick={() => router.push(`/tree/${selectedPack.pack_id}`)}
                        className="w-full bg-white hover:bg-gray-100 text-black px-4 py-3 rounded-lg text-sm font-normal transition-all flex items-center justify-center gap-2"
                    >
                        <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1H5a1 1 0 01-1-1V5zM14 5a1 1 0 011-1h4a1 1 0 011 1v7a1 1 0 01-1 1h-4a1 1 0 01-1-1V5zM4 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1H5a1 1 0 01-1-1v-3zM14 16a1 1 0 011-1h4a1 1 0 011 1v3a1 1 0 01-1 1h-4a1 1 0 01-1-1v-3z" />
                        </svg>
                        <span>View Memory Tree</span>
                    </button>
                </div>
            </div>
        </div>
    );
}
