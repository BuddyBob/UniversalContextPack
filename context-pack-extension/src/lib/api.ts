// For browser extensions, use Vite's import.meta.env or a direct constant
// You can set VITE_API_URL in your .env file
export const API_BASE_URL = import.meta.env.VITE_API_URL || 'http://localhost:8000';

export class ContextPackAPI {
    private token?: string;

    setToken(token: string) {
        this.token = token;
    }

    async login(email: string, password: string) {
        const response = await fetch(`${API_BASE_URL}/auth/login`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ email, password }),
        });

        if (!response.ok) {
            const errorData = await response.json().catch(() => ({}));
            throw new Error(errorData.detail || 'Login failed');
        }

        const data = await response.json();
        return {
            token: data.token,
            user: data.user,
        };
    }

    async getPacks() {
        const response = await fetch(`${API_BASE_URL}/api/packs`, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch packs');
        }

        return await response.json();
    }

    async createPack(name: string) {
        if (!this.token) { throw new Error('Not authenticated - please login first'); }

        const response = await fetch(`${API_BASE_URL}/api/packs`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({ pack_name: name }),
        });

        if (!response.ok) {
            throw new Error('Failed to create pack');
        }

        return await response.json();
    }

    async uploadConversation(packId: string, conversation: any) {
        const response = await fetch(`${API_BASE_URL}/api/upload-chatgpt-conversation`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${this.token}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                pack_id: packId,
                conversation
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to upload conversation');
        }

        return await response.json();
    }

    async getMemoryTree(packId: string) {
        const response = await fetch(`${API_BASE_URL}/api/packs/${packId}/memory-tree`, {
            headers: {
                'Authorization': `Bearer ${this.token}`,
            },
        });

        if (!response.ok) {
            throw new Error('Failed to fetch memory tree');
        }

        return await response.json();
    }
}

export const api = new ContextPackAPI();