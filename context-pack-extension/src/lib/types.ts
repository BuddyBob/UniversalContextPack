export interface User {
    id: string;
    email: string;
    name?: string;
}
export interface Pack {
    pack_id: string;
    pack_name: string;
    source_count: number;
}
export interface AuthState {
    isAuthenticated: boolean;
    token?: string;
    user?: User;
}
export interface StorageData {
    auth: AuthState;
    packs: Pack[];
    selectedPackId?: string;
    lastSync?: number;
}
export interface ExtractedConversation {
    title: string;
    messages: Array<{
        role: 'user' | 'assistant';
        content: string;
    }>;
    extractedAt: string;
}
export interface MemoryTree {
    pack_id: string;
    pack_name: string;
    memory_tree: any;
    generated_at: string;
}