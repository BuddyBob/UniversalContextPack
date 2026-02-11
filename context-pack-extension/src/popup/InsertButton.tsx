import React, { useState } from 'react';
import { storage } from '../lib/storage';

interface Props {
    selectedPackId: string | undefined;
}

export default function InsertButton({ selectedPackId }: Props) {
    const [inserting, setInserting] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [success, setSuccess] = useState(false);

    const handleInsert = async () => {
        if (!selectedPackId) return;

        setInserting(true);
        setError(null);
        setSuccess(false);

        try {
            const response = await chrome.runtime.sendMessage({ action: 'getMemoryTree', packId: selectedPackId });

            if (response.success) {
                const memoryTree = JSON.stringify(response.memoryTree, null, 2);
                const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });

                if (!tab.id || !tab.url || !(tab.url.includes('chatgpt.com') || tab.url.includes('chat.openai.com'))) {
                    setError('Please open ChatGPT first');
                    return;
                }

                const insertResponse = await chrome.tabs.sendMessage(tab.id, { action: 'insertMemoryTree', memoryTree });
                if (!insertResponse.success) {
                    throw new Error(insertResponse.error || 'Failed to insert memory tree');
                }

                setSuccess(true);
                setTimeout(() => setSuccess(false), 2000);
            }
            else {
                throw new Error(response.error || 'Failed to get memory tree');
            }
        }
        catch (err) {
            console.error('Error inserting memory tree:', err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
        }
        finally {
            setInserting(false);
        }
    };

    return (
        <div>
            <button
                onClick={handleInsert}
                disabled={!selectedPackId || inserting}
                className="btn btn-secondary"
            >
                {inserting ? 'Inserting...' : success ? '✓ Inserted!' : 'Insert Memory Tree'}
            </button>
            {error && (
                <div className="error-message" style={{ marginTop: '8px', fontSize: '12px', display: 'flex', alignItems: 'center', justifyContent: 'space-between' }}>
                    <span>{error}</span>
                    <button
                        onClick={() => setError(null)}
                        style={{ background: 'none', border: 'none', color: '#ef4444', cursor: 'pointer', padding: '0 0 0 8px', fontSize: '14px' }}
                        title="Dismiss"
                    >
                        ×
                    </button>
                </div>
            )}
        </div>
    );
}
