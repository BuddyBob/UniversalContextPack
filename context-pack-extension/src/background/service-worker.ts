import { ContextPackAPI, API_BASE_URL } from '../lib/api';
import { storage } from '../lib/storage';
import { AuthState } from '../lib/types';

const api = new ContextPackAPI();

// Message handler - centralized routing
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
    handleMessage(message, sender).then(sendResponse);
    return true; // Keep channel open for async response
});

async function handleMessage(message: any, sender: chrome.runtime.MessageSender) {
    const handlers: Record<string, () => Promise<any>> = {
        login: () => handleLogin(message.email, message.password),
        logout: () => handleLogout(),
        sync: () => handleSync(),
        getMemoryTree: () => handleGetMemoryTree(message.packId),
    };

    const handler = handlers[message.action];
    if (!handler) return { success: false, error: 'Unknown action' };

    try {
        return await handler();
    } catch (error) {
        console.error(`Error handling ${message.action}:`, error);
        return { success: false, error: (error as Error).message };
    }
}

// Login handler
async function handleLogin(email: string, password: string) {
    const { token, user } = await api.login(email, password);

    api.setToken(token);
    const authState: AuthState = { isAuthenticated: true, token, user };
    await storage.set('auth', authState);

    const packs = await api.getPacks();
    await storage.set('packs', packs);
    await storage.set('lastSync', Date.now());

    return { success: true, user };
}

// Logout handler
async function handleLogout() {
    await storage.clear();
    return { success: true };
}

// Sync handler
async function handleSync() {
    const authState = await storage.get('auth');
    if (!authState?.token) return { success: false, error: 'Not authenticated' };

    api.setToken(authState.token);
    const packs = await api.getPacks();
    await storage.set('packs', packs);
    await storage.set('lastSync', Date.now());

    return { success: true, packs };
}

// Get memory tree handler
async function handleGetMemoryTree(packId: string) {
    const authState = await storage.get('auth');
    if (!authState?.token) return { success: false, error: 'Not authenticated' };

    api.setToken(authState.token);
    const memoryTree = await api.getMemoryTree(packId);

    return { success: true, memoryTree };
}

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
    console.log('Context Pack extension installed');

    // Restore auth state if exists
    const authState = await storage.get('auth');
    if (authState?.token) {
        api.setToken(authState.token);
    }
});

// Restore auth on startup
chrome.runtime.onStartup.addListener(async () => {
    const authState = await storage.get('auth');
    if (authState?.token) {
        api.setToken(authState.token);
    }
});
