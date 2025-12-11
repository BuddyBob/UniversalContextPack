'use client';

import React from 'react';
import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
    ArrowLeft, Search, FileText, AlertTriangle, Target,
    User, Star, Folder, Zap, ArrowUpDown, Pin, Edit2, Save, X, Trash2, Plus
} from 'lucide-react';
import { useAuth } from '@/components/AuthProvider';

interface TreeNode {
    id: string;
    label: string;
    node_type: string;
    scope: string;
    data: any;
    created_at: string;
    updated_at: string;
    evidence_count: number;
}

interface TreeData {
    pack_id: string;
    pack_name: string;
    scopes: Record<string, Record<string, TreeNode[]>>;
    total_nodes: number;
    tree_available: boolean;
}

interface Evidence {
    id: string;
    source_id: string;
    source_name: string | null;
    chunk_index: number;
    snippet: string;
    created_at: string;
}

const API_URL = process.env.NEXT_PUBLIC_BACKEND_URL || process.env.NEXT_PUBLIC_API_URL || 'http://localhost:8000';

// Icon mapping for node types
const nodeIcons: Record<string, any> = {
    Constraint: AlertTriangle,
    Fact: FileText,
    Goal: Target,
    Identity: User,
    Preference: Star,
    Project: Folder,
    Skill: Zap
};

const nodeColors: Record<string, string> = {
    Constraint: 'text-yellow-400',
    Fact: 'text-blue-400',
    Goal: 'text-green-400',
    Identity: 'text-purple-400',
    Preference: 'text-pink-400',
    Project: 'text-orange-400',
    Skill: 'text-cyan-400'
};

