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
      console.log('No session ID provided, skipping SSE setup');
      return;
    }

    console.log(`[SSE] Setting up connection for session ${sessionId}`);
    const eventSource = new EventSource(`/api/movie/generate/${sessionId}/progress`);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.type === 'progress') {
          if (data.data.newClip) {
            console.log(`[SSE] Received new clip: scene ${data.data.newClip.clip.order + 1}`);
            onNewClip?.(data.data.newClip.clip);
          }
          setProgress(data.data);

          // Handle completion states
          if (data.data.status === 'completed' || data.data.status === 'completed_with_errors') {
            console.log(`[SSE] Generation completed with status: ${data.data.status}`);
            eventSource.close();
            setIsGenerating(false);
            onComplete?.(data.data.storyboardId || sessionId);
          }

          // Handle failure state
          if (data.data.status === 'failed') {
            console.log(`[SSE] Generation failed`);
            eventSource.close();
            setIsGenerating(false);
            onError?.('Generation failed. Please try again.');
          }
        }
      } catch (error) {
        console.error('[SSE] Error processing event:', error);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      setIsGenerating(false);
      onError?.('Lost connection to server. Please try again.');
    };

    return () => {
      console.log(`[SSE] Closing connection for session ${sessionId}`);
      eventSource.close();
    };
  }, [sessionId, onNewClip, onComplete, onError]);

  return {
    isGenerating,
    progress,
    setIsGenerating,
    setProgress,
    // Expose the processedClipIds for external use
    processedClipIdsRef
  };
}
