import { useState, useEffect, useCallback, useRef } from 'react';
import { MovieClip } from '../contexts/MovieContext';

interface GenerationProgressState {
  current: number;
  total: number;
  status: 'initializing' | 'generating' | 'in_progress' | 'completed' | 'completed_with_errors' | 'failed';
}

interface GenerationProgressHookProps {
  sessionId: string | null;
  onNewClip?: (clip: MovieClip) => void;
  onComplete?: (storyboardId: string) => void;
  onError?: (error: string) => void;
  onCleanup?: (sessionId: string) => void;
}

/**
 * Hook for managing SSE connection and generation progress updates
 */
export function useGenerationProgress({
  sessionId,
  onNewClip,
  onComplete,
  onError,
  onCleanup
}: GenerationProgressHookProps) {
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState<GenerationProgressState>({
    current: 0,
    total: 0,
    status: 'initializing'
  });

  // Use refs to track the current event source and session
  const eventsRef = useRef<EventSource | null>(null);
  const activeSessionRef = useRef<string | null>(null);

  // Keep track of unmounting to avoid state updates after unmount
  const isMountedRef = useRef<boolean>(true);

  // Track processed clip IDs by animation ID to prevent duplicates
  const processedClipIdsRef = useRef<Map<string, Set<string>>>(new Map());

  // Track last status for logging
  const lastStatusRef = useRef<string | null>(null);

  // Track retrying state
  const isRetryingRef = useRef<boolean>(false);

  // Effect to handle SSE connection
  useEffect(() => {
    // Set as mounted when the component initializes
    isMountedRef.current = true;

    return () => {
      // Mark as unmounted when the component is unmounted
      isMountedRef.current = false;
    };
  }, []);

  // Effect to handle SSE connection
  useEffect(() => {
    if (!sessionId) {
      return;
    }

    // Create the EventSource for Server-Sent Events
    const eventSource = new EventSource(`/api/movie/generate/${sessionId}/progress`);
    eventsRef.current = eventSource;
    activeSessionRef.current = sessionId;
    setIsGenerating(true);

    // Handle incoming messages
    eventSource.onmessage = (event) => {
      if (!isMountedRef.current) {
        eventSource.close();
        return;
      }

      try {
        const data = JSON.parse(event.data);

        // Only log important status changes and clip updates
        if (data.type === 'progress') {
          const progressData = data.data;

          // Log clip updates
          if (progressData.newClip) {
            onNewClip?.(progressData.newClip.clip);
          }

          // Log status changes
          if (progressData.status && progressData.status !== lastStatusRef.current) {
            lastStatusRef.current = progressData.status;
          }

          // When complete, log completion event
          if (['completed', 'completed_with_errors', 'failed'].includes(progressData.status)) {
            // Update progress state first
            setProgress(progressData);
            setIsGenerating(false);

            // Close the connection
            eventSource.close();
            eventsRef.current = null;
            activeSessionRef.current = null;

            // Call cleanup first to ensure session is properly closed
            onCleanup?.(sessionId);

            // Then call onComplete with the storyboard ID if available
            if (progressData.storyboardId) {
              onComplete?.(progressData.storyboardId);
            }
          }

          // Handle failure state
          if (progressData.status === 'failed') {
            eventSource.close();
            eventsRef.current = null;
            activeSessionRef.current = null;
            setIsGenerating(false);
            onCleanup?.(sessionId);
            onError?.('Generation failed. Please try again.');
          }

          setProgress(progressData);
        }
      } catch (error) {
        console.error('[SSE] Error processing SSE event:', error);
        eventSource.close();
        eventsRef.current = null;
        activeSessionRef.current = null;
        setIsGenerating(false);
        onCleanup?.(sessionId);
      }
    };

    // Handle connection open
    eventSource.onopen = () => {
      // Connection opened
    };

    // Handle errors
    eventSource.onerror = (error) => {
      console.error('[SSE] Error with EventSource connection:', error);
      // Only retry if not already retrying and the connection isn't closed
      if (!isRetryingRef.current && eventSource.readyState !== 2) {
        isRetryingRef.current = true;
        setTimeout(() => {
          isRetryingRef.current = false;
        }, 5000); // Wait before allowing another retry
      }
    };

    // Cleanup function to close the connection when the component unmounts
    return () => {
      if (eventSource) {
        eventSource.close();
        eventsRef.current = null;
        activeSessionRef.current = null;
      }
    };
  }, [sessionId, onNewClip, onComplete, onError, onCleanup]);

  return {
    isGenerating,
    progress,
    setIsGenerating,
    setProgress,
    // Expose the processedClipIds for external use
    processedClipIdsRef
  };
}