export default function TreeViewerPage() {
    const params = useParams();
    const router = useRouter();
    const packId = params.packId as string;
    const { user, makeAuthenticatedRequest } = useAuth();

    const [treeData, setTreeData] = useState<TreeData | null>(null);
    const [selectedNode, setSelectedNode] = useState<TreeNode | null>(null);
    const [selectedEvidence, setSelectedEvidence] = useState<Evidence[]>([]);
    const [searchTerm, setSearchTerm] = useState('');
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState<string | null>(null);

    // Filter state
    const [selectedTypes, setSelectedTypes] = useState<Set<string>>(new Set());
    const [sortBy, setSortBy] = useState<{ field: string; order: 'asc' | 'desc' }>({
        field: 'updated_at',
        order: 'desc'
    });

    // Editing state
    const [isEditing, setIsEditing] = useState(false);
    const [editedLabel, setEditedLabel] = useState('');
    const [editedData, setEditedData] = useState<any>({});
    const [isSaving, setIsSaving] = useState(false);

    // Create node modal state
    const [showCreateModal, setShowCreateModal] = useState(false);
    const [newNodeType, setNewNodeType] = useState('Fact');
    const [newNodeLabel, setNewNodeLabel] = useState('');
    const [newNodeScope, setNewNodeScope] = useState('user_profile');
    const [newNodeData, setNewNodeData] = useState('');
    const [isCreating, setIsCreating] = useState(false);

    // Multi-select deletion state
    const [selectedNodeIds, setSelectedNodeIds] = useState<Set<string>>(new Set());
    const [lastSelectedIndex, setLastSelectedIndex] = useState<number | null>(null);
    const [isSelectMode, setIsSelectMode] = useState(false);

    // Flatten nodes from tree structure
    const allNodes = useMemo(() => {
        if (!treeData) return [];
        const nodes: TreeNode[] = [];
        Object.entries(treeData.scopes).forEach(([scope, types]) => {
            Object.entries(types).forEach(([type, typeNodes]) => {
                typeNodes.forEach(node => {
                    nodes.push({ ...node, scope });
                });
            });
        });
        return nodes;
    }, [treeData]);

    // Get unique types with counts
    const nodeTypes = useMemo(() => {
        const typeCounts: Record<string, number> = {};
        allNodes.forEach(node => {
            typeCounts[node.node_type] = (typeCounts[node.node_type] || 0) + 1;
        });
        return Object.entries(typeCounts).map(([type, count]) => ({ type, count }));
    }, [allNodes]);

    // Filtered and sorted nodes
    const filteredNodes = useMemo(() => {
        let filtered = allNodes;

        // Apply type filter
        if (selectedTypes.size > 0) {
            filtered = filtered.filter(node => selectedTypes.has(node.node_type));
        }

        // Apply search
        if (searchTerm) {
            const term = searchTerm.toLowerCase();
            filtered = filtered.filter(node =>
                node.label?.toLowerCase().includes(term) ||
                node.node_type.toLowerCase().includes(term) ||
                JSON.stringify(node.data).toLowerCase().includes(term)
            );
        }

        // Apply sorting
        filtered.sort((a, b) => {
            let aVal, bVal;
            switch (sortBy.field) {
                case 'label':
                    aVal = a.label || '';
                    bVal = b.label || '';
                    break;
                case 'type':
                    aVal = a.node_type;
                    bVal = b.node_type;
                    break;
                case 'evidence':
                    aVal = a.evidence_count;
                    bVal = b.evidence_count;
                    break;
                case 'created_at':
                    aVal = new Date(a.created_at).getTime();
                    bVal = new Date(b.created_at).getTime();
                    break;
                case 'updated_at':
                default:
                    aVal = new Date(a.updated_at).getTime();
                    bVal = new Date(b.updated_at).getTime();
            }

            if (aVal < bVal) return sortBy.order === 'asc' ? -1 : 1;
            if (aVal > bVal) return sortBy.order === 'asc' ? 1 : -1;
            return 0;
        });

        return filtered;
    }, [allNodes, selectedTypes, searchTerm, sortBy]);

    // Fetch tree data
    useEffect(() => {
        const fetchTreeData = async () => {
            if (!user) return;

            try {
                const response = await makeAuthenticatedRequest(
                    `${API_URL}/api/v2/packs/${packId}/tree/nodes`,
                    { method: 'GET' }
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch tree data');
                }

                const data = await response.json();
                setTreeData(data);
                setLoading(false);
            } catch (err) {
                console.error('Error fetching tree data:', err);
                setError(err instanceof Error ? err.message : 'Failed to load tree');
                setLoading(false);
            }
        };

        fetchTreeData();
    }, [packId, user, makeAuthenticatedRequest]);

    // Fetch evidence when node selected
    useEffect(() => {
        const fetchEvidence = async () => {
            if (!selectedNode || !user) return;

            try {
                const response = await makeAuthenticatedRequest(
                    `${API_URL}/api/v2/nodes/${selectedNode.id}/evidence`,
                    { method: 'GET' }
                );

                if (!response.ok) {
                    throw new Error('Failed to fetch evidence');
                }

                const data = await response.json();
                setSelectedEvidence(data.evidence || []);
            } catch (err) {
                console.error('Error fetching evidence:', err);
                setSelectedEvidence([]);
            }
        };

        fetchEvidence();
    }, [selectedNode, user, makeAuthenticatedRequest]);

    const toggleSort = (field: string) => {
        setSortBy(prev => ({
            field,
            order: prev.field === field && prev.order === 'asc' ? 'desc' : 'asc'
        }));
    };

    const toggleTypeFilter = (type: string) => {
        setSelectedTypes(prev => {
            const newSet = new Set(prev);
            if (newSet.has(type)) {
                newSet.delete(type);
            } else {
                newSet.add(type);
            }
            return newSet;
        });
    };

    const startEditing = () => {
        if (selectedNode) {
            setEditedLabel(selectedNode.label || '');
            setEditedData(selectedNode.data || {});
            setIsEditing(true);
        }
    };

    const cancelEditing = () => {
        setIsEditing(false);
        setEditedLabel('');
        setEditedData({});
    };

    const saveChanges = async () => {
        if (!selectedNode || !user) return;

        setIsSaving(true);
        try {
            const response = await makeAuthenticatedRequest(
                `${API_URL}/api/v2/nodes/${selectedNode.id}`,
                {
                    method: 'PATCH',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        label: editedLabel,
                        data: editedData
                    })
                }
            );

            if (!response.ok) {
                throw new Error('Failed to save changes');
            }

            const result = await response.json();

            // Update local state
            setSelectedNode(result.node);
            setTreeData(prev => {
                if (!prev) return prev;
                const updated = { ...prev };
                // Update node in tree structure
                Object.keys(updated.scopes).forEach(scope => {
                    Object.keys(updated.scopes[scope]).forEach(type => {
                        updated.scopes[scope][type] = updated.scopes[scope][type].map(n =>
                            n.id === selectedNode.id ? result.node : n
                        );
                    });
                });
                return updated;
            });

            setIsEditing(false);
        } catch (err) {
            console.error('Error saving changes:', err);
            alert('Failed to save changes');
        } finally {
            setIsSaving(false);
        }
    };

    const createNode = async () => {
        if (!user || !newNodeLabel.trim()) return;

        setIsCreating(true);
        try {
            // Parse data field if provided
            let parsedData = {};
            if (newNodeData.trim()) {
                try {
                    parsedData = JSON.parse(newNodeData);
                } catch {
                    // If not valid JSON, treat as plain text
                    parsedData = { text: newNodeData.trim() };
                }
            }

            const response = await makeAuthenticatedRequest(
                `${API_URL}/api/v2/packs/${packId}/tree/nodes`,
                {
                    method: 'POST',
                    headers: { 'Content-Type': 'application/json' },
                    body: JSON.stringify({
                        node_type: newNodeType,
                        label: newNodeLabel.trim(),
                        scope: newNodeScope,
                        data: parsedData
                    })
                }
            );

            if (!response.ok) {
                throw new Error('Failed to create node');
            }

            const result = await response.json();
            const createdNode = result.node;

            // Refresh tree data from server to avoid duplicates
            const treeResponse = await makeAuthenticatedRequest(
                `${API_URL}/api/v2/packs/${packId}/tree/nodes`
            );

            if (treeResponse.ok) {
                const freshTreeData = await treeResponse.json();
                setTreeData(freshTreeData);
            }

            // Select the newly created node
            setSelectedNode(createdNode);

            // Reset form and close modal
            setNewNodeLabel('');
            setNewNodeType('Fact');
            setNewNodeScope('user_profile');
            setNewNodeData('');
            setShowCreateModal(false);
        } catch (err) {
            console.error('Error creating node:', err);
            alert('Failed to create node');
        } finally {
            setIsCreating(false);
        }
    };


    const deleteNode = async (nodeIds?: string[]) => {
        if (!user) return;

        // Use provided nodeIds or selected node
        const idsToDelete = nodeIds || (selectedNode ? [selectedNode.id] : []);
        if (idsToDelete.length === 0) return;

        try {
            // Delete all nodes
            await Promise.all(
                idsToDelete.map(id =>
                    makeAuthenticatedRequest(
                        `${API_URL}/api/v2/nodes/${id}`,
                        { method: 'DELETE' }
                    )
                )
            );

            // Update local state - remove nodes from tree
            setTreeData(prev => {
                if (!prev) return prev;
                const updated = { ...prev };
                Object.keys(updated.scopes).forEach(scope => {
                    Object.keys(updated.scopes[scope]).forEach(type => {
                        updated.scopes[scope][type] = updated.scopes[scope][type].filter(
                            n => !idsToDelete.includes(n.id)
                        );
                    });
                });
                updated.total_nodes = updated.total_nodes - idsToDelete.length;
                return updated;
            });

            // Clear selection if deleted node was selected
            if (selectedNode && idsToDelete.includes(selectedNode.id)) {
                setSelectedNode(null);
            }

            // Clear multi-select
            setSelectedNodeIds(new Set());
        } catch (err) {
            console.error('Error deleting nodes:', err);
            alert('Failed to delete node');
        }
    };

    const formatScopeName = (scope: string) => {
        return scope.split('_').map(word =>
            word.charAt(0).toUpperCase() + word.slice(1)
        ).join(' ');
    };

    const getNodeIcon = (type: string) => {
        const Icon = nodeIcons[type] || FileText;
        return Icon;
    };

    if (loading) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-white mx-auto mb-4"></div>
                    <p className="text-gray-400">Loading tree data...</p>
                </div>
            </div>
        );
    }

    if (error || !treeData) {
        return (
            <div className="min-h-screen bg-black text-white flex items-center justify-center">
                <div className="text-center">
                    <p className="text-red-400 mb-4">{error || 'Failed to load tree data'}</p>
                    <button
                        onClick={() => router.push(`/process?packId=${packId}`)}
                        className="px-4 py-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
                    >
                        Back to Pack
                    </button>
                </div>
            </div>
        );
    }
    return (
        <div className="min-h-screen bg-black text-white flex flex-col">
            {/* Header */}
            <div className="border-b border-white/10 bg-black/50 backdrop-blur-sm">
                <div className="px-6 py-4">
                    <div className="flex items-center justify-between gap-6">
                        {/* Left: Back button */}
                        <button
                            onClick={() => router.push('/packs')}
                            className="flex items-center gap-2 text-gray-400 hover:text-white transition-colors"
                        >
                            <ArrowLeft className="w-5 h-5" />
                        </button>

                        {/* Center: Pack info */}
                        <div className="flex-1 min-w-0">
                            <div className="flex items-center gap-4">
                                <div className="flex-1 min-w-0">
                                    <h1 className="text-2xl font-bold truncate">
                                        {treeData?.pack_name || 'Unknown Pack'}
                                    </h1>
                                    <p className="text-sm text-gray-400">
                                        {treeData.total_nodes} nodes · {Object.keys(treeData.scopes).length} {Object.keys(treeData.scopes).length === 1 ? 'scope' : 'scopes'}
                                    </p>
                                </div>
                            </div>
                        </div>

                        {/* Right: Action buttons */}
                        <div className="flex items-center gap-3">
                            {/* Select Mode Toggle */}
                            <button
                                onClick={() => {
                                    setIsSelectMode(!isSelectMode);
                                    if (isSelectMode) {
                                        setSelectedNodeIds(new Set());
                                        setLastSelectedIndex(null);
                                    }
                                }}
                                className={`text-sm px-3 py-1.5 rounded ${isSelectMode ? 'text-emerald-400 bg-emerald-500/10' : 'text-gray-400 hover:text-gray-300 hover:bg-white/5'} transition-colors`}
                            >
                                {isSelectMode ? 'Cancel Selection' : 'Select'}
                            </button>

                            {/* Delete button (only in select mode with selections) */}
                            {selectedNodeIds.size > 0 && isSelectMode && (
                                <button
                                    onClick={() => deleteNode(Array.from(selectedNodeIds))}
                                    className="px-4 py-2 bg-red-500/80 hover:bg-red-500 text-white rounded-lg transition-colors flex items-center gap-2"
                                >
                                    <Trash2 className="w-4 h-4" />
                                    Delete {selectedNodeIds.size}
                                </button>
                            )}

                            {/* Create Node button */}
                            <button
                                onClick={() => setShowCreateModal(true)}
                                className="px-4 py-2 bg-emerald-700/60 hover:bg-emerald-600/60 text-white rounded-lg transition-colors flex items-center gap-2"
                            >
                                <Plus className="w-4 h-4" />
                                Create Node
                            </button>
                        </div>
                    </div>

                    {/* Search Bar */}
                    <div className="mt-4 relative max-w-2xl">
                        <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
                        <input
                            type="text"
                            placeholder="Search nodes by label, type, or content…"
                            value={searchTerm}
                            onChange={(e) => setSearchTerm(e.target.value)}
                            className="w-full pl-10 pr-4 py-2 bg-white/5 border border-white/10 rounded-lg focus:outline-none focus:ring-2 focus:ring-white/20 transition-all"
                        />
                        {searchTerm && (
                            <span className="absolute right-3 top-1/2 transform -translate-y-1/2 text-xs text-gray-500">
                                {filteredNodes.length} results
                            </span>
                        )}
                    </div>
                </div>
            </div>

            {/* Three Column Layout */}
            <div className="flex-1 flex overflow-hidden">
                <div className="max-w-[1800px] w-full mx-auto flex">
                    {/* Left: Filters Sidebar */}
                    <div className="w-64 border-r border-white/10 bg-black/20 p-4 overflow-y-auto">
                        <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Filters</h3>

                        {/* Node Type Filter */}
                        <div className="mb-6">
                            <h4 className="text-sm font-medium mb-2">Node Type</h4>
                            <div className="space-y-1.5">
                                {nodeTypes.map(({ type, count }) => {
                                    const Icon = getNodeIcon(type);
                                    const color = nodeColors[type] || 'text-gray-400';
                                    return (
                                        <label key={type} className="flex items-center gap-2 p-2 hover:bg-white/5 rounded cursor-pointer transition-colors group/checkbox">
                                            <div className="relative flex items-center">
                                                <input
                                                    type="checkbox"
                                                    checked={selectedTypes.has(type)}
                                                    onChange={() => toggleTypeFilter(type)}
                                                    className="peer sr-only"
                                                />
                                                <div className="w-4 h-4 border-2 border-white/30 rounded bg-white/5 peer-checked:bg-blue-500 peer-checked:border-blue-500 transition-all flex items-center justify-center">
                                                    {selectedTypes.has(type) && (
                                                        <svg className="w-3 h-3 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                                                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={3} d="M5 13l4 4L19 7" />
                                                        </svg>
                                                    )}
                                                </div>
                                            </div>
                                            <Icon className={`w-4 h-4 ${color}`} />
                                            <span className="text-sm flex-1 truncate">{type}</span>
                                            <span className="text-xs text-gray-500">{count}</span>
                                        </label>
                                    );
                                })}
                            </div>
                        </div>

                        {/* Clear Filters */}
                        {selectedTypes.size > 0 && (
                            <button
                                onClick={() => setSelectedTypes(new Set())}
                                className="w-full px-3 py-1.5 text-xs bg-white/5 hover:bg-white/10 rounded transition-colors"
                            >
                                Clear filters
                            </button>
                        )}
                    </div>

                    {/* Center: Node Table */}
                    <div className="flex-1 flex flex-col overflow-hidden">
                        {/* Table Header */}
                        <div className="border-b border-white/10 bg-black/20 px-4 py-2 flex items-center gap-4 text-xs font-medium text-gray-400">
                            <button
                                onClick={() => toggleSort('label')}
                                className="flex items-center gap-1 hover:text-white transition-colors flex-1"
                            >
                                Label
                                {sortBy.field === 'label' && <ArrowUpDown className="w-3 h-3" />}
                            </button>
                            <button
                                onClick={() => toggleSort('type')}
                                className="flex items-center gap-1 hover:text-white transition-colors w-32"
                            >
                                Type
                                {sortBy.field === 'type' && <ArrowUpDown className="w-3 h-3" />}
                            </button>
                            <button
                                onClick={() => toggleSort('evidence')}
                                className="flex items-center gap-1 hover:text-white transition-colors w-20"
                            >
                                Evidence
                                {sortBy.field === 'evidence' && <ArrowUpDown className="w-3 h-3" />}
                            </button>
                            <button
                                onClick={() => toggleSort('updated_at')}
                                className="flex items-center gap-1 hover:text-white transition-colors w-32"
                            >
                                Updated
                                {sortBy.field === 'updated_at' && <ArrowUpDown className="w-3 h-3" />}
                            </button>
                        </div>

                        {/* Table Rows */}

                        <div className="flex-1 overflow-y-auto" >
                            {filteredNodes.length === 0 ? (
                                <div className="flex items-center justify-center h-full text-gray-500">
                                    <p>No nodes match your filters</p>
                                </div>
                            ) : (
                                filteredNodes.map((node) => {
                                    const Icon = getNodeIcon(node.node_type);
                                    const color = nodeColors[node.node_type] || 'text-gray-400';
                                    const isSelected = selectedNode?.id === node.id;

                                    return (
                                        <div
                                            key={node.id}
                                            onClick={(e) => {
                                                if (isSelectMode) {
                                                    // Selection mode - handle multi-select
                                                    const currentIndex = filteredNodes.findIndex(n => n.id === node.id);
                                                    const newSet = new Set(selectedNodeIds);

                                                    // Shift-click range selection
                                                    if (e.shiftKey && lastSelectedIndex !== null) {
                                                        const start = Math.min(lastSelectedIndex, currentIndex);
                                                        const end = Math.max(lastSelectedIndex, currentIndex);

                                                        for (let i = start; i <= end; i++) {
                                                            newSet.add(filteredNodes[i].id);
                                                        }
                                                    } else if (e.metaKey || e.ctrlKey) {
                                                        // Cmd/Ctrl-click to toggle individual selection
                                                        if (newSet.has(node.id)) {
                                                            newSet.delete(node.id);
                                                        } else {
                                                            newSet.add(node.id);
                                                        }
                                                    } else {
                                                        // Regular click - toggle selection
                                                        if (newSet.has(node.id)) {
                                                            newSet.delete(node.id);
                                                        } else {
                                                            newSet.add(node.id);
                                                        }
                                                    }

                                                    setSelectedNodeIds(newSet);
                                                    setLastSelectedIndex(currentIndex);
                                                } else {
                                                    // Normal mode - just select node for viewing
                                                    setSelectedNode(node);
                                                }
                                            }}
                                            className={`group w-full px-4 py-3 flex items-center gap-4 hover:bg-white/10 transition-all border-l-2 cursor-pointer ${isSelectMode && selectedNodeIds.has(node.id)
                                                ? 'border-emerald-500 bg-emerald-500/10'
                                                : isSelected
                                                    ? 'border-white bg-white/10'
                                                    : 'border-transparent'
                                                }`}
                                        >
                                            <div className="flex-1 flex items-center gap-3">
                                                <div className={`p-1.5 rounded ${nodeIcons[node.node_type]?.color || 'bg-gray-500/20'}`}>
                                                    {React.createElement(nodeIcons[node.node_type]?.icon || FileText, { className: 'w-4 h-4' })}
                                                </div>
                                                <div className="flex-1 min-w-0">
                                                    <div className="font-medium truncate">{node.label || 'Untitled'}</div>
                                                    <div className="text-xs text-gray-400">{node.node_type}</div>
                                                </div>
                                            </div>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    deleteNode([node.id]);
                                                }}
                                                className="opacity-0 group-hover:opacity-100 p-1.5 bg-red-500/10 hover:bg-red-500/20 text-red-400 rounded transition-all"
                                                title="Delete node"
                                            >
                                                <Trash2 className="w-4 h-4" />
                                            </button>
                                        </div>
                                    );
                                })
                            )}
                        </div>
                    </div>

                    {/* Right: Node Detail Panel */}
                    <div className="w-96 border-l border-white/10 bg-black/20 overflow-y-auto">
                        {selectedNode ? (
                            <div className="flex flex-col h-full">
                                {/* Header */}
                                <div className="p-4 border-b border-white/10">
                                    {/* Node Type and Edit Button Row */}
                                    <div className="flex items-center justify-between mb-4">
                                        <div className="flex items-center gap-2">
                                            {(() => {
                                                const Icon = getNodeIcon(selectedNode.node_type);
                                                const color = nodeColors[selectedNode.node_type] || 'text-gray-400';
                                                return <Icon className={`w-4 h-4 ${color}`} />;
                                            })()}
                                            <span className="text-xs text-gray-400 uppercase tracking-wide font-medium">{selectedNode.node_type}</span>
                                        </div>
                                        {/* Edit Buttons */}
                                        <div className="flex items-center gap-1">
                                            {isEditing ? (
                                                <>
                                                    <button
                                                        onClick={saveChanges}
                                                        disabled={isSaving}
                                                        className="p-1.5 bg-green-500/20 hover:bg-green-500/30 text-green-400 rounded transition-colors disabled:opacity-50"
                                                        title="Save changes"
                                                    >
                                                        <Save className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={cancelEditing}
                                                        disabled={isSaving}
                                                        className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors disabled:opacity-50"
                                                        title="Cancel"
                                                    >
                                                        <X className="w-4 h-4" />
                                                    </button>
                                                </>
                                            ) : (
                                                <>
                                                    <button
                                                        onClick={startEditing}
                                                        className="p-1.5 bg-white/5 hover:bg-white/10 rounded transition-colors"
                                                        title="Edit node"
                                                    >
                                                        <Edit2 className="w-4 h-4" />
                                                    </button>
                                                    <button
                                                        onClick={() => selectedNode && deleteNode([selectedNode.id])}
                                                        className="p-1.5 bg-red-500/20 hover:bg-red-500/30 text-red-400 rounded transition-colors"
                                                        title="Delete node"
                                                    >
                                                        <Trash2 className="w-4 h-4" />
                                                    </button>
                                                </>
                                            )}
                                        </div>
                                    </div>

                                    {/* Node Label */}
                                    {isEditing ? (
                                        <input type="text" value={editedLabel} onChange={(e) => setEditedLabel(e.target.value)} className="w-full text-xl font-semibold bg-white/5 border border-white/20 rounded px-3 py-2 focus:outline-none focus:ring-2 focus:ring-white/30" placeholder="Node label" />
                                    ) : (
                                        <h3 className="text-xl font-semibold leading-tight cursor-pointer hover:text-gray-300 transition-colors break-words" title="Double-click to edit" onDoubleClick={startEditing}
                                        >
                                            {selectedNode.label || 'Untitled'}
                                        </h3>
                                    )}
                                </div>

                                {/* Content */}
                                <div className="flex-1 overflow-y-auto p-6 space-y-6">
                                    {/* Node Data */}
                                    {((isEditing && editedData) || (selectedNode.data && Object.keys(selectedNode.data).length > 0)) && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">Details</h4>
                                            <div className="space-y-3">
                                                {Object.entries(isEditing ? editedData : selectedNode.data).map(([key, value]) => (
                                                    <div key={key} className="border-l-2 border-white/10 pl-3">
                                                        <div className="text-xs text-gray-400 mb-1 capitalize">{key.replace(/_/g, ' ')}</div>
                                                        {isEditing ? (
                                                            <textarea
                                                                value={typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                                                                onChange={(e) => {
                                                                    const newData = { ...editedData };
                                                                    try {
                                                                        newData[key] = JSON.parse(e.target.value);
                                                                    } catch {
                                                                        newData[key] = e.target.value;
                                                                    }
                                                                    setEditedData(newData);
                                                                }}
                                                                className="w-full text-sm bg-white/5 border border-white/20 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/30 font-mono"
                                                                rows={3}
                                                            />
                                                        ) : (
                                                            <div className="text-sm text-white">
                                                                {typeof value === 'string' ? value : JSON.stringify(value, null, 2)}
                                                            </div>
                                                        )}
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}

                                    {/* Evidence */}
                                    {selectedEvidence.length > 0 && (
                                        <div>
                                            <h4 className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-3">
                                                Evidence ({selectedEvidence.length})
                                            </h4>
                                            <div className="space-y-3">
                                                {selectedEvidence.map((ev) => (
                                                    <div key={ev.id} className="bg-black/40 border border-white/5 rounded-lg p-4 hover:border-white/10 transition-colors">
                                                        <div className="flex items-start gap-2 mb-2">
                                                            <FileText className="w-4 h-4 text-gray-400 mt-0.5 flex-shrink-0" />
                                                            <div className="flex-1 min-w-0">
                                                                <div className="text-xs font-medium text-gray-300 truncate">
                                                                    {ev.source_name || 'Unknown Source'}
                                                                </div>
                                                                <div className="text-xs text-gray-500">
                                                                    Chunk {ev.chunk_index}
                                                                </div>
                                                            </div>
                                                        </div>
                                                        <p className="text-sm text-gray-300 leading-relaxed">{ev.snippet}</p>
                                                    </div>
                                                ))}
                                            </div>
                                        </div>
                                    )}
                                </div>

                                {/* Meta Footer */}
                                <div className="p-4 border-t border-white/10 bg-black/40">
                                    <div className="grid grid-cols-2 gap-3 text-xs">
                                        <div>
                                            <div className="text-gray-500 mb-1">First seen</div>
                                            <div className="text-gray-300">{new Date(selectedNode.created_at).toLocaleDateString()}</div>
                                        </div>
                                        <div>
                                            <div className="text-gray-500 mb-1">Last updated</div>
                                            <div className="text-gray-300">{new Date(selectedNode.updated_at).toLocaleDateString()}</div>
                                        </div>
                                    </div>
                                    {selectedEvidence.length > 0 && (
                                        <div className="mt-3 pt-3 border-t border-white/5">
                                            <div className="text-gray-500">Sources: <span className="text-gray-300">{selectedEvidence.length}</span></div>
                                        </div>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="flex flex-col items-center justify-center h-full py-16 px-6 text-center">
                                <div className="w-16 h-16 rounded-full bg-white/5 flex items-center justify-center mb-4">
                                    <FileText className="w-8 h-8 text-gray-500" />
                                </div>
                                <h3 className="text-lg font-medium text-gray-300 mb-2">No node selected</h3>
                                <p className="text-sm text-gray-500 max-w-xs">
                                    Choose a node from the table to see its data and evidence.
                                </p>
                            </div>
                        )}
                    </div>
                </div>
            </div>

            {/* Create Node Modal */}
            {showCreateModal && (
                <div className="fixed inset-0 bg-black/80 backdrop-blur-sm flex items-center justify-center z-50 p-4">
                    <div className="bg-gray-900 border border-white/10 rounded-lg max-w-md w-full p-6">
                        <div className="flex items-center justify-between mb-6">
                            <h2 className="text-xl font-semibold">Create New Node</h2>
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewNodeLabel('');
                                    setNewNodeType('Fact');
                                    setNewNodeScope('user_profile');
                                    setNewNodeData('');
                                }}
                                className="p-1 hover:bg-white/10 rounded transition-colors"
                            >
                                <X className="w-5 h-5" />
                            </button>
                        </div>

                        <div className="space-y-4">
                            {/* Node Type */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Node Type
                                </label>
                                <select
                                    value={newNodeType}
                                    onChange={(e) => setNewNodeType(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                >
                                    <option value="Fact">Fact</option>
                                    <option value="Identity">Identity</option>
                                    <option value="Preference">Preference</option>
                                    <option value="Project">Project</option>
                                    <option value="Skill">Skill</option>
                                    <option value="Goal">Goal</option>
                                    <option value="Constraint">Limitation</option>
                                    <option value="Section">Topic</option>
                                    <option value="Event">Event</option>
                                    <option value="Entity">Person/Organization</option>
                                    <option value="Concept">Idea</option>
                                    <option value="CodePattern">Code Example</option>
                                </select>
                            </div>

                            {/* Label */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Label <span className="text-red-400">*</span>
                                </label>
                                <input
                                    type="text"
                                    value={newNodeLabel}
                                    onChange={(e) => setNewNodeLabel(e.target.value)}
                                    placeholder="Enter node label..."
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                    onKeyDown={(e) => {
                                        if (e.key === 'Enter' && newNodeLabel.trim()) {
                                            createNode();
                                        }
                                    }}
                                />
                            </div>

                            {/* Scope */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Scope
                                </label>
                                <select
                                    value={newNodeScope}
                                    onChange={(e) => setNewNodeScope(e.target.value)}
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50"
                                >
                                    <option value="user_profile">User Profile</option>
                                    <option value="knowledge:general">Knowledge: General</option>
                                </select>
                            </div>

                            {/* Details/Data */}
                            <div>
                                <label className="block text-sm font-medium text-gray-300 mb-2">
                                    Details <span className="text-gray-500 text-xs">(optional)</span>
                                </label>
                                <textarea
                                    value={newNodeData}
                                    onChange={(e) => setNewNodeData(e.target.value)}
                                    placeholder='JSON or plain text, e.g. {"description": "My details"}'
                                    className="w-full bg-white/5 border border-white/10 rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-emerald-500/50 font-mono text-sm"
                                    rows={3}
                                />
                                <p className="text-xs text-gray-500 mt-1">
                                    Enter JSON or plain text for additional details
                                </p>
                            </div>
                        </div>

                        {/* Actions */}
                        <div className="flex gap-3 mt-6">
                            <button
                                onClick={() => {
                                    setShowCreateModal(false);
                                    setNewNodeLabel('');
                                    setNewNodeType('Fact');
                                    setNewNodeScope('user_profile');
                                    setNewNodeData('');
                                }}
                                className="flex-1 px-4 py-2 bg-white/5 hover:bg-white/10 rounded-lg transition-colors"
                                disabled={isCreating}
                            >
                                Cancel
                            </button>
                            <button
                                onClick={createNode}
                                disabled={!newNodeLabel.trim() || isCreating}
                                className="flex-1 px-4 py-2 bg-emerald-700/60 hover:bg-emerald-600/60 disabled:opacity-50 disabled:cursor-not-allowed rounded-lg transition-colors"
                            >
                                {isCreating ? 'Creating...' : 'Create Node'}
                            </button>
                        </div>
                    </div>
                </div>
            )}
        </div >
    );
}
