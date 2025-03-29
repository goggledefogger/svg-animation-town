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

    // Don't set up a new connection if we're already connected to this session
    if (activeSessionRef.current === sessionId) {
      console.log(`[SSE] Already connected to session ${sessionId}`);
      return;
    }

    console.log(`[SSE] Setting up connection for session ${sessionId}`);
    const eventSource = new EventSource(`/api/movie/generate/${sessionId}/progress`);
    eventsRef.current = eventSource;
    activeSessionRef.current = sessionId;
    setIsGenerating(true);

    eventSource.onmessage = (event) => {
      if (!isMountedRef.current) {
        console.log(`[SSE] Component unmounted, ignoring message for session ${sessionId}`);
        eventSource.close();
        return;
      }

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
            
            // Update progress state first
            setProgress(data.data);
            setIsGenerating(false);
            
            // Close the connection
            eventSource.close();
            eventsRef.current = null;
            activeSessionRef.current = null;
            
            // Call cleanup first to ensure session is properly closed
            onCleanup?.(sessionId);
            
            // Then call onComplete with the storyboard ID if available
            if (data.data.storyboardId) {
              onComplete?.(data.data.storyboardId);
            }
          }

          // Handle failure state
          if (data.data.status === 'failed') {
            console.log(`[SSE] Generation failed`);
            eventSource.close();
            eventsRef.current = null;
            activeSessionRef.current = null;
            setIsGenerating(false);
            onCleanup?.(sessionId);
            onError?.('Generation failed. Please try again.');
          }
        }
      } catch (error) {
        console.error('[SSE] Error processing event:', error);
        eventSource.close();
        eventsRef.current = null;
        activeSessionRef.current = null;
        setIsGenerating(false);
        onCleanup?.(sessionId);
      }
    };

    eventSource.onerror = (error) => {
      console.error('[SSE] Connection error:', error);
      eventSource.close();
      eventsRef.current = null;
      activeSessionRef.current = null;
      setIsGenerating(false);
      onCleanup?.(sessionId);
      onError?.('Lost connection to server. Please try again.');
    };

    return () => {
      console.log(`[SSE] Cleaning up connection for session ${sessionId}`);
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
