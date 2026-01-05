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
        handleSourceReady,
        startAnalysis,
        updateFromSourceStatus,
        closeModal,
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
    const shouldPoll = !!selectedPack;
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

                    // Check if source is ready for analysis
                    if (source.status === 'ready_for_analysis' && modalState.type === 'hidden') {
                        console.log('[ProcessV2] Source ready for analysis, showing credit modal');
                        handleSourceReady(source.source_id);
                    }
                });

                const totalTime = Date.now() - startTime;
                console.log(`[ProcessV2] ✅ [${pollId}] Poll completed in ${totalTime}ms`);
            } else {
                console.error(`[ProcessV2] ❌ [${pollId}] Poll failed with status:`, response.status);
            }
        } catch (error: any) {
            const errorTime = Date.now() - startTime;
            console.error(`[ProcessV2] ❌ [${pollId}] Polling error after ${errorTime}ms:`, error);
            console.error(`[ProcessV2] ❌ [${pollId}] Error name:`, error.name);
            console.error(`[ProcessV2] ❌ [${pollId}] Error message:`, error.message);
            // Don't throw - let polling continue even if one request fails
        }
    }, [selectedPack, makeAuthenticatedRequest, setPackSources, updateFromSourceStatus, modalState.type, handleSourceReady]);

    usePolling({
        enabled: !!shouldPoll,
        interval: pollInterval,
        onPoll: pollPackDetails,
    });

    console.log('[ProcessV2] Polling status:', { shouldPoll, pollInterval, hasSelectedPack: !!selectedPack });

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
            alert('Sign in is required before creating a pack. Please log in and try again.');
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
                const response = await makeAuthenticatedRequest(
                    `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/sources`,
                    {
                        method: 'POST',
                        body: formData,
                    }
                );

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
                setUploadNotification(`Upload error: ${file.name}`);
                setTimeout(() => setUploadNotification(null), 4000);
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

    // Handle analysis confirmation
    const handleConfirmAnalysis = async (sourceId: string, maxChunks?: number) => {
        try {
            await startAnalysis(sourceId, maxChunks);
            console.log('Analysis started for:', sourceId);
        } catch (error) {
            console.error('Failed to start analysis:', error);
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
            const response = await makeAuthenticatedRequest(
                `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/download`
            );

            if (response.ok) {
                const blob = await response.blob();
                const url = window.URL.createObjectURL(blob);
                const a = document.createElement('a');
                a.href = url;
                a.download = `${selectedPack.pack_name}_pack.zip`;
                document.body.appendChild(a);
                a.click();
                document.body.removeChild(a);
                window.URL.revokeObjectURL(url);
            }
        } catch (error) {
            console.error('Download error:', error);
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
                    {!selectedPack ? (
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
                                <div className="bg-gray-800 border border-gray-700 rounded-xl p-6">
                                    <div className="flex items-center justify-between">
                                        <div className="flex items-center space-x-4">
                                            <div className="w-10 h-10 bg-purple-600/20 rounded-lg flex items-center justify-center">
                                                {packSources.some(s => s.status === 'ready_for_analysis') ? (
                                                    <span className="text-2xl">✓</span>
                                                ) : packSources.some(s => s.status === 'building_tree' || s.status?.toLowerCase().includes('build')) ? (
                                                    <Network className="h-5 w-5 text-emerald-400" />
                                                ) : (
                                                    <Loader className="h-5 w-5 text-purple-400 animate-spin" />
                                                )}
                                            </div>
                                            <div>
                                                <h3 className="text-base font-medium text-white">
                                                    {packSources.some(s => s.status === 'ready_for_analysis') ? 'Ready for Analysis' :
                                                        packSources.some(s => s.status === 'building_tree') ? 'Building Memory Tree' :
                                                            packSources.some(s => s.status === 'extracting') ? 'Extracting Content' : 'Analyzing'}
                                                </h3>
                                                <p className="text-sm text-gray-400">
                                                    {(() => {
                                                        if (packSources.some(s => s.status === 'ready_for_analysis')) {
                                                            return 'Waiting for you to start analysis...';
                                                        }
                                                        if (packSources.some(s => s.status === 'building_tree')) {
                                                            return 'Organizing knowledge into structured memory...';
                                                        }
                                                        const activeSource = packSources.find(s =>
                                                            ['extracting', 'analyzing', 'processing', 'analyzing_chunks'].includes(s.status)
                                                        );
                                                        if (activeSource?.status === 'extracting') {
                                                            return 'Extracting content and creating semantic chunks...';
                                                        }
                                                        return "We're processing your content.";
                                                    })()}
                                                </p>
                                            </div>
                                        </div>
                                        <button
                                            onClick={() => router.push('/packs')}
                                            className="text-sm text-gray-300 hover:text-white px-3 py-1.5 border border-gray-600 rounded-lg hover:bg-gray-700 transition-colors"
                                        >
                                            Cancel
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

                                            // During tree building, show total chunks (analysis is complete)
                                            // During analysis, use actual processed count
                                            const processed = isBuildingTree ? total : (analyzingSource.processed_chunks || 0);

                                            const backendPercent = typeof analyzingSource.progress === 'number' ? Math.round(analyzingSource.progress) : null;
                                            // Always prefer backend progress percentage
                                            const percent = backendPercent ?? (total > 0 ? Math.round((processed / total) * 100) : 0);

                                            const processedDisplay = isBuildingTree && total > 0 ? total : processed;
                                            const chunksLabel = total > 0
                                                ? `${processedDisplay} of ${total} chunks`
                                                : (isBuildingTree ? 'Building tree…' : 'Processing chunks');

                                            const isLargeJob = total >= 10;

                                            return (
                                                <div className="mt-4 space-y-2">
                                                    <div className="flex justify-between text-sm">
                                                        <span className="text-gray-400">{chunksLabel}</span>
                                                        <span className="text-purple-400 font-medium">{percent}%</span>
                                                    </div>
                                                    <div className="w-full bg-gray-700/50 rounded-full h-2 overflow-hidden">
                                                        <div
                                                            className="bg-gradient-to-r from-purple-500 to-purple-400 h-full transition-all duration-500"
                                                            style={{ width: `${percent}%` }}
                                                        />
                                                    </div>
                                                    {isLargeJob && (
                                                        <p className="text-xs text-gray-400">
                                                            This is a large pack. You can close this page—we'll email you when it's done. If progress appears stuck, try refreshing the page.
                                                        </p>
                                                    )}
                                                </div>
                                            );
                                        }
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
                                            const response = await makeAuthenticatedRequest(
                                                `${API_BASE_URL}/api/v2/packs/${selectedPack.pack_id}/tree.json`
                                            );
                                            if (response.ok) {
                                                const blob = await response.blob();
                                                const url = window.URL.createObjectURL(blob);
                                                const a = document.createElement('a');
                                                a.href = url;
                                                a.download = `${selectedPack.pack_name}_tree.json`;
                                                document.body.appendChild(a);
                                                a.click();
                                                document.body.removeChild(a);
                                                window.URL.revokeObjectURL(url);
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
                                                                    <span className="text-xs text-gray-400">
                                                                        {processedChunks} of {totalChunks} chunks
                                                                    </span>
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

                {/* Credit Check Modal */}
                {modalState.type === 'credit_check' && (
                    <div className="fixed inset-0 bg-black/80 flex items-center justify-center z-50 p-4">
                        <div className="bg-gray-900 border border-gray-800 rounded-xl p-6 max-w-md w-full">
                            <h3 className="text-xl font-bold mb-4">Confirm Analysis</h3>
                            <div className="space-y-3 text-sm mb-6">
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Chunks to analyze:</span>
                                    <span className="font-medium">{modalState.totalChunks}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Credits required:</span>
                                    <span className="font-medium">{modalState.creditsRequired}</span>
                                </div>
                                <div className="flex justify-between">
                                    <span className="text-gray-400">Your credits:</span>
                                    <span className={modalState.canProceed ? 'text-green-500' : 'text-red-500'}>
                                        {modalState.hasUnlimited ? '∞ (Unlimited)' : modalState.userCredits}
                                    </span>
                                </div>
                            </div>

                            {modalState.canProceed ? (
                                <div className="flex gap-3">
                                    <button
                                        onClick={() => handleConfirmAnalysis(modalState.sourceId)}
                                        className="flex-1 bg-blue-600 hover:bg-blue-700 px-4 py-2 rounded-lg font-medium transition-colors"
                                    >
                                        Start Analysis
                                    </button>
                                    <button
                                        onClick={closeModal}
                                        className="px-4 py-2 bg-gray-800 hover:bg-gray-700 rounded-lg transition-colors"
                                    >
                                        Cancel
                                    </button>
                                </div>
                            ) : (
                                <div className="text-center space-y-3">
                                    <p className="text-red-500">Insufficient credits</p>
                                    <p className="text-sm text-gray-400">
                                        You need {modalState.creditsNeeded || Math.max(modalState.creditsRequired - modalState.userCredits, 1)} more credit{(modalState.creditsNeeded || Math.max(modalState.creditsRequired - modalState.userCredits, 1)) !== 1 ? 's' : ''} to analyze all chunks.
                                    </p>
                                    <div className="flex gap-3">
                                        <button
                                            onClick={() => router.push('/pricing')}
                                            className="flex-1 bg-blue-600 hover:bg-blue-700 px-6 py-2 rounded-lg font-medium transition-colors"
                                        >
                                            Get More Credits
                                        </button>
                                        <button
                                            onClick={closeModal}
                                            className="flex-1 bg-gray-800 hover:bg-gray-700 px-6 py-2 rounded-lg font-medium transition-colors"
                                        >
                                            Cancel
                                        </button>
                                    </div>
                                </div>
                            )}
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
