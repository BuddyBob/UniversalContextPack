import React, { useEffect, useState } from 'react';
import { storage } from '../lib/storage';
import { api } from '../lib/api';
import { Pack, AuthState } from '../lib/types';
import Login from './Login';
import PackList from './PackList';
import ExtractButton from './ExtractButton';
import InsertButton from './InsertButton';

export default function App() {
    const [packs, setPacks] = useState<Pack[]>([]);
    const [selectedPackId, setSelectedPackId] = useState<string | undefined>(undefined);
    const [loading, setLoading] = useState(true);
    const [auth, setAuth] = useState<AuthState>({
        isAuthenticated: false,
        token: undefined,
        user: undefined,
    });

    useEffect(() => {
        initializeData();
    }, []);

    const initializeData = async () => {
        const authState = await storage.get('auth');
        if (authState?.isAuthenticated) {
            setAuth(authState);
            api.setToken(authState.token);
        }

        const packs = await storage.get('packs');
        if (packs) { setPacks(packs); }

        const selectedPackId = await storage.get('selectedPackId');
        if (selectedPackId) { setSelectedPackId(selectedPackId); }

        setLoading(false);
    };

    async function handleSync() {
        const packs = await api.getPacks();
        if (packs) { setPacks(packs); }
        await storage.set('packs', packs);
    }

    async function handleCreatePack(packName: string) {
        const newPack = await api.createPack(packName);

        // Refresh packs from server
        await handleSync();

        // Auto-select the new pack
        setSelectedPackId(newPack.pack_id);
        await storage.set('selectedPackId', newPack.pack_id);
    }

    async function handleSelectPack(packId: string) {
        setSelectedPackId(packId);
        await storage.set('selectedPackId', packId);
    }

    async function handleLogin(email: string, password: string) {
        const response = await chrome.runtime.sendMessage({
            action: 'login',
            email,
            password,
        });
        if (response.success) {
            const authData = await storage.get('auth');
            const packsData = await storage.get('packs');

            if (authData) setAuth(authData);
            if (packsData) setPacks(packsData);
        } else {
            throw new Error(response.error || 'Login failed');
        }
    }

    async function handleLogout() {
        await chrome.runtime.sendMessage({ action: 'logout' });
        setAuth({ isAuthenticated: false });
        setPacks([]);
        setSelectedPackId(undefined);
    }

    if (loading) {
        return (
            <div className="loading-container">
                <div className="spinner"></div>
                <p className="loading-text">Loading...</p>
            </div>
        )
    }

    if (!auth.isAuthenticated) {
        return <Login onLogin={handleLogin} />
    }

    return (
        <div className="container" style={{ display: 'flex', flexDirection: 'column', height: '100%' }}>
            <div className="header">
                <div className="header-left">
                    <svg className="header-icon" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 3v2m6-2v2M9 19v2m6-2v2M5 9H3m2 6H3m18-6h-2m2 6h-2M7 19h10a2 2 0 002-2V7a2 2 0 00-2-2H7a2 2 0 00-2 2v10a2 2 0 002 2zM9 9h6v6H9V9z" />
                    </svg>
                    <div>
                        <h1 className="header-title">Context Pack</h1>
                        <p className="header-email">{auth.user?.email}</p>
                    </div>
                </div>
                <button onClick={handleLogout} className="logout-btn">
                    Logout
                </button>
            </div>

            <div className="content">
                <PackList
                    packs={packs}
                    selectedPackId={selectedPackId}
                    onSelect={handleSelectPack}
                    onSync={handleSync}
                    onCreate={handleCreatePack}
                />
            </div>

            <div className="footer">
                <div className="button-group">
                    <ExtractButton selectedPackId={selectedPackId} packs={packs} />
                    <InsertButton selectedPackId={selectedPackId} />
                </div>
            </div>
        </div>
    );
}