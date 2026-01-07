import { useEffect, useRef, useCallback } from 'react';

interface UsePollingOptions {
    enabled: boolean;
    interval?: number;
    onPoll: () => Promise<void>;
}

/**
 * Efficient polling hook with 2-second default interval
 * Matches test suite's proven approach
 * No race condition checks - let polls queue naturally
 */
export function usePolling({ enabled, interval = 2000, onPoll }: UsePollingOptions) {
    const intervalRef = useRef<NodeJS.Timeout | null>(null);
    const savedCallback = useRef<() => Promise<void>>();

    // Save latest callback
    useEffect(() => {
        savedCallback.current = onPoll;
    }, [onPoll]);

    const stopPolling = useCallback(() => {
        if (intervalRef.current) {
            clearInterval(intervalRef.current);
            intervalRef.current = null;
        }
    }, []);

    useEffect(() => {
        if (!enabled) {
            stopPolling();
            return;
        }

        // Polling function that uses latest callback
        const poll = async () => {
            try {
                if (savedCallback.current) {
                    await savedCallback.current();
                }
            } catch (error) {
                console.error('[usePolling] Poll error:', error);
                // Continue polling - backend handles failures
            }
        };

        // Initial poll
        poll();

        // Set up interval
        intervalRef.current = setInterval(poll, interval);

        // Cleanup
        return () => stopPolling();
    }, [enabled, interval, stopPolling]);

    return { stopPolling };
}
