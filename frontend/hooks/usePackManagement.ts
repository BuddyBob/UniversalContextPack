import { useState, useCallback } from 'react';
import { useAuth } from '@/components/AuthProvider';
import { API_BASE_URL } from '@/lib/api';

interface Pack {
    pack_id: string;
    pack_name: string;
    description?: string;
    custom_system_prompt?: string;
    total_sources: number;
    total_tokens: number;
    created_at?: string;
}

interface Source {
    source_id: string;
    source_name: string;
    file_name?: string;
    status: string;
    progress?: number;
    total_chunks?: number;
    processed_chunks?: number;
    error_message?: string;
}

/**
 * Custom hook for managing pack operations
 */
export function usePackManagement() {
    const { makeAuthenticatedRequest } = useAuth();
    const [packs, setPacks] = useState<Pack[]>([]);
    const [selectedPack, setSelectedPack] = useState<Pack | null>(null);
    const [packSources, setPackSources] = useState<Source[]>([]);
    const [isLoading, setIsLoading] = useState(false);

    /**
     * Load all packs for the current user
     */
    const loadPacks = useCallback(async () => {
        try {
            setIsLoading(true);
            const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`);

            if (response.ok) {
                const data = await response.json();
                setPacks(data.packs || []);
                return data.packs || [];
            }
            return [];
        } catch (error) {
            console.error('[usePackManagement] Error loading packs:', error);
            return [];
        } finally {
            setIsLoading(false);
        }
    }, [makeAuthenticatedRequest]);

    /**
     * Load details for a specific pack (including sources)
     */
    const loadPackDetails = useCallback(async (packId: string) => {
        try {
            const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${packId}`);

            if (response.ok) {
                const data = await response.json();
                setPackSources(data.sources || []);
                return data;
            }
            return null;
        } catch (error) {
            console.error('[usePackManagement] Error loading pack details:', error);
            return null;
        }
    }, [makeAuthenticatedRequest]);

    /**
     * Create a new pack
     */
    const createPack = useCallback(async (packName: string, description?: string) => {
        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 10000); // 10 seconds - enough for auth + DB roundtrip

        try {
            console.log('[usePackManagement] Creating pack:', packName);
            const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    pack_name: packName,
                    description: description || '',
                }),
                signal: controller.signal,
            });

            if (response.ok) {
                const newPack = await response.json();
                console.log('[usePackManagement] Pack created successfully:', newPack);
                await loadPacks(); // Refresh pack list
                return newPack;
            }

            const errorText = await response.text();
            console.error('[usePackManagement] Create pack failed:', response.status, errorText);
            throw new Error(`Failed to create pack: ${errorText}`);
        } catch (error) {
            if (error instanceof Error && error.name === 'AbortError') {
                console.error('[usePackManagement] Pack creation timed out');
                throw new Error('Pack creation timed out. Please check your connection and try again.');
            }
            console.error('[usePackManagement] Error creating pack:', error);
            throw error;
        } finally {
            clearTimeout(timeout);
        }
    }, [loadPacks, makeAuthenticatedRequest]);

    /**
     * Select a pack and load its sources
     */
    const selectPack = useCallback(async (pack: Pack) => {
        setSelectedPack(pack);
        await loadPackDetails(pack.pack_id);
    }, [loadPackDetails]);

    /**
     * Update pack name
     */
    const updatePackName = useCallback(async (packId: string, newName: string) => {
        try {
            const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${packId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ pack_name: newName }),
            });

            if (response.ok) {
                await loadPacks();
                if (selectedPack?.pack_id === packId) {
                    setSelectedPack((prev) => prev ? { ...prev, pack_name: newName } : null);
                }
                return true;
            }
            return false;
        } catch (error) {
            console.error('[use PackManagement] Error updating pack name:', error);
            return false;
        }
    }, [loadPacks, selectedPack, makeAuthenticatedRequest]);

    /**
     * Update custom system prompt
     */
    const updateCustomPrompt = useCallback(async (packId: string, prompt: string) => {
        try {
            const response = await makeAuthenticatedRequest(`${API_BASE_URL}/api/v2/packs/${packId}`, {
                method: 'PATCH',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ custom_system_prompt: prompt }),
            });

            if (response.ok && selectedPack?.pack_id === packId) {
                setSelectedPack((prev) => prev ? { ...prev, custom_system_prompt: prompt } : null);
                return true;
            }
            return false;
        } catch (error) {
            console.error('[usePackManagement] Error updating custom prompt:', error);
            return false;
        }
    }, [selectedPack, makeAuthenticatedRequest]);

    return {
        packs,
        selectedPack,
        packSources,
        isLoading,
        loadPacks,
        loadPackDetails,
        createPack,
        selectPack,
        updatePackName,
        updateCustomPrompt,
        setPackSources, // Expose for direct updates from polling
    };
}
