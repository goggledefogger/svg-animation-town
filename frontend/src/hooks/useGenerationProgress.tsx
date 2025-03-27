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
    // Don't do anything if we don't have a session ID
    if (!sessionId) {
      console.log("No session ID provided, skipping SSE setup");
      return;
    }

    console.log(`Setting up SSE connection for session ${sessionId}`);

    // Don't recreate the connection if we already have one for the same session
    if (eventsRef.current && activeSessionRef.current === sessionId) {
      console.log(`Already have an active SSE connection for session ${sessionId}`);
      return;
    }

    // Clean up any existing connection before creating a new one
    if (eventsRef.current) {
      console.log(`Closing existing SSE connection for ${activeSessionRef.current} before creating new one for ${sessionId}`);
      eventsRef.current.close();
      eventsRef.current = null;
    }

    // Update active session reference
    activeSessionRef.current = sessionId;

    // Always set isGenerating to true immediately when session is provided
    if (isMountedRef.current) {
      setIsGenerating(true);
    }

    // Set up SSE connection
    try {
      const events = new EventSource(`/api/movie/generate/${sessionId}/progress`);
      eventsRef.current = events;

      console.log(`SSE connection established for ${sessionId}`);

      events.onmessage = (event) => {
        // Skip processing if component has unmounted
        if (!isMountedRef.current) return;

        try {
          // Log raw event data
          console.log(`[RAW_SSE_EVENT] Raw SSE data received for session ${sessionId}:`, event.data);

          const update = JSON.parse(event.data);
          console.log(`Received SSE update for session ${sessionId}:`, update);

          if (update.type === 'progress') {
            setProgress(update.data);

            // Handle new clip updates
            if (update.data.newClip) {
              const clipData = update.data.newClip.clip;
              console.log(`[STATE_UPDATE] New clip received for session ${sessionId}:`, clipData);

              // Check if this clip has an animation ID
              if (clipData.animationId) {
                // Get or create the set of clip IDs for this animation ID
                const processedClips = processedClipIdsRef.current.get(clipData.animationId) || new Set<string>();

                // Check if we've already processed this specific clip
                if (processedClips.has(clipData.id)) {
                  console.log(`[DUPLICATE_EVENT] Skipping duplicate clip ${clipData.id} with animation ID ${clipData.animationId}`);
                } else {
                  // Track this clip as processed
                  processedClips.add(clipData.id);
                  processedClipIdsRef.current.set(clipData.animationId, processedClips);

                  console.log(`[NEW_CLIP] Processing clip ${clipData.id} with animation ID ${clipData.animationId}`);
                  // Pass the clip to the callback
                  onNewClip?.(clipData);
                }
              } else {
                // No animation ID, just pass it through
                console.log(`[NEW_CLIP] Processing clip without animation ID: ${clipData.id}`);
                onNewClip?.(clipData);
              }
            }

            // Handle completion
            if (update.data.status === 'completed' || update.data.status === 'completed_with_errors') {
              console.log(`Session ${sessionId} completed with status: ${update.data.status}`);
              events.close();
              eventsRef.current = null;
              activeSessionRef.current = null;

              if (isMountedRef.current) {
                setIsGenerating(false);
              }

              // Make sure we pass the actual storyboard ID, not the session ID
              const storyboardId = update.data.storyboardId;
              if (storyboardId) {
                console.log(`Completing generation for storyboard ${storyboardId}`);
                onComplete?.(storyboardId);
              } else {
                console.error(`No storyboardId found in completion data, cannot complete properly`);
                // Fall back to session ID, though this will likely cause errors
                onComplete?.(sessionId);
              }

              // Only do cleanup if we're still mounted
              if (isMountedRef.current) {
                onCleanup?.(sessionId);
              }
            }

            // Handle errors
            if (update.data.status === 'failed') {
              console.log(`Session ${sessionId} failed`);
              events.close();
              eventsRef.current = null;
              activeSessionRef.current = null;

              if (isMountedRef.current) {
                setIsGenerating(false);
              }

              onError?.('Generation failed. Please try again.');

              // Only do cleanup if we're still mounted
              if (isMountedRef.current) {
                onCleanup?.(sessionId);
              }
            }
          }
        } catch (error) {
          console.error(`Error parsing SSE message for session ${sessionId}:`, error);
        }
      };

      events.onerror = (error) => {
        // Skip processing if component has unmounted
        if (!isMountedRef.current) return;

        console.error(`SSE connection error for session ${sessionId}:`, error);
        events.close();
        eventsRef.current = null;
        activeSessionRef.current = null;

        if (isMountedRef.current) {
          setIsGenerating(false);
        }

        onError?.('Lost connection to server. Please try again.');

        // Only do cleanup if we're still mounted
        if (isMountedRef.current) {
          onCleanup?.(sessionId);
        }
      };

      // Cleanup function that only runs when sessionId changes or component unmounts
      return () => {
        // Skip the cleanup if we're just unmounting to avoid destroying an active connection
        // Only clean up if the session ID actually changed
        if (sessionId !== activeSessionRef.current) {
          console.log(`Cleaning up SSE connection for session ${sessionId} - session changed`);
          if (events) {
            events.close();
          }

          // Only call onCleanup if we're actually cleaning up the session
          // AND if component isn't unmounting
          if (isMountedRef.current && sessionId === activeSessionRef.current) {
            onCleanup?.(sessionId);
          }

          // Clear refs
          if (eventsRef.current === events) {
            eventsRef.current = null;
          }
        } else {
          console.log(`Skipping cleanup for session ${sessionId} during component updates`);
        }
      };
    } catch (error) {
      console.error(`Error setting up SSE for session ${sessionId}:`, error);

      if (eventsRef.current) {
        eventsRef.current.close();
        eventsRef.current = null;
      }

      activeSessionRef.current = null;

      if (isMountedRef.current) {
        setIsGenerating(false);
      }

      onError?.(`Error connecting to server: ${error instanceof Error ? error.message : 'Unknown error'}`);

      // Only do cleanup if we're still mounted
      if (isMountedRef.current) {
        onCleanup?.(sessionId);
      }

      return () => {};
    }
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
