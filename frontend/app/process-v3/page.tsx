'use client';

/**
 * Process V3 - Test Route for New ProcessProgress Component
 * This is a simplified version to test the new architecture before backporting to process-v2
 */

import { useEffect, useState, useCallback, useRef } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import { Loader, X, FolderOpen, FileText, Download } from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { usePackManagement } from '@/hooks/usePackManagement';
import { useSourceProcessing } from '@/hooks/useSourceProcessing';
import { usePolling } from '@/hooks/usePolling';
import { useVisibilityChange } from '@/hooks/useVisibilityChange';
import { API_BASE_URL } from '@/lib/api';
import { ProcessProgress } from '@/components/ProcessProgress';
import { ProcessStatus, mapBackendStatus } from '@/types/ProcessState';

export default function ProcessV3Page() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, makeAuthenticatedRequest } = useAuth();

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
    const [isDownloadingPack, setIsDownloadingPack] = useState(false);
    const [isDownloadingTree, setIsDownloadingTree] = useState(false);

    // File upload handler
    const handleFileUpload = async (files: FileList | null) => {
        if (!files || !selectedPack) return;

        const fileArray = Array.from(files);
        console.log('[ProcessV3] Starting upload of', fileArray.length, 'file(s)');

        for (const file of fileArray) {
            console.log('[ProcessV3] Uploading file:', file.name, 'size:', file.size, 'type:', file.type);
            setUploadingFiles(prev => new Set(prev).add(file.name));

            try {
                const formData = new FormData();
                formData.append('file', file);

                const uploadUrl = `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`;
                console.log('[ProcessV3] Upload URL:', uploadUrl);

                const response = await makeAuthenticatedRequest(uploadUrl, {
                    method: 'POST',
                    body: formData
                });

                console.log('[ProcessV3] Response status:', response.status, response.ok);

                if (response.ok) {
                    console.log(`✅ Uploaded: ${file.name}`);

                    // Wait a moment for backend to save
                    await new Promise(resolve => setTimeout(resolve, 500));

                    // Immediately refetch pack to get the new source
                    const packResponse = await makeAuthenticatedRequest(
                        `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}?t=${Date.now()}`
                    );
                    if (packResponse.ok) {
                        const packData = await packResponse.json();
                        const sources = packData.sources || [];
                        setPackSources(sources);
                        console.log('[ProcessV3] ✅ Loaded', sources.length, 'sources after upload');
                        
                        // Update process states for new sources
                        sources.forEach((source: any) => {
                            updateFromSourceStatus(source);
                        });
                    }
                } else {
                    alert(`Upload failed: ${file.name}\nStatus: ${response.status}`);
                }
            } catch (error) {


                alert(`Upload error: ${file.name}\n${error instanceof Error ? error.message : String(error)}`);

            } finally {
                setUploadingFiles(prev => {
                    const next = new Set(prev);
                    next.delete(file.name);
                    return next;
                });
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

    // Polling logic - matches test suite approach
    const isPageVisible = useVisibilityChange();
    
    const shouldPoll = isPageVisible && !!selectedPack && packSources.some(s =>
        !['completed', 'failed', 'cancelled'].includes(s.status)
    );

    const pollPackDetails = useCallback(async () => {
        if (!selectedPack) return;

        try {
            // Use fast endpoint like test suite - fetch pack details
            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}?t=${Date.now()}`
            );

            if (response.ok) {
                const data = await response.json();
                const sources = data.sources || [];
                
                console.log('[ProcessV3] 📊 Poll update:', {
                    packId: data.pack_id,
                    sourcesCount: sources.length,
                    statuses: sources.map((s: any) => ({
                        id: s.source_id?.substring(0, 8),
                        status: s.status,
                        progress: s.progress,
                        chunks: `${s.processed_chunks || 0}/${s.total_chunks || 0}`
                    }))
                });
                
                setPackSources(sources);
                sources.forEach((source: any) => {
                    updateFromSourceStatus(source);
                });
            }
        } catch (error) {
            console.error('[ProcessV3] Polling error:', error);
        }
    }, [selectedPack, makeAuthenticatedRequest, setPackSources, updateFromSourceStatus]);

    usePolling({
        enabled: shouldPoll,
        interval: 2000, // 2 seconds like test suite - proven fast feedback
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

    // Handle cancel
    const handleCancelProcessing = async () => {
        const processingSource = packSources.find(s =>
            ['extracting', 'analyzing', 'processing', 'analyzing_chunks', 'building_tree'].includes(s.status)
        );

        if (processingSource) {
            setIsCancelling(true);
            try {
                const response = await makeAuthenticatedRequest(
                    `${API_BASE_URL}/api/v2/sources/${processingSource.source_id}/cancel`,
                    { method: 'POST' }
                );

                if (response.ok) {
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    await pollPackDetails();
                }
            } catch (error) {
                console.error('[ProcessV3] Cancel error:', error);
            } finally {
                setIsCancelling(false);
            }
        }

        router.push('/packs');
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
                a.download = `${selectedPack.pack_name}_pack.txt`;
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
                    <p className="text-gray-400">Loading pack...</p>
                </div>
            </div>
        );
    }

    const processStatus = getCurrentProcessStatus();

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
                            <h2 className="text-2xl font-bold">Process V3 Test</h2>
                            <p className="text-sm text-gray-400 mt-1">Testing new ProcessProgress component</p>
                        </div>
                        <button
                            onClick={() => router.push('/packs')}
                            className="text-gray-400 hover:text-white transition-colors"
                        >
                            <X className="w-6 h-6" />
                        </button>
                    </div>

                    {/* NEW: Unified ProcessProgress Component */}
                    {processStatus && (
                        <ProcessProgress
                            status={processStatus}
                            onStartAnalysis={async () => {
                                if (isStartingAnalysis) return;
                                setIsStartingAnalysis(true);
                                try {
                                    const readySource = packSources.find(s => s.status === 'ready_for_analysis');
                                    if (!readySource || !creditInfo) return;

                                    const isPartial = !creditInfo.canProceed && creditInfo.userCredits > 0;
                                    const maxChunks = isPartial ? creditInfo.userCredits : creditInfo.totalChunks;

                                    if (isPartial && typeof window !== 'undefined') {
                                        localStorage.setItem(`processing_limit_${readySource.source_id}`, creditInfo.userCredits.toString());
                                    }

                                    console.log(`[ProcessV3] Starting ${isPartial ? 'partial' : 'full'} analysis:`, maxChunks);
                                    await startAnalysis(readySource.source_id, creditInfo.totalChunks, isPartial ? maxChunks : undefined);
                                    await pollPackDetails();
                                } catch (error) {
                                    console.error('[ProcessV3] Failed to start analysis:', error);
                                    alert('Failed to start analysis. Please try again.');
                                } finally {
                                    setIsStartingAnalysis(false);
                                }
                            }}
                            onCancel={handleCancelProcessing}
                            isStartingAnalysis={isStartingAnalysis}
                            isCancelling={isCancelling}
                        />
                    )}

                    {/* File Upload */}
                    <label className="block bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl p-12 cursor-pointer hover:border-gray-600 transition-all text-center">
                        <input
                            type="file"
                            multiple
                            onChange={(e) => handleFileUpload(e.target.files)}
                            className="hidden"
                            accept=".pdf,.txt,.doc,.docx,.json,.zip"
                        />
                        <div className="w-16 h-16 bg-gray-800 rounded-full flex items-center justify-center mx-auto mb-4">
                            <svg className="w-8 h-8 text-gray-400" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 16a4 4 0 01-.88-7.903A5 5 0 1115.9 6L16 6a5 5 0 011 9.9M15 13l-3-3m0 0l-3 3m3-3v12" />
                            </svg>
                        </div>
                        <h3 className="text-xl font-semibold mb-2">Upload Files</h3>
                        <p className="text-gray-400 text-sm">Click to browse or drag and drop</p>
                        <p className="text-gray-500 text-xs mt-2">PDF, TXT, DOC, DOCX, JSON, ZIP</p>
                    </label>

                    {uploadingFiles.size > 0 && (
                        <div className="bg-blue-900/20 border border-blue-500/30 rounded-lg p-4">
                            <p className="text-sm text-blue-300">
                                Uploading {uploadingFiles.size} file(s)...
                            </p>
                        </div>
                    )}

                </div>
            </div>

            {/* RIGHT SIDEBAR - Pack Actions (shown when completed) */}
            {processStatus?.state === 'completed' && (
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
                                    <span>Download Tree JSON</span>
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
            )}
        </div>
    );
}
