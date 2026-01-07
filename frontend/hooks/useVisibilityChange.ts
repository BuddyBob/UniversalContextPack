import { useEffect, useState } from 'react';

/**
 * Hook to detect page visibility
 * Stops polling when user switches tabs
 */
export function useVisibilityChange() {
    // Default to true during SSR (assume visible until we're in browser)
    const [isVisible, setIsVisible] = useState<boolean>(true);

    useEffect(() => {
        // Now we're in the browser, set initial value
        setIsVisible(!document.hidden);
        
        const handleVisibilityChange = () => {
            setIsVisible(!document.hidden);
        };

        document.addEventListener('visibilitychange', handleVisibilityChange);

        return () => {
            document.removeEventListener('visibilitychange', handleVisibilityChange);
        };
    }, []);

    return isVisible;
}
