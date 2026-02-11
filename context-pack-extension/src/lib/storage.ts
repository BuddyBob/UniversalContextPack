import { StorageData } from './types';

export const storage = {

    async get<K extends keyof StorageData>(key: K): Promise<StorageData[K] | undefined> {
        const result = await chrome.storage.local.get(key);
        return result[key] as StorageData[K] | undefined;
    },

    async set<K extends keyof StorageData>(key: K, value: StorageData[K]): Promise<void> {
        await chrome.storage.local.set({ [key]: value });
    },

    async getMultiple<K extends keyof StorageData>(keys: K[]): Promise<Partial<StorageData>> {
        const result = await chrome.storage.local.get(keys);
        return result as Partial<StorageData>;
    },

    async getAll(): Promise<Partial<StorageData>> {
        const result = await chrome.storage.local.get(null);
        return result as Partial<StorageData>;
    },

    async remove<K extends keyof StorageData>(key: K): Promise<void> {
        await chrome.storage.local.remove(key as string);
    },

    async clear(): Promise<void> {
        await chrome.storage.local.clear();
    },
};