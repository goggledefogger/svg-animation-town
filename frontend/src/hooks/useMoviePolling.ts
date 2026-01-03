import { useRef, useCallback } from 'react';
import { MovieStorageApi } from '../services/api';
import type { Storyboard } from '../contexts/MovieContext';

interface PollCallbacks {
    onUpdate: (movie: Storyboard) => void;
    onComplete: () => void;
    onError: (error: Error) => void;
}

interface GenerationProgressUpdate {
    completedScenes: number;
    totalScenes: number;
    inProgress: boolean;
}

/**
 * Hook for polling movie generation status from the server.
 * Encapsulates polling state and provides start/stop controls.
 */
export function useMoviePolling() {
    const isPollingRef = useRef<boolean>(false);
    const pollIntervalRef = useRef<NodeJS.Timeout | null>(null);
    const conditionalIntervalRef = useRef<NodeJS.Timeout | null>(null);

    /**
     * Stop all active polling
     */
    const stopPolling = useCallback(() => {
        isPollingRef.current = false;

        if (pollIntervalRef.current) {
            clearInterval(pollIntervalRef.current);
            pollIntervalRef.current = null;
        }

        if (conditionalIntervalRef.current) {
            clearInterval(conditionalIntervalRef.current);
            conditionalIntervalRef.current = null;
        }
    }, []);

    /**
     * Start polling for movie status updates
     */
    const startPolling = useCallback((
        storyboardId: string,
        intervalMs: number,
        callbacks: PollCallbacks
    ) => {
        // Don't start if already polling
        if (isPollingRef.current || !storyboardId) return;

        isPollingRef.current = true;

        pollIntervalRef.current = setInterval(async () => {
            if (!isPollingRef.current) {
                stopPolling();
                return;
            }

            try {
                const response = await MovieStorageApi.getMovie(storyboardId);

                if (!response?.success || !response.movie) {
                    console.warn('[useMoviePolling] Failed to fetch movie data');
                    return;
                }

                const { movie } = response;
                const status = movie.generationStatus;

                // Notify of update
                callbacks.onUpdate(movie);

                // Check if generation completed
                if (status && !status.inProgress) {
                    stopPolling();
                    callbacks.onComplete();
                }
            } catch (error) {
                console.error('[useMoviePolling] Polling error:', error);
                callbacks.onError(error instanceof Error ? error : new Error('Unknown polling error'));
            }
        }, intervalMs);

        return stopPolling;
    }, [stopPolling]);

    /**
     * Start conditional polling that stops when SSE becomes available
     */
    const startConditionalPolling = useCallback((
        storyboardId: string,
        intervalMs: number,
        onSessionAvailable: (sessionId: string) => void,
        onUpdate: (movie: Storyboard, progress: GenerationProgressUpdate) => void,
        onComplete: () => void
    ) => {
        if (conditionalIntervalRef.current) {
            clearInterval(conditionalIntervalRef.current);
        }

        conditionalIntervalRef.current = setInterval(async () => {
            try {
                const response = await MovieStorageApi.getMovie(storyboardId);

                if (!response?.success || !response.movie) {
                    console.warn('[useMoviePolling] Conditional poll failed');
                    return;
                }

                const { movie } = response;
                const status = movie.generationStatus;

                // Check if generation completed
                if (status && !status.inProgress) {
                    stopPolling();
                    onComplete();
                    return;
                }

                // Check if SSE session became available
                if (status?.activeSessionId) {
                    stopPolling();
                    onSessionAvailable(status.activeSessionId);
                    return;
                }

                // Update with current progress
                if (status) {
                    onUpdate(movie, {
                        completedScenes: status.completedScenes || 0,
                        totalScenes: status.totalScenes || 0,
                        inProgress: status.inProgress
                    });
                }
            } catch (error) {
                console.error('[useMoviePolling] Conditional polling error:', error);
            }
        }, intervalMs);

        return stopPolling;
    }, [stopPolling]);

    return {
        isPolling: isPollingRef.current,
        startPolling,
        startConditionalPolling,
        stopPolling
    };
}
