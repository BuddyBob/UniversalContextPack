import { useState, useEffect, useRef } from 'react';
import { useInterval } from './useInterval';
import { useVisibilityChange } from './useVisibilityChange';

interface UsePollingOptions {
    enabled?: boolean;
    interval?: number;
    onPoll: () => Promise<void> | void;
}

/**
 * Robust polling hook that automatically follows best practices:
 * 1. Stops when tab is hidden (using useVisibilityChange)
 * 2. Uses clean interval management (via useInterval)
 * 3. Prevents unnecessary re-renders
 * 4. Performs initial poll when starting for immediate feedback
 */
export function usePolling({ enabled = true, interval = 2000, onPoll }: UsePollingOptions) {
    const isPageVisible = useVisibilityChange();
    const [effectiveInterval, setEffectiveInterval] = useState<number | null>(null);
    const onPollRef = useRef(onPoll);

    // Always keep the latest callback
    useEffect(() => {
        onPollRef.current = onPoll;
    }, [onPoll]);

    // Calculate effective interval based on visibility and enabled state
    useEffect(() => {
        const shouldPoll = enabled && isPageVisible;

        if (shouldPoll) {
            setEffectiveInterval(interval);

            // Perform initial poll immediately when starting
            onPollRef.current();
        } else {
            setEffectiveInterval(null);
        }
    }, [enabled, isPageVisible, interval]); // onPoll NOT in deps - use ref instead

    // Use the robust interval hook
    useInterval(() => {
        onPollRef.current();
    }, effectiveInterval);

    return {
        isPolling: effectiveInterval !== null
    };
}
