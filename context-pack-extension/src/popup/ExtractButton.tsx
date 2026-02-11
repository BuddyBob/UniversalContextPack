import { useState } from 'react';
import { Pack } from '../lib/types';
import { api } from '../lib/api';

interface ExtractButtonProps {
    selectedPackId: string | undefined;
    packs: Pack[];
}

type UploadStatus = 'idle' | 'extracting' | 'uploading' | 'processing' | 'success' | 'error';

export default function ExtractButton({ selectedPackId, packs }: ExtractButtonProps) {
    const [status, setStatus] = useState<UploadStatus>('idle');
    const [error, setError] = useState<string | null>(null);

    const handleExtract = async () => {
        if (!selectedPackId) return;

        setStatus('extracting');
        setError(null);

        try {
            const selectedPack = packs.find(p => p.pack_id === selectedPackId);
            if (!selectedPack) { throw new Error('Pack not found'); }

            // Extract conversation from ChatGPT page
            const [tab] = await chrome.tabs.query({ active: true, currentWindow: true });
            if (!tab || !tab.id) { throw new Error('No active tab found'); }

            const result = await chrome.tabs.sendMessage(tab.id, { action: 'extractConversation' });

            if (!result.success) {
                throw new Error(result.error || 'Failed to extract conversation');
            }

            // Upload to backend
            setStatus('uploading');
            await api.uploadConversation(selectedPackId, result.conversation);

            // Show processing state
            setStatus('processing');

            // Wait a bit then show success and open pack page
            setTimeout(() => {
                setStatus('success');

                // Open pack page on website
                const packUrl = `https://www.context-pack.com/process-v3?pack=${selectedPackId}`;
                chrome.tabs.create({ url: packUrl });

                setTimeout(() => setStatus('idle'), 3000);
            }, 1000);

        } catch (err) {
            console.error('Error uploading conversation:', err);
            setError(err instanceof Error ? err.message : 'An unknown error occurred');
            setStatus('error');
            setTimeout(() => setStatus('idle'), 5000);
        }
    };

    const getButtonText = () => {
        switch (status) {
            case 'extracting': return 'Extracting...';
            case 'uploading': return 'Uploading...';
            case 'processing': return 'Processing...';
            case 'success': return '✓ Conversation Added!';
            case 'error': return 'Upload Failed';
            default: return 'Upload Conversation';
        }
    };

    const isDisabled = !selectedPackId || status !== 'idle' && status !== 'error';

    return (
        <div>
            <button
                onClick={handleExtract}
                disabled={isDisabled}
                className={`btn ${status === 'success' ? 'btn-success' : status === 'error' ? 'btn-error' : ''}`}
            >
                {getButtonText()}
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
            {status === 'processing' && (
                <div style={{ marginTop: '8px', fontSize: '11px', color: '#888' }}>
                    This may take a few minutes...
                </div>
            )}
        </div>
    );
}