import { useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions {
    enabled: boolean;
    interval?: number;
    onPoll: () => Promise<void>;
}

/**
 * Custom hook for managing polling with automatic cleanup
 * 
 * @param enabled - Whether polling should be active
 * @param onPoll - Async function to call on each poll
 * @param interval - Polling interval in milliseconds (default: 2000)
 */
export function usePolling({ enabled, interval = 2000, onPoll }: UsePollingOptions) {
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const isPollingRef = useRef(false);
    const lastPollStartRef = useRef<number>(0);

    const startPolling = useCallback(() => {
        if (intervalRef.current) return; // Already polling

        // Start interval polling immediately (no initial poll to avoid race conditions)
        intervalRef.current = setInterval(async () => {
            const now = Date.now();
            const timeSinceLastPoll = now - lastPollStartRef.current;

            if (isPollingRef.current) {
                // If previous poll has been running for more than 20 seconds, force-reset
                if (timeSinceLastPoll > 20000) {
                    console.warn(`[usePolling] ⚠️ Poll stuck for ${timeSinceLastPoll}ms, force-resetting`);
                    isPollingRef.current = false;
                } else {
                    console.log('[usePolling] Skipping poll - previous poll still running');
                    return; // Skip if previous poll still running
                }
            }

            isPollingRef.current = true;
            lastPollStartRef.current = now;

            // Safety timer: Force reset after 30 seconds
            const safetyTimer = setTimeout(() => {
                console.error('[usePolling] 🚨 Safety timeout - force-resetting poll lock after 30s');
                isPollingRef.current = false;
            }, 30000);

            try {
                await onPoll();
            } catch (error) {
                console.error('[usePolling] Poll error:', error);
                // CRITICAL: Always reset isPollingRef even on error
                // to prevent polling from permanently stopping
            } finally {
                clearTimeout(safetyTimer);
                isPollingRef.current = false;
            }
        }, interval);
    }, [onPoll, interval]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
        isPollingRef.current = false;
    }, []);

    useEffect(() => {
        if (enabled) {
            startPolling();
        } else {
            stopPolling();
        }

        return () => stopPolling();
    }, [enabled, startPolling, stopPolling]);

    return { startPolling, stopPolling };
}
