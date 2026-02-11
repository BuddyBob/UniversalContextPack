import React from 'react';
import { Pack } from '../lib/types';

interface Props {
    packs: Pack[];
    selectedPackId: string | undefined;
    onSelect: (packId: string) => void;
    onSync: () => Promise<void>;
    onCreate: (packName: string) => Promise<void>;
}

export default function PackList({ packs, selectedPackId, onSelect, onSync, onCreate }: Props) {
    const [syncing, setSyncing] = React.useState(false);
    const [showCreateModal, setShowCreateModal] = React.useState(false);
    const [newPackName, setNewPackName] = React.useState('');
    const [creating, setCreating] = React.useState(false);

    const handleSync = async () => {
        setSyncing(true);
        try {
            await onSync();
        } catch (error) {
            console.error('Error syncing packs:', error);
        } finally {
            setSyncing(false);
        }
    };

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (!newPackName.trim()) return;

        setCreating(true);
        try {
            await onCreate(newPackName.trim());
            setNewPackName('');
            setShowCreateModal(false);
        } catch (error) {
            console.error('Error creating pack:', error);
            alert('Failed to create pack');
        } finally {
            setCreating(false);
        }
    };

    return (
        <div>
            <div className="section-header">
                <h2 className="section-title">Your Packs</h2>
                <div style={{ display: 'flex', gap: '8px' }}>
                    <button onClick={() => setShowCreateModal(true)} className="create-pack-btn">
                        <svg style={{ width: '14px', height: '14px' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 4v16m8-8H4" />
                        </svg>
                        <span>New</span>
                    </button>
                    <button onClick={handleSync} disabled={syncing} className="sync-btn">
                        <svg style={{ width: '14px', height: '14px', animation: syncing ? 'spin 1s linear infinite' : 'none' }} fill="none" stroke="currentColor" viewBox="0 0 24 24">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
                        </svg>
                        <span>{syncing ? 'Syncing...' : 'Sync'}</span>
                    </button>
                </div>
            </div>

            {packs.length === 0 ? (
                <div className="empty-state">
                    <svg className="empty-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M20 13V6a2 2 0 00-2-2H6a2 2 0 00-2 2v7m16 0v5a2 2 0 01-2 2H6a2 2 0 01-2-2v-5m16 0h-2.586a1 1 0 00-.707.293l-2.414 2.414a1 1 0 01-.707.293h-3.172a1 1 0 01-.707-.293l-2.414-2.414A1 1 0 006.586 13H4" />
                    </svg>
                    <h3 className="empty-title">No packs yet</h3>
                    <p className="empty-text">Create your first pack</p>
                    <button onClick={() => setShowCreateModal(true)} className="primary-btn" style={{ marginTop: '12px' }}>
                        Create Pack
                    </button>
                </div>
            ) : (
                <div className="pack-list">
                    {packs.map((pack) => (
                        <button
                            key={pack.pack_id}
                            onClick={() => onSelect(pack.pack_id)}
                            className={`pack-item ${selectedPackId === pack.pack_id ? 'selected' : ''}`}
                        >
                            <div className="pack-name">{pack.pack_name}</div>
                            <div className="pack-sources">
                                {pack.source_count} {pack.source_count === 1 ? 'source' : 'sources'}
                            </div>
                        </button>
                    ))}
                </div>
            )}

            {showCreateModal && (
                <div className="modal-overlay" onClick={() => !creating && setShowCreateModal(false)}>
                    <div className="modal" onClick={(e) => e.stopPropagation()}>
                        <h3 className="modal-title">Create New Pack</h3>
                        <form onSubmit={handleCreate}>
                            <input
                                type="text"
                                value={newPackName}
                                onChange={(e) => setNewPackName(e.target.value)}
                                placeholder="Enter pack name"
                                className="modal-input"
                                autoFocus
                                disabled={creating}
                            />
                            <div className="modal-actions">
                                <button
                                    type="button"
                                    onClick={() => setShowCreateModal(false)}
                                    className="secondary-btn"
                                    disabled={creating}
                                >
                                    Cancel
                                </button>
                                <button
                                    type="submit"
                                    className="primary-btn"
                                    disabled={creating || !newPackName.trim()}
                                >
                                    {creating ? 'Creating...' : 'Create'}
                                </button>
                            </div>
                        </form>
                    </div>
                </div>
            )}
        </div>
    );
}
