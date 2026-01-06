'use client';

import { useEffect, useState, useRef, useCallback, ChangeEvent } from 'react';
import { useRouter, useSearchParams } from 'next/navigation';
import {
    Loader, FileText, Plus, X, Check, AlertCircle, Upload,
    FolderOpen, MessageSquare, Link as LinkIcon, FileTextIcon,
    Download, Network, Save, ChevronDown
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';
import { usePackManagement } from '@/hooks/usePackManagement';
import { useSourceProcessing } from '@/hooks/useSourceProcessing';
import { usePolling } from '@/hooks/usePolling';
import { API_BASE_URL } from '@/lib/api';

export default function ProcessV2Page() {
    const router = useRouter();
    const searchParams = useSearchParams();
    const { user, makeAuthenticatedRequest } = useAuth();

    // Custom hooks
    const {
        packs,
        selectedPack,
        packSources,
        loadPacks,
        loadPackDetails,
        createPack,
        selectPack,
        setPackSources,
        updatePackName: hookUpdatePackName,
        updateCustomPrompt: hookUpdateCustomPrompt,
    } = usePackManagement();

    const {
        modalState,
        creditInfo,
        fetchCreditInfo,
        startAnalysis,
        updateFromSourceStatus,
        closeModal
    } = useSourceProcessing();

    // Local state
    const [newPackName, setNewPackName] = useState('');
    const [isCreatingPack, setIsCreatingPack] = useState(false);
    const [uploadingFiles, setUploadingFiles] = useState<Set<string>>(new Set());
    const [showUrlModal, setShowUrlModal] = useState(false);
    const [showTextModal, setShowTextModal] = useState(false);
    const [customPrompt, setCustomPrompt] = useState('');
    const [isSavingPrompt, setIsSavingPrompt] = useState(false);
    const [promptSavedAt, setPromptSavedAt] = useState<number | null>(null);
    const [urlInput, setUrlInput] = useState('');
    const [textInput, setTextInput] = useState('');
    const [isEditingPackName, setIsEditingPackName] = useState(false);
    const [editedPackName, setEditedPackName] = useState('');
    const [showChatUploadMenu, setShowChatUploadMenu] = useState(false);
    const [chatUploadError, setChatUploadError] = useState<string | null>(null);
    const [uploadNotification, setUploadNotification] = useState<string | null>(null);
    const [isLoadingPack, setIsLoadingPack] = useState(false);
    const [isStartingAnalysis, setIsStartingAnalysis] = useState(false);
    const [isCancelling, setIsCancelling] = useState(false);

    // Track if we've already attempted to select pack from URL
    const hasAttemptedPackSelection = useRef(false);
    const isFetchingPackRef = useRef(false);
    const zipInputRef = useRef<HTMLInputElement>(null);
    const folderInputRef = useRef<HTMLInputElement>(null);
    const jsonInputRef = useRef<HTMLInputElement>(null);
    const pollNowRef = useRef<(() => void) | null>(null);

    // Load packs on mount
    useEffect(() => {
        if (user) {
            loadPacks();
        }
    }, [user, loadPacks]);

    // Auto-select pack from URL when packs load
    useEffect(() => {
        const packId = searchParams.get('pack');
        if (packId && packs.length > 0 && !hasAttemptedPackSelection.current) {
            const pack = packs.find(p => p.pack_id === packId);
            if (pack) {
                console.log('[ProcessV2] Auto-selecting pack from URL:', pack.pack_name);
                selectPack(pack);
                hasAttemptedPackSelection.current = true;
            }
        }
    }, [packs, searchParams, selectPack]);

    // Fallback: if packId is in the URL but not in the current packs list, fetch it directly
    useEffect(() => {
        const packId = searchParams.get('pack');
        if (!user || !packId || hasAttemptedPackSelection.current || isFetchingPackRef.current) return;
        if (selectedPack?.pack_id === packId) return;

        isFetchingPackRef.current = true;
        setIsLoadingPack(true);
        (async () => {
            try {
                console.log('[ProcessV2] Fetching pack directly by id from URL');
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

                    hasAttemptedPackSelection.current = true;
                    await selectPack(pack);
                } else {
                    console.warn('[ProcessV2] Failed to fetch pack by id:', response.status);
                }
            } catch (error) {
                console.error('[ProcessV2] Error fetching pack by id:', error);
            } finally {
                isFetchingPackRef.current = false;
                setIsLoadingPack(false);
            }
        })();
    }, [user, selectedPack, searchParams, makeAuthenticatedRequest, selectPack]);

    // Sync custom prompt when pack changes
    useEffect(() => {
        setCustomPrompt(selectedPack?.custom_system_prompt || '');
    }, [selectedPack]);

    // Polling for source status updates
    // Fast poll while processing; slow keepalive otherwise to reduce request load
    const hasActiveProcessing = packSources.some((s) =>
        ['extracting', 'analyzing', 'processing', 'analyzing_chunks', 'building_tree', 'ready_for_analysis'].includes(s.status?.toLowerCase())
    );
    const modalIsOpen = modalState.type !== 'hidden';
    // Only poll if pack exists AND has sources that are not in a terminal state
    // FIXED: Keep polling active when ready_for_analysis so status changes are tracked after "Start Analysis"
    const shouldPoll = !!selectedPack && packSources.some(s =>
        !['completed', 'failed', 'cancelled'].includes(s.status)
    );
    const pollInterval = hasActiveProcessing || modalIsOpen ? 2000 : 12000;

    const pollPackDetails = useCallback(async () => {
        if (!selectedPack) {
            console.log('[ProcessV2] Polling skipped: no selectedPack');
            return;
        }

        const startTime = Date.now();
        const pollId = selectedPack.pack_id.substring(0, 8);

        try {
            console.log(`[ProcessV2] 🔄 [${pollId}] Starting poll at ${new Date().toISOString()}`);

            // Add a timestamp to avoid any cached responses and keep polling live
            const url = `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}?t=${Date.now()}`;
            console.log(`[ProcessV2] 📤 [${pollId}] Sending request...`);

            const response = await makeAuthenticatedRequest(url);

            const responseTime = Date.now() - startTime;
            console.log(`[ProcessV2] 📥 [${pollId}] Response received after ${responseTime}ms`);

            if (!response) {
                console.error(`[ProcessV2] ❌ [${pollId}] No response received`);
                return;
            }

            console.log(`[ProcessV2] 📡 [${pollId}] Response status:`, response.status);

            if (response.ok) {
                console.log(`[ProcessV2] 📋 [${pollId}] Parsing JSON...`);
                const data = await response.json();
                const parseTime = Date.now() - startTime;
                console.log(`[ProcessV2] ✅ [${pollId}] JSON parsed after ${parseTime}ms total`);

                const sources = data.sources || [];
                setPackSources(sources);

                // Log all source statuses for debugging
                console.log(`[ProcessV2] 📊 [${pollId}] Sources:`, sources.map((s: any) => ({
                    id: s.source_id.substring(0, 8),
                    status: s.status,
                    progress: s.progress,
                    processed_chunks: s.processed_chunks,
                    total_chunks: s.total_chunks
                })));

                // Update modal state for each source
                sources.forEach((source: any) => {
                    updateFromSourceStatus(source);

                    // Disabled auto-trigger - users now have explicit "Start Analysis" button in progress card
                    // This prevents duplicate modals and gives users full control
                    // if (source.status === 'ready_for_analysis' && modalState.type === 'hidden') {
                    //     console.log('[ProcessV2] Source ready for analysis, showing credit modal');
                    //     handleSourceReady(source.source_id);
                    // }
                });

                const totalTime = Date.now() - startTime;
                console.log(`[ProcessV2] ✅ [${pollId}] Poll completed in ${totalTime}ms`);
            } else {
                const errorText = await response.text().catch(() => 'Unable to read response');
                console.error(`[ProcessV2] ❌ [${pollId}] Poll failed with status:`, response.status, errorText);
            }
        } catch (error: any) {
            const errorTime = Date.now() - startTime;
            // Handle AbortError specially (timeout)
            if (error.name === 'AbortError') {
                console.warn(`[ProcessV2] ⏱️ [${pollId}] Poll timed out after ${errorTime}ms`);
            } else {
                console.error(`[ProcessV2] ❌ [${pollId}] Polling error after ${errorTime}ms:`, error);
                console.error(`[ProcessV2] ❌ [${pollId}] Error name:`, error.name);
                console.error(`[ProcessV2] ❌ [${pollId}] Error message:`, error.message);
            }
            // Don't throw - let polling continue even if one request fails
        }
    }, [selectedPack, makeAuthenticatedRequest, setPackSources, updateFromSourceStatus]);

    usePolling({
        enabled: !!shouldPoll,
        interval: pollInterval,
        onPoll: pollPackDetails,
    });

    console.log('[ProcessV2] Polling status:', { shouldPoll, pollInterval, hasSelectedPack: !!selectedPack });

    // Auto-fetch credit info when source becomes ready_for_analysis
    useEffect(() => {
        const readySource = packSources.find(s => s.status === 'ready_for_analysis');
        if (readySource && !creditInfo) {
            console.log('[ProcessV2] Auto-fetching credit info for source:', readySource.source_id);
            fetchCreditInfo(readySource.source_id);
        }
    }, [packSources, creditInfo, fetchCreditInfo]);

    // Handle pack creation
    const handleCreatePack = async () => {
        if (!newPackName.trim()) return;

        setIsCreatingPack(true);
        try {
            const pack = await createPack(newPackName);

            if (pack) {
                setNewPackName('');
                await selectPack(pack);
                router.push(`/process-v2?pack=${pack.pack_id}`);
            }
        } catch (error) {
            console.error('Create pack failed:', error);
            if (error instanceof Error) {
                if (error.message.includes('timeout')) {
                    alert('Pack creation is taking longer than expected. Please check your internet connection and try again.');
                } else if (error.message.includes('Authentication')) {
                    alert('Sign in is required before creating a pack. Please log in and try again.');
                } else {
                    alert(`Failed to create pack: ${error.message}`);
                }
            } else {
                alert('Failed to create pack. Please try again.');
            }
        } finally {
            setIsCreatingPack(false);
        }
    };

    // Handle pack selection with URL update
    const handleSelectPack = async (pack: any) => {
        await selectPack(pack);
        router.push(`/process-v2?pack=${pack.pack_id}`);
    };

    // Handle file upload
    const handleFileUpload = async (files: FileList | File[] | null) => {
        if (!files || !selectedPack) return;

        const fileArray = Array.isArray(files) ? files : Array.from(files);
        console.log('[ProcessV2] Starting upload of', fileArray.length, 'file(s)');

        for (const file of fileArray) {
            console.log('[ProcessV2] Uploading:', file.name);
            setUploadingFiles((prev) => new Set(prev).add(file.name));

            // Show notification IMMEDIATELY before starting upload
            setUploadNotification(`Uploading ${file.name}...`);

            try {
                const formData = new FormData();
                formData.append('file', file);

                console.log('[ProcessV2] Sending POST to:', `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`);

                // Add timeout wrapper to prevent indefinite hangs
                const uploadPromise = makeAuthenticatedRequest(
                    `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`,
                    {
                        method: 'POST',
                        body: formData,
                    }
                );

                const timeoutPromise = new Promise<never>((_, reject) => {
                    setTimeout(() => reject(new Error('Upload timeout - file may be too large or network is slow')), 60000);
                });

                const response = await Promise.race([uploadPromise, timeoutPromise]);

                if (response.ok) {
                    console.log(`✅ Uploaded: ${file.name}`);
                    setUploadNotification(`${file.name} uploaded — extracting content...`);
                    setTimeout(() => setUploadNotification(null), 4000);

                    // Immediate poll to catch extracting status
                    await pollPackDetails();
                } else {
                    const errorText = await response.text();
                    console.error(`❌ Upload failed:`, file.name, response.status, errorText);
                    setUploadNotification(`Upload failed: ${file.name}`);
                    setTimeout(() => setUploadNotification(null), 4000);
                }
            } catch (error) {
                console.error(`❌ Upload error:`, file.name, error);
                const errorMessage = error instanceof Error && error.message.includes('timeout')
                    ? `${file.name} is taking too long to upload. Try a smaller file or check your connection.`
                    : `Upload error: ${file.name}. Please try again.`;
                setUploadNotification(errorMessage);
                setTimeout(() => setUploadNotification(null), 6000);
            } finally {
                setUploadingFiles((prev) => {
                    const next = new Set(prev);
                    next.delete(file.name);
                    return next;
                });
            }
        }
    };

    const handleZipInputChange = (files: FileList | null) => {
        setChatUploadError(null);
        setShowChatUploadMenu(false);
        handleFileUpload(files);
        if (zipInputRef.current) {
            zipInputRef.current.value = '';
        }
    };

    const handleJsonInputChange = (files: FileList | null) => {
        setChatUploadError(null);
        setShowChatUploadMenu(false);
        handleFileUpload(files);
        if (jsonInputRef.current) {
            jsonInputRef.current.value = '';
        }
    };

    const handleFolderInputChange = (event: ChangeEvent<HTMLInputElement>) => {
        const files = event.target.files;
        setChatUploadError(null);

        if (!files || files.length === 0) {
            return;
        }

        const conversationFile = Array.from(files).find(
            (file) => file.name.toLowerCase() === 'conversations.json'
        );

        if (conversationFile) {
            setShowChatUploadMenu(false);
            handleFileUpload([conversationFile]);
        } else {
            setChatUploadError('No conversations.json found in that folder.');
        }

        event.target.value = '';
    };

    const processingDisabled = packSources.some(s => ['extracting', 'analyzing', 'processing', 'analyzing_chunks', 'building_tree'].includes(s.status));

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
                await loadPackDetails(selectedPack.pack_id);
            }
        } catch (error) {
            console.error('❌ URL upload error:', error);
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
                await loadPackDetails(selectedPack.pack_id);
            }
        } catch (error) {
            console.error('❌ Text upload error:', error);
        }
    };

    // Handle custom prompt save
    const handleSaveCustomPrompt = async () => {
        if (!selectedPack) return;

        setIsSavingPrompt(true);
        await hookUpdateCustomPrompt(selectedPack.pack_id, customPrompt);
        setIsSavingPrompt(false);
        setPromptSavedAt(Date.now());

        setTimeout(() => setPromptSavedAt(null), 3000);
    };

    // Handle pack name update
    const updatePackName = async () => {
        if (!selectedPack || editedPackName.trim() === selectedPack.pack_name) {
            setIsEditingPackName(false);
            return;
        }

        await hookUpdatePackName(selectedPack.pack_id, editedPackName.trim());
        setIsEditingPackName(false);
    };

    // Handle pack download
    const handleDownloadPack = async () => {
        if (!selectedPack) return;

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
            }
        } catch (error) {
            console.error('[Download] Pack download error:', error);
        }
    };

    // Handle process cancellation
    const handleCancelProcessing = async () => {
        // Find the currently processing source
        const processingSource = packSources.find(s =>
            ['extracting', 'analyzing', 'processing', 'analyzing_chunks', 'building_tree'].includes(s.status)
        );

        if (processingSource) {
            setIsCancelling(true);
            try {
                console.log(`[ProcessV2] 🛑 Cancelling source: ${processingSource.source_id}`);
                const response = await makeAuthenticatedRequest(
                    `${API_BASE_URL}/api/v2/sources/${processingSource.source_id}/cancel`,
                    { method: 'POST' }
                );

                if (response.ok) {
                    console.log('[ProcessV2] ✅ Cancellation requested - waiting for backend to stop...');
                    // Wait for the backend to finish current chunk and update status
                    await new Promise(resolve => setTimeout(resolve, 2000));
                    // Force a final poll to get updated status
                    await pollPackDetails();
                } else {
                    console.error('[ProcessV2] ❌ Cancel request failed:', response.status);
                }
            } catch (error) {
                console.error('[ProcessV2] ❌ Error cancelling process:', error);
            } finally {
                setIsCancelling(false);
            }
        }

        // Close any open modals
        closeModal();

        // Navigate away after ensuring cancel was processed
        router.push('/packs');
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

    return (
        <>
            <div className="min-h-screen bg-gray-950 text-white flex">
                {/* LEFT SIDEBAR - Pack Settings & Sources */}
                <div className="w-80 bg-gray-900 border-r border-gray-800 flex flex-col">
                    {/* Pack Header */}
                    <div className="p-4 border-b border-gray-800">
                        <div className="flex items-center justify-between mb-3">
                            <div className="flex items-center gap-2 flex-1 min-w-0">
                                <FolderOpen className="w-5 h-5 text-gray-400 flex-shrink-0" />
                                {isEditingPackName && selectedPack ? (
                                    <input
                                        type="text"
                                        value={editedPackName}
                                        onChange={(e) => setEditedPackName(e.target.value)}
                                        onBlur={updatePackName}
                                        onKeyDown={(e) => {
                                            if (e.key === 'Enter') updatePackName();
                                            if (e.key === 'Escape') {
                                                setIsEditingPackName(false);
                                                setEditedPackName(selectedPack.pack_name);
                                            }
                                        }}
                                        autoFocus
                                        className="text-sm font-semibold bg-gray-800 text-white px-2 py-1 rounded border border-gray-600 focus:border-gray-500 focus:outline-none flex-1"
                                    />
                                ) : (
                                    <h2
                                        className="text-sm font-semibold text-white cursor-pointer hover:text-gray-300 transition-colors truncate"
                                        onClick={() => {
                                            if (selectedPack) {
                                                setEditedPackName(selectedPack.pack_name);
                                                setIsEditingPackName(true);
                                            }
                                        }}
                                        title="Click to edit"
                                    >
                                        {selectedPack ? selectedPack.pack_name : 'No Pack Selected'}
                                    </h2>
                                )}
                            </div>
                        </div>

                    </div>

                    {/* Sources List */}
                    <div className="flex-1 overflow-y-auto">
                        <div className="p-4">
                            <div className="flex items-center justify-between mb-3">
                                <span className="text-xs font-semibold text-gray-300 uppercase tracking-wide">
                                    Sources ({packSources.length})
                                </span>
                            </div>

                            {packSources.length === 0 ? (
                                <div className="text-center py-8">
                                    <FileText className="w-8 h-8 text-gray-600 mx-auto mb-2" />
                                    <p className="text-xs text-gray-500">No sources yet</p>
                                    <p className="text-xs text-gray-600 mt-1">Upload files to get started</p>
                                </div>
                            ) : (
                                <div className="space-y-2">
                                    {packSources.map((source: any) => (
                                        <div
                                            key={source.source_id}
                                            className="bg-gray-800 border border-gray-700 rounded-lg p-3 hover:bg-gray-750 transition-colors"
                                        >
                                            <div className="flex items-start gap-2">
                                                <FileText className="w-4 h-4 text-gray-400 flex-shrink-0 mt-0.5" />
                                                <div className="flex-1 min-w-0">
                                                    <div className="text-xs font-medium text-white truncate">
                                                        {source.file_name || source.source_name}
                                                    </div>
                                                    <div className="text-[10px] text-gray-400 capitalize mt-0.5">
                                                        {source.status?.replace('_', ' ')}
                                                    </div>
                                                    {source.progress !== undefined && source.progress < 100 && (
                                                        <div className="mt-2 bg-gray-700 rounded-full h-1 overflow-hidden">
                                                            <div
                                                                className="bg-blue-500 h-full transition-all duration-300"
                                                                style={{ width: `${source.progress}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                </div>
                                                {source.status === 'completed' && (
                                                    <Check className="w-4 h-4 text-green-500 flex-shrink-0" />
                                                )}
                                                {['analyzing', 'processing', 'analyzing_chunks', 'building_tree'].includes(source.status) && (
                                                    <Loader className="w-4 h-4 text-blue-500 animate-spin flex-shrink-0" />
                                                )}
                                            </div>
                                        </div>
                                    ))}
                                </div>
                            )}
                        </div>
                    </div>
                </div>

                {/* MAIN CONTENT - Upload Options */}
                <div className="flex-1 overflow-y-auto p-8">
                    {isLoadingPack ? (
                        /* Loading Pack */
                        <div className="max-w-4xl mx-auto text-center py-20">
                            <Loader className="w-12 h-12 text-blue-500 animate-spin mx-auto mb-4" />
                            <h2 className="text-2xl font-bold text-white mb-2">Loading pack...</h2>
                            <p className="text-gray-400">Please wait while we fetch your pack details</p>
                        </div>
                    ) : !selectedPack ? (
                        /* Pack Creation */
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="space-y-6 text-center">
                                <div className="inline-flex items-center gap-3 px-4 py-2 rounded-full border border-gray-800 bg-gray-900/70 text-sm text-gray-300">
                                    <span className="text-blue-400">●</span> Create your workspace memory
                                </div>
                                <div className="space-y-3">
                                    <h1 className="text-5xl font-semibold tracking-tight text-white">Create Your Pack</h1>
                                    <p className="text-lg text-gray-400">A clean slate for your long-term AI memory.</p>
                                </div>
                            </div>

                            <div className="grid gap-4 md:grid-cols-[2fr,1fr] items-stretch">
                                <div className="bg-gray-900/80 border border-gray-800 rounded-2xl p-6 shadow-xl flex flex-col gap-4">
                                    <div className="flex items-center justify-between">
                                        <div className="text-left">
                                            <p className="text-sm uppercase tracking-wide text-gray-500">New pack</p>
                                            <h2 className="text-xl font-semibold text-white">Name your pack</h2>
                                        </div>
                                        <div className="h-10 w-10 rounded-full bg-blue-600/20 border border-blue-500/30 flex items-center justify-center text-blue-300 font-semibold">+ </div>
                                    </div>
                                    <input
                                        type="text"
                                        value={newPackName}
                                        onChange={(e) => setNewPackName(e.target.value)}
                                        placeholder="e.g., Product GTM, Research Vault, Customer Notes"
                                        className="w-full bg-gray-800 border border-gray-700 rounded-xl px-4 py-3 text-white focus:border-blue-500 focus:outline-none transition"
                                    />
                                    <div className="flex flex-col sm:flex-row gap-3">
                                        <button
                                            onClick={handleCreatePack}
                                            disabled={isCreatingPack || !newPackName.trim()}
                                            className="flex-1 px-4 py-3 bg-blue-600 hover:bg-blue-700 disabled:bg-gray-700 disabled:cursor-not-allowed text-white rounded-xl font-semibold flex items-center justify-center gap-2 shadow-lg transition"
                                        >
                                            {isCreatingPack ? <Loader className="h-5 w-5 animate-spin" /> : <Plus className="h-5 w-5" />}
                                            Create pack
                                        </button>
                                        <button
                                            onClick={() => setNewPackName('')}
                                            disabled={isCreatingPack}
                                            className="px-4 py-3 bg-gray-800 hover:bg-gray-750 border border-gray-700 text-gray-200 rounded-xl font-medium transition disabled:opacity-60"
                                        >
                                            Clear
                                        </button>
                                    </div>
                                    <p className="text-xs text-left text-gray-500">You can add documents, chat exports, and URLs after creating the pack.</p>
                                </div>
                                <div className="bg-gray-900/70 border border-gray-800 rounded-2xl p-6 shadow-xl text-left space-y-3">
                                    <p className="text-sm font-semibold text-white">What is a pack?</p>
                                    <p className="text-sm text-gray-400">A portable memory container that holds your sources, analyses, and memory tree. Use it to keep context consistent across platforms. Upload packs to LLMs to ensure accurate and persistent memory. </p>
                                    <div className="grid grid-cols-1 gap-2 text-sm text-gray-300">
                                        <div className="flex items-center gap-2"><span className="text-emerald-400">•</span> Upload docs, chats, and links</div>
                                        <div className="flex items-center gap-2"><span className="text-emerald-400">•</span> Run analysis and build a memory tree</div>
                                        <div className="flex items-center gap-2"><span className="text-emerald-400">•</span> Reuse the pack across workflows</div>
                                    </div>
                                </div>
                            </div>

                            {packs.length > 0 && (
                                <div className="bg-gray-900 border border-gray-800 rounded-xl p-6">
                                    <h2 className="text-xl font-semibold mb-4">Your Packs</h2>
                                    <div className="space-y-2">
                                        {packs.map((pack) => (
                                            <button
                                                key={pack.pack_id}
                                                onClick={() => handleSelectPack(pack)}
                                                className="w-full text-left bg-gray-800 hover:bg-gray-750 border border-gray-700 rounded-lg p-4 transition-colors"
                                            >
                                                <div className="font-medium">{pack.pack_name}</div>
                                                <div className="text-sm text-gray-400">{pack.total_sources} sources</div>
                                            </button>
                                        ))}
                                    </div>
                                </div>
                            )}
                        </div>
                    ) : (
                        /* Upload Area with optional progress */
                        <div className="max-w-4xl mx-auto space-y-6">
                            <div className="flex items-center justify-between">
                                <h2 className="text-2xl font-bold">Add sources</h2>
                                <button
                                    onClick={() => router.push('/packs')}
                                    className="text-gray-400 hover:text-white transition-colors"
                                >
                                    <X className="w-6 h-6" />
                                </button>
                            </div>

                            {/* Progress Card - Shows at top when analyzing */}
                            {packSources.some(s => ['ready_for_analysis', 'extracting', 'analyzing', 'processing', 'analyzing_chunks', 'building_tree'].includes(s.status)) && (
                                <div className="bg-gradient-to-br from-gray-800/50 to-gray-900/50 border border-gray-700/50 rounded-lg p-6 backdrop-blur-sm">
                                    <div className="flex items-start justify-between mb-4">
                                        <div className="flex-1">
                                            <div className="flex items-center gap-3 mb-2">
                                                <div className="w-2 h-2 rounded-full bg-blue-400 animate-pulse" />
                                                <h3 className="text-lg font-semibold text-white tracking-tight">
                                                    {packSources.some(s => s.status === 'ready_for_analysis') ? 'Ready for Analysis' :
                                                        packSources.some(s => s.status === 'building_tree') ? 'Building Memory Tree' :
                                                            packSources.some(s => s.status === 'extracting') ? 'Extracting Content' :
                                                                'Analyzing Content'}
                                                </h3>
                                            </div>
                                            <p className="text-sm text-gray-400 leading-relaxed">
                                                {(() => {
                                                    if (packSources.some(s => s.status === 'ready_for_analysis')) {
                                                        return 'Content extraction complete. Begin analysis to process your data.';
                                                    }
                                                    if (packSources.some(s => s.status === 'building_tree')) {
                                                        return 'Organizing knowledge into structured memory graph.';
                                                    }
                                                    const activeSource = packSources.find(s =>
                                                        ['extracting', 'analyzing', 'processing', 'analyzing_chunks'].includes(s.status)
                                                    );
                                                    if (activeSource?.status === 'extracting') {
                                                        return 'Extracting and chunking content for semantic analysis.';
                                                    }
                                                    return 'Processing and analyzing your content. Reload if stalled';
                                                })()}
                                            </p>
                                        </div>
                                        <button
                                            onClick={handleCancelProcessing}
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

                                    {/* Progress Bar */}
                                    {(() => {
                                        const analyzingSource = packSources.find(s =>
                                            ['analyzing', 'processing', 'analyzing_chunks', 'building_tree'].includes(s.status)
                                        );
                                        if (analyzingSource) {
                                            const total = analyzingSource.total_chunks || 0;
                                            const isBuildingTree = analyzingSource.status === 'building_tree';
                                            const processed = isBuildingTree ? total : (analyzingSource.processed_chunks || 0);
                                            const backendPercent = typeof analyzingSource.progress === 'number' ? Math.round(analyzingSource.progress) : null;
                                            const percent = backendPercent ?? (total > 0 ? Math.round((processed / total) * 100) : 0);
                                            const processedDisplay = isBuildingTree && total > 0 ? total : processed;
                                            const chunksLabel = total > 0 ? `${processedDisplay} / ${total} chunks` : (isBuildingTree ? 'Building tree' : 'Processing');
                                            const isLargeJob = total >= 10;

                                            return (
                                                <div className="space-y-3">
                                                    <div className="flex items-center justify-between text-sm">
                                                        <span className="text-gray-500 font-medium">{chunksLabel}</span>
                                                        <span className="text-gray-300 font-semibold tabular-nums">{percent}%</span>
                                                    </div>
                                                    {!isBuildingTree && (
                                                        <div className="w-full bg-gray-700/30 rounded-full h-1.5 overflow-hidden">
                                                            <div
                                                                className="bg-gradient-to-r from-blue-500 to-blue-400 h-full transition-all duration-700 ease-out"
                                                                style={{ width: `${percent}%` }}
                                                            />
                                                        </div>
                                                    )}
                                                    {isLargeJob && (
                                                        <div className="bg-gray-800/50 border border-gray-700/50 rounded p-3">
                                                            <p className="text-xs text-gray-400 leading-relaxed">
                                                                <strong className="text-gray-300">If progress stalled, refresh the page to update status. Or check email!</strong>
                                                            </p>
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                    })()}

                                    {/* Ready for Analysis - Show inline credit info + button */}
                                    {(() => {
                                        const readySource = packSources.find(s => s.status === 'ready_for_analysis');
                                        if (readySource) {
                                            return (
                                                <div className="mt-4 space-y-3">
                                                    {/* Inline Credit Info - Clean & Minimal */}
                                                    {creditInfo && (
                                                        <div className="bg-gray-900/40 border border-gray-800 rounded-lg p-5 space-y-3">
                                                            <div className="grid grid-cols-2 gap-4">
                                                                <div>
                                                                    <div className="text-xs text-gray-500 mb-1">Chunks</div>
                                                                    <div className="text-lg font-semibold text-white">{creditInfo.totalChunks}</div>
                                                                </div>
                                                                <div>
                                                                    <div className="text-xs text-gray-500 mb-1">Credits</div>
                                                                    <div className="text-lg font-semibold text-white">{creditInfo.creditsRequired}</div>
                                                                </div>
                                                            </div>
                                                            <div className="flex items-center justify-between pt-3 border-t border-gray-800">
                                                                <span className="text-sm text-gray-400">Your balance</span>
                                                                <span className={`text-sm font-medium ${creditInfo.canProceed ? 'text-green-400' : 'text-red-400'}`}>
                                                                    {creditInfo.hasUnlimited ? '∞' : creditInfo.userCredits}
                                                                </span>
                                                            </div>
                                                            <div className="flex items-center justify-between">
                                                                <span className="text-sm text-gray-400">Est. time</span>
                                                                <span className="text-sm font-medium text-gray-300">
                                                                    {creditInfo.totalChunks <= 5 ? '2-3 min' :
                                                                        creditInfo.totalChunks <= 10 ? '3-5 min' :
                                                                            creditInfo.totalChunks <= 20 ? '5-15 min' : '15-40 min'}
                                                                </span>
                                                            </div>
                                                        </div>
                                                    )}

                                                    {/* Action Button */}
                                                    {creditInfo?.canProceed ? (
                                                        <button
                                                            onClick={async () => {
                                                                if (isStartingAnalysis) return;
                                                                setIsStartingAnalysis(true);
                                                                try {
                                                                    console.log('[ProcessV2] 🚀 Starting analysis for source:', readySource.source_id);
                                                                    // Full analysis
                                                                    await startAnalysis(readySource.source_id, creditInfo.totalChunks);
                                                                    console.log('[ProcessV2] ✅ Analysis started successfully, polling...');
                                                                    await pollPackDetails();
                                                                } catch (error) {
                                                                    console.error('[ProcessV2] ❌ Failed to start analysis:', error);
                                                                    alert('Failed to start analysis. Please try again.');
                                                                } finally {
                                                                    setIsStartingAnalysis(false);
                                                                }
                                                            }}
                                                            disabled={isStartingAnalysis}
                                                            className={`w-full px-4 py-3 rounded font-medium transition-all duration-200 shadow-sm flex items-center justify-center gap-2 ${isStartingAnalysis
                                                                    ? 'bg-blue-500 cursor-not-allowed'
                                                                    : 'bg-blue-600 hover:bg-blue-700 hover:shadow-md'
                                                                } text-white`}
                                                        >
                                                            {isStartingAnalysis ? (
                                                                <>
                                                                    <Loader className="w-4 h-4 animate-spin" />
                                                                    Starting...
                                                                </>
                                                            ) : (
                                                                'Start Analysis'
                                                            )}
                                                        </button>
                                                    ) : creditInfo && !creditInfo.canProceed ? (
                                                        <div className="space-y-4">
                                                            <div className="p-3 bg-red-900/20 border border-red-500/20 rounded-lg">
                                                                <p className="text-sm text-red-400 text-center">
                                                                    Insufficient credits for full analysis. You need {creditInfo.creditsRequired - creditInfo.userCredits} more.
                                                                </p>
                                                            </div>

                                                            <div className="grid grid-cols-1 gap-3">
                                                                {/* Option 1: Partial Processing (if they have ANY credits) */}
                                                                {creditInfo.userCredits > 0 && (
                                                                    <button
                                                                        onClick={async () => {
                                                                            if (isStartingAnalysis) return;
                                                                            setIsStartingAnalysis(true);
                                                                            try {
                                                                                console.log('[ProcessV2] 🚀 Starting partial analysis:', readySource.source_id, creditInfo.userCredits);
                                                                                // Partial analysis - pass maxChunks = userCredits
                                                                                await startAnalysis(readySource.source_id, creditInfo.totalChunks, creditInfo.userCredits);
                                                                                console.log('[ProcessV2] ✅ Partial analysis started successfully');
                                                                                await pollPackDetails();
                                                                            } catch (error) {
                                                                                console.error('[ProcessV2] ❌ Failed to start partial analysis:', error);
                                                                                alert('Failed to start analysis. Please try again.');
                                                                            } finally {
                                                                                setIsStartingAnalysis(false);
                                                                            }
                                                                        }}
                                                                        disabled={isStartingAnalysis}
                                                                        className="w-full bg-gray-800 hover:bg-gray-700 border border-gray-600 text-white px-4 py-3 rounded font-medium transition-all duration-200 flex items-center justify-center gap-2"
                                                                    >
                                                                        {isStartingAnalysis ? (
                                                                            <Loader className="w-4 h-4 animate-spin" />
                                                                        ) : (
                                                                            <FileText className="w-4 h-4 text-gray-400" />
                                                                        )}
                                                                        Process {creditInfo.userCredits} chunks (use balance)
                                                                    </button>
                                                                )}

                                                                {/* Option 2: Buy More */}
                                                                <button
                                                                    onClick={() => router.push('/pricing')}
                                                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-4 py-3 rounded font-medium transition-all duration-200 shadow-sm hover:shadow-md flex items-center justify-center gap-2"
                                                                >
                                                                    Buy Credits
                                                                </button>
                                                            </div>
                                                        </div>
                                                    ) : (
                                                        <div className="w-full bg-gray-700 text-gray-400 px-4 py-3 rounded font-medium text-center">
                                                            Loading credit info...
                                                        </div>
                                                    )}
                                                </div>
                                            );
                                        }
                                        return null;
                                    })()}
                                </div>
                            )}

                            {/* Main Upload Card */}
                            <label className={`block bg-gray-900 border-2 border-dashed border-gray-700 rounded-xl p-12 cursor-pointer transition-all text-center ${processingDisabled
                                ? 'opacity-50 pointer-events-none'
                                : 'hover:border-gray-600'
                                }`}>
                                <input
                                    type="file"
                                    multiple
                                    onChange={(e) => handleFileUpload(e.target.files)}
                                    className="hidden"
                                    accept=".pdf,.txt,.doc,.docx,.json,.zip"
                                    disabled={processingDisabled}
                                />
                                <Upload className="w-16 h-16 text-gray-500 mx-auto mb-4" />
                                <h3 className="text-xl font-semibold mb-2">Upload sources</h3>
                                <p className="text-gray-400 text-sm">Migrate between AI. Keep your AI memory fresh. Build a personal memory system.</p>
                            </label>

                            {/* Upload Options Grid - Disabled during processing */}
                            <div className={`grid grid-cols-1 md:grid-cols-2 gap-4 ${processingDisabled ? 'opacity-50 pointer-events-none' : ''}`}>
                                {/* All ChatGPT Chats */}
                                <div
                                    className="relative bg-gray-900 border-2 border-gray-800 hover:border-gray-700 rounded-xl p-6 cursor-pointer transition-all"
                                    onClick={(e) => {
                                        e.stopPropagation();
                                        if (processingDisabled) return;
                                        setShowChatUploadMenu((prev) => !prev);
                                    }}
                                >
                                    <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-4">
                                        <MessageSquare className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <div>
                                            <h3 className="font-semibold mb-1">All ChatGPT Chats</h3>
                                            <p className="text-sm text-gray-400 mb-2">ZIP, Folder, or conversations.json</p>
                                        </div>
                                        <ChevronDown className="h-5 w-5 text-gray-400" />
                                    </div>
                                    <a href="#" className="text-xs text-blue-400 hover:underline">How to download →</a>

                                    {showChatUploadMenu && (
                                        <div className="absolute left-0 right-0 mt-3 bg-gray-950 border border-gray-800 rounded-xl shadow-2xl z-20 overflow-hidden">
                                            <div className="divide-y divide-gray-800">
                                                <button
                                                    className="w-full text-left px-4 py-6 hover:bg-gray-900 flex items-center gap-3 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        zipInputRef.current?.click();
                                                    }}
                                                    disabled={processingDisabled}
                                                >
                                                    <Upload className="h-4 w-4 text-gray-200" />
                                                    <span className="text-sm text-gray-100">Upload ZIP export</span>
                                                </button>
                                                <button
                                                    className="w-full text-left px-4 py-6 hover:bg-gray-900 flex items-center gap-3 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        folderInputRef.current?.click();
                                                    }}
                                                    disabled={processingDisabled}
                                                >
                                                    <FolderOpen className="h-4 w-4 text-gray-200" />
                                                    <span className="text-sm text-gray-100">Select exported folder</span>
                                                </button>
                                                <button
                                                    className="w-full text-left px-4 py-6 hover:bg-gray-900 flex items-center gap-3 transition-colors"
                                                    onClick={(e) => {
                                                        e.stopPropagation();
                                                        jsonInputRef.current?.click();
                                                    }}
                                                    disabled={processingDisabled}
                                                >
                                                    <FileText className="h-4 w-4 text-gray-200" />
                                                    <span className="text-sm text-gray-100">Upload conversations.json</span>
                                                </button>
                                            </div>
                                        </div>
                                    )}

                                    {chatUploadError && (
                                        <p className="mt-3 text-xs text-rose-400">{chatUploadError}</p>
                                    )}

                                    {/* Hidden inputs for each choice */}
                                    <input
                                        ref={zipInputRef}
                                        type="file"
                                        accept=".zip"
                                        className="hidden"
                                        onChange={(e) => handleZipInputChange(e.target.files)}
                                    />
                                    <input
                                        ref={folderInputRef}
                                        type="file"
                                        className="hidden"
                                        onChange={handleFolderInputChange}
                                        // @ts-expect-error directory upload for webkit
                                        webkitdirectory="true"
                                        directory="true"
                                    />
                                    <input
                                        ref={jsonInputRef}
                                        type="file"
                                        accept=".json"
                                        className="hidden"
                                        onChange={(e) => handleJsonInputChange(e.target.files)}
                                    />
                                </div>

                                {/* Chat URL */}
                                <button
                                    onClick={() => setShowUrlModal(true)}
                                    disabled={processingDisabled}
                                    className="bg-gray-900 border-2 border-gray-800 hover:border-gray-700 rounded-xl p-6 text-left transition-all disabled:cursor-not-allowed"
                                >
                                    <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-4">
                                        <LinkIcon className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <h3 className="font-semibold mb-1">Chat URL</h3>
                                    <p className="text-sm text-gray-400">Import single conversation URL</p>
                                </button>

                                {/* Document */}
                                <label className="bg-gray-900 border-2 border-gray-800 hover:border-gray-700 rounded-xl p-6 cursor-pointer transition-all">
                                    <input
                                        type="file"
                                        multiple
                                        onChange={(e) => handleFileUpload(e.target.files)}
                                        className="hidden"
                                        accept=".pdf,.txt,.csv,.doc,.docx"
                                        disabled={processingDisabled}
                                    />
                                    <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-4">
                                        <FileTextIcon className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <h3 className="font-semibold mb-1">Document</h3>
                                    <p className="text-sm text-gray-400">PDF, TXT, CSV</p>
                                </label>

                                {/* Paste Text */}
                                <button
                                    onClick={() => setShowTextModal(true)}
                                    disabled={processingDisabled}
                                    className="bg-gray-900 border-2 border-gray-800 hover:border-gray-700 rounded-xl p-6 text-left transition-all disabled:cursor-not-allowed"
                                >
                                    <div className="w-12 h-12 bg-gray-800 rounded-lg flex items-center justify-center mb-4">
                                        <FileText className="w-6 h-6 text-gray-400" />
                                    </div>
                                    <h3 className="font-semibold mb-1">Paste Text</h3>
                                    <p className="text-sm text-gray-400">Direct text input</p>
                                </button>
                            </div>
                        </div>
                    )}
                </div>

                {/* RIGHT SIDEBAR - Pack Actions (Always show when pack selected) */}
                {selectedPack && (
                    <div className="w-80 bg-gray-900 border-l border-gray-800 p-4 space-y-4">
                        <div>
                            <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-4">Pack Actions</h3>
                        </div>

                        {/* Only show download cards when pack has completed sources */}
                        {packSources.some(s => s.status === 'completed') && (
                            <div className="space-y-4">
                                {/* Pack Downloads Card */}
                                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-purple-900/90 to-purple-900/90 rounded-xl flex items-center justify-center shadow-lg">
                                            <FolderOpen className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-base font-medium text-white">Pack Downloads</h3>
                                            <p className="text-sm text-gray-400">{selectedPack.pack_name}</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={handleDownloadPack}
                                        className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span className="text-sm">Download Pack</span>
                                    </button>
                                </div>

                                {/* Memory Tree Card */}
                                <div className="bg-gray-800/50 border border-gray-700/50 rounded-xl p-6">
                                    <div className="flex items-center gap-4 mb-4">
                                        <div className="w-12 h-12 bg-gradient-to-br from-emerald-500 to-emerald-600 rounded-xl flex items-center justify-center shadow-lg">
                                            <Network className="h-6 w-6 text-white" />
                                        </div>
                                        <div className="flex-1">
                                            <h3 className="text-base font-medium text-white">Memory Tree</h3>
                                            <p className="text-sm text-gray-400">View and export</p>
                                        </div>
                                    </div>

                                    <button
                                        onClick={async () => {
                                            if (!selectedPack) return;
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
                                                }
                                            } catch (error) {
                                                console.error('[Download] Tree download error:', error);
                                            }
                                        }}
                                        className="w-full px-4 py-3 bg-gray-700 hover:bg-gray-600 text-white rounded-lg transition-all duration-300 flex items-center justify-center gap-2 mb-2"
                                    >
                                        <Download className="h-4 w-4" />
                                        <span className="text-sm">Download Tree JSON</span>
                                    </button>

                                    {/* View Memory Tree Button - Shows progress when building */}
                                    <button
                                        onClick={() => {
                                            const isBuildingTree = packSources.some(s => s.status === 'building_tree');
                                            const hasTree = packSources.some(s =>
                                                s.status === 'completed' ||
                                                s.status?.includes('complete') ||
                                                s.status?.includes('built') ||
                                                (typeof s.progress === 'number' && s.progress >= 100)
                                            );

                                            if (!isBuildingTree && hasTree) {
                                                router.push(`/tree/${selectedPack.pack_id}`);
                                            }
                                        }}
                                        disabled={(() => {
                                            const isBuildingTree = packSources.some(s => s.status === 'building_tree');
                                            const hasTree = packSources.some(s =>
                                                s.status === 'completed' ||
                                                s.status?.includes('complete') ||
                                                s.status?.includes('built') ||
                                                (typeof s.progress === 'number' && s.progress >= 100)
                                            );
                                            return isBuildingTree || !hasTree;
                                        })()}
                                        className={`w-full px-5 py-4 ${(() => {
                                            const isBuildingTree = packSources.some(s => s.status === 'building_tree');
                                            const hasTree = packSources.some(s =>
                                                s.status === 'completed' ||
                                                s.status?.includes('complete') ||
                                                s.status?.includes('built') ||
                                                (typeof s.progress === 'number' && s.progress >= 100)
                                            );
                                            if (isBuildingTree) return 'bg-gray-700/50 cursor-wait';
                                            if (!hasTree) return 'bg-gray-700/50 cursor-not-allowed';
                                            return 'bg-emerald-700/60 hover:bg-emerald-600/60';
                                        })()}
                                        text-white rounded-lg transition-all duration-300 flex flex-col items-start gap-3`}
                                    >
                                        {(() => {
                                            const buildingSource = packSources.find(s => s.status === 'building_tree');
                                            if (buildingSource) {
                                                const processedChunks = buildingSource.processed_chunks || 0;
                                                const totalChunks = buildingSource.total_chunks || 0;
                                                const progressPercent = totalChunks > 0 ? Math.round((processedChunks / totalChunks) * 100) : 0;

                                                return (
                                                    <>
                                                        <div className="flex items-center gap-2.5 w-full">
                                                            <Network className="h-5 w-5 text-emerald-400 animate-pulse flex-shrink-0" />
                                                            <span className="text-sm text-gray-200">
                                                                {buildingSource.error_message || 'Building Memory Tree...'}
                                                            </span>
                                                        </div>
                                                        {totalChunks > 0 && (
                                                            <div className="w-full space-y-2">
                                                                <div className="w-full bg-gray-600/50 rounded-full h-2 overflow-hidden">
                                                                    <div
                                                                        className="bg-gradient-to-r from-emerald-500 to-emerald-400 h-2 rounded-full transition-all duration-500 ease-out"
                                                                        style={{ width: `${progressPercent}%` }}
                                                                    />
                                                                </div>
                                                                <div className="flex justify-between items-center">
                                                                    <span className="text-xs font-medium text-emerald-400">
                                                                        {progressPercent}%
                                                                    </span>
                                                                </div>
                                                            </div>
                                                        )}
                                                    </>
                                                );
                                            }

                                            const hasTree = packSources.some(s =>
                                                s.status === 'completed' ||
                                                s.status?.includes('complete') ||
                                                s.status?.includes('built') ||
                                                (typeof s.progress === 'number' && s.progress >= 100)
                                            );

                                            return (
                                                <div className="flex items-center gap-2.5 w-full justify-center">
                                                    <Network className="h-5 w-5" />
                                                    <span>{hasTree ? 'View Memory Tree' : 'Preparing tree...'}</span>
                                                </div>
                                            );
                                        })()}
                                    </button>
                                </div>
                            </div>
                        )}
                    </div>
                )}

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
                                    <FileText className="w-8 h-8 text-gray-400" />
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

                {/* Analysis Started Modal - Minimal & Clean */}
                {modalState.type === 'analysis_started' && (
                    <div className="fixed inset-0 bg-black/70 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 border border-gray-800 rounded-2xl p-8 max-w-md w-full">
                            <div className="space-y-6">
                                {/* Icon & Title */}
                                <div className="text-center space-y-4">
                                    <div className="inline-flex items-center justify-center w-12 h-12 bg-blue-500/10 rounded-full">
                                        <svg className="w-6 h-6 text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
                                        </svg>
                                    </div>
                                    <div>
                                        <h3 className="text-xl font-semibold text-white">Analysis Started</h3>
                                        <p className="text-sm text-gray-400 mt-2">
                                            Est. completion: {modalState.timeEstimate}
                                        </p>
                                    </div>
                                </div>

                                {/* Simple Message */}
                                <div className="bg-gray-800/30 rounded-lg p-4 space-y-2">
                                    <p className="text-sm text-gray-300">
                                        You can close this page. We'll email you when it's done.
                                    </p>
                                    <p className="text-xs text-gray-500">
                                        Or refresh to check progress.
                                    </p>
                                </div>

                                {/* Button */}
                                <button
                                    onClick={closeModal}
                                    className="w-full bg-blue-600 hover:bg-blue-700 text-white px-6 py-3 rounded-lg font-medium transition-colors"
                                >
                                    Got it
                                </button>
                            </div>
                        </div>
                    </div>
                )}

                {/* Upload notification toast */}
                {uploadNotification && (
                    <div className="fixed bottom-6 right-6 bg-blue-600 text-white px-6 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3">
                        <Loader className="h-4 w-4 animate-spin" />
                        <span className="text-sm font-medium">{uploadNotification}</span>
                    </div>
                )}

                {/* We rely on the inline progress card instead of separate analyzing/building overlays to avoid duplicate modals. */}
            </div>
        </>
    );
}
