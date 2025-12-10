'use client';

import { useParams, useRouter } from 'next/navigation';
import { useEffect, useState, useMemo } from 'react';
import {
    ArrowLeft, Search, FileText, AlertTriangle, Target,
    User, Star, Folder, Zap, ArrowUpDown, Pin, Edit2, Save, X, Trash2
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

    const deleteNode = async () => {
        if (!selectedNode || !user) return;

        if (!confirm(`Are you sure you want to delete "${selectedNode.label || 'this node'}"? This action cannot be undone.`)) {
            return;
        }

        try {
            const response = await makeAuthenticatedRequest(
                `${API_URL}/api/v2/nodes/${selectedNode.id}`,
                { method: 'DELETE' }
            );

            if (!response.ok) {
                throw new Error('Failed to delete node');
            }

            // Update local state - remove node from tree
            setTreeData(prev => {
                if (!prev) return prev;
                const updated = { ...prev };
                Object.keys(updated.scopes).forEach(scope => {
                    Object.keys(updated.scopes[scope]).forEach(type => {
                        updated.scopes[scope][type] = updated.scopes[scope][type].filter(
                            n => n.id !== selectedNode.id
                        );
                    });
                });
                updated.total_nodes = updated.total_nodes - 1;
                return updated;
            });

            // Clear selection
            setSelectedNode(null);
            setSelectedEvidence([]);
        } catch (err) {
            console.error('Error deleting node:', err);
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
                <div className="max-w-[1800px] mx-auto px-6 py-4">
                    <div className="flex items-center justify-between">
                        <div className="flex items-center gap-4">
                            <button
                                onClick={() => router.push(`/process?packId=${packId}`)}
                                className="p-2 hover:bg-white/10 rounded-lg transition-colors"
                                title="Back to pack"
                            >
                                <ArrowLeft className="w-5 h-5" />
                            </button>
                            <div>
                                <h1 className="text-2xl font-bold">{treeData.pack_name}</h1>
                                <p className="text-sm text-gray-400">
                                    {treeData.total_nodes} nodes · {Object.keys(treeData.scopes).length} {Object.keys(treeData.scopes).length === 1 ? 'scope' : 'scopes'}
                                </p>
                            </div>
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
                                            className={`group w-full px-4 py-3 flex items-center gap-4 hover:bg-white/10 transition-all border-l-2 ${isSelected
                                                ? 'border-white bg-white/10'
                                                : 'border-transparent'
                                                }`}
                                        >
                                            <button
                                                onClick={() => setSelectedNode(node)}
                                                className="flex-1 flex items-center gap-4 text-left"
                                            >
                                                <div className="flex-1 min-w-0">
                                                    <span className="text-sm block truncate" title={node.label || 'Untitled'}>
                                                        {node.label || 'Untitled'}
                                                    </span>
                                                </div>
                                                <div className="w-32 flex items-center gap-2">
                                                    <Icon className={`w-4 h-4 ${color}`} />
                                                    <span className="text-xs text-gray-400">{node.node_type}</span>
                                                </div>
                                                <div className="w-20 text-center">
                                                    {node.evidence_count > 0 && (
                                                        <span className="px-2 py-0.5 bg-white/10 rounded-full text-xs">
                                                            {node.evidence_count}
                                                        </span>
                                                    )}
                                                </div>
                                                <div className="w-32 text-xs text-gray-500">
                                                    {new Date(node.updated_at).toLocaleDateString()}
                                                </div>
                                            </button>
                                            <button
                                                onClick={(e) => {
                                                    e.stopPropagation();
                                                    setSelectedNode(node);
                                                    deleteNode();
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
                                <div className="p-6 border-b border-white/10">
                                    <div className="flex items-start justify-between mb-3">
                                        <div className="flex items-center gap-3 flex-1">
                                            {(() => {
                                                const Icon = getNodeIcon(selectedNode.node_type);
                                                const color = nodeColors[selectedNode.node_type] || 'text-gray-400';
                                                return <Icon className={`w-8 h-8 ${color} flex-shrink-0`} />;
                                            })()}
                                            <div className="flex-1 min-w-0">
                                                <div className="text-xs text-gray-400 mb-1">{selectedNode.node_type}</div>
                                                {isEditing ? (
                                                    <input
                                                        type="text"
                                                        value={editedLabel}
                                                        onChange={(e) => setEditedLabel(e.target.value)}
                                                        className="w-full text-lg font-semibold bg-white/5 border border-white/20 rounded px-2 py-1 focus:outline-none focus:ring-2 focus:ring-white/30"
                                                        placeholder="Node label"
                                                    />
                                                ) : (
                                                    <h3 className="text-lg font-semibold leading-tight">{selectedNode.label || 'Untitled'}</h3>
                                                )}
                                            </div>
                                        </div>
                                        <div className="flex items-center gap-2 ml-2">
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
                                                </>
                                            )}
                                        </div>
                                    </div>
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
        </div >
    );
}
