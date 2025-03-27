import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMovie } from '../contexts/MovieContext';
import { MovieApi, StoryboardResponse, StoryboardScene } from '../services/movie.api';
import { AnimationApi, MovieStorageApi } from '../services/api';
import { Storyboard, MovieClip } from '../contexts/MovieContext';
import { AnimationRegistryHelpers } from '../hooks/useAnimationLoader';
import { useGenerationProgress } from './useGenerationProgress';

/**
 * Interface for generation progress state
 */
interface GenerationProgressState {
  current: number;
  total: number;
  status: 'initializing' | 'generating' | 'in_progress' | 'completed' | 'completed_with_errors' | 'failed';
}

// Add a proper type for the API response at the top of the file
interface AnimationGenerateResponse {
  svg: string;
  message: string;
  animationId?: string;
  movieUpdateStatus?: {
    storyboardId: string;
    clipId: string;
    sceneIndex: number;
    completedScenes: number;
    totalScenes: number;
    inProgress: boolean;
  };
}

type GenerationStatus = {
  inProgress: boolean;
  totalScenes: number;
  completedScenes: number;
  startingFromScene?: number;
};

type SceneGenerationError = {
  sceneIndex: number;
  error: string;
};

/**
 * Hook for managing storyboard generation
 */
export function useStoryboardGenerator(
  setShowGeneratingClipsModal: (show: boolean) => void,
  setShowStoryboardGeneratorModal: (show: boolean) => void,
  setShowErrorModal: (show: boolean) => void
) {
  const {
    currentStoryboard,
    setCurrentStoryboard,
    addClip,
    setActiveClipId,
    activeClipId
  } = useMovie();

  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<string | null>(null);

  // Use a ref to track if we're already polling an in-progress movie
  const isPollingRef = useRef<boolean>(false);

  // Verify final state matches backend
  const verifyFinalState = useCallback(async (storyboardId: string) => {
    if (!storyboardId) {
      console.error("Cannot verify final state: No storyboard ID provided");
      return;
    }

    try {
      console.log(`Verifying final state for storyboard ${storyboardId}`);

      const response = await MovieStorageApi.getMovie(storyboardId);
      if (response?.success && response.movie) {
        // Only update if there's a mismatch
        setCurrentStoryboard(prev => {
          if (JSON.stringify(prev.clips) !== JSON.stringify(response.movie.clips)) {
            console.log('Fixing clip state mismatch with backend');
            return response.movie;
          }
          return prev;
        });
      } else {
        console.warn(`Failed to verify final state: Movie not found or invalid response`);
      }
    } catch (error) {
      console.error('Error verifying final state:', error);
      // No need to show an error to the user in this case
      // This is just a final verification step that can fail without affecting the user experience
    }
  }, [setCurrentStoryboard]);

  // Handle new clip updates
  const handleNewClip = useCallback((clip: MovieClip) => {
    console.log("Handle new clip called:", clip.id);

    // Update the storyboard with the new clip
    setCurrentStoryboard(prev => {
      // Add the new clip and sort by order
      const updatedClips = [...prev.clips, clip].sort((a, b) => a.order - b.order);

      // Calculate new generation status
      const completedScenes = updatedClips.length;
      const totalScenes = prev.generationStatus?.totalScenes || 0;

      console.log(`Updated clip state: ${completedScenes}/${totalScenes} scenes completed`);

      // Update the generationStatus to keep UI in sync
      return {
        ...prev,
        clips: updatedClips,
        generationStatus: prev.generationStatus ? {
          ...prev.generationStatus,
          completedScenes,
          inProgress: completedScenes < totalScenes
        } : undefined
      };
    });

    // Select first clip if none selected
    if (!activeClipId) {
      setActiveClipId(clip.id);
    }
  }, [setCurrentStoryboard, activeClipId, setActiveClipId]);

  // Handle generation completion
  const handleComplete = useCallback((storyboardId: string) => {
    console.log(`Generation complete for storyboard: ${storyboardId}`);
    setShowGeneratingClipsModal(false);
    setShowStoryboardGeneratorModal(false);

    // Make sure the ID is valid and matches our current storyboard
    if (!storyboardId) {
      console.error("No storyboard ID provided to handleComplete");
      return;
    }

    // Check if the ID we received is a session ID instead of a storyboard ID
    // If our current storyboard ID doesn't match, but we have one, use that instead
    let targetStoryboardId = storyboardId;
    if (currentStoryboard?.id && currentStoryboard.id !== storyboardId) {
      console.log(`ID mismatch: received ${storyboardId} but current storyboard is ${currentStoryboard.id}, using current`);
      targetStoryboardId = currentStoryboard.id;
    }

    // Make sure we mark the generation as complete
    setCurrentStoryboard(prev => {
      if (!prev) return prev;

      console.log(`Updating storyboard ${targetStoryboardId} to completed status`);
      // Set the generation status to completed
      return {
        ...prev,
        generationStatus: prev.generationStatus ? {
          ...prev.generationStatus,
          inProgress: false,
          completedScenes: prev.clips.length,
          completedAt: new Date()
        } : undefined
      };
    });

    // Stop polling if we were doing that
    isPollingRef.current = false;

    // Double check with the server
    verifyFinalState(targetStoryboardId);
  }, [setShowGeneratingClipsModal, setShowStoryboardGeneratorModal, verifyFinalState, setCurrentStoryboard, currentStoryboard]);

  // Handle generation errors
  const handleError = useCallback((error: string) => {
    console.log('Generation error:', error);
    setGenerationError(error);
    setShowErrorModal(true);
    setShowGeneratingClipsModal(false);

    // Stop polling if we were doing that
    isPollingRef.current = false;
  }, [setGenerationError, setShowErrorModal, setShowGeneratingClipsModal]);

  // Handle session cleanup
  const handleCleanup = useCallback((sessionId: string) => {
    console.log(`Cleaning up session ${sessionId}`);
    // Only clear the session if it matches the current one
    setCurrentSession(current => sessionId === current ? null : current);
  }, []);

  // Use the new generation progress hook
  const {
    isGenerating,
    progress: generationProgress,
    setIsGenerating,
    setProgress: setGenerationProgress
  } = useGenerationProgress({
    sessionId: currentSession,
    onNewClip: handleNewClip,
    onComplete: handleComplete,
    onError: handleError,
    onCleanup: handleCleanup
  });

  // Add effect to check for in-progress generation when currentStoryboard changes
  useEffect(() => {
    // Skip this effect completely if we're actively generating or have an SSE connection
    if (isGenerating || currentSession) {
      console.log("Already monitoring generation, skipping setup", { isGenerating, currentSession });
      return;
    }

    // Also skip if we're already polling
    if (isPollingRef.current) {
      console.log("Already polling for movie updates, skipping duplicate setup");
      return;
    }

    console.log("Checking storyboard generation status:", {
      id: currentStoryboard?.id,
      name: currentStoryboard?.name,
      hasStatus: currentStoryboard?.generationStatus !== undefined,
      inProgress: currentStoryboard?.generationStatus?.inProgress,
      completedScenes: currentStoryboard?.generationStatus?.completedScenes,
      totalScenes: currentStoryboard?.generationStatus?.totalScenes,
      currentSession,
      isGenerating,
      isPolling: isPollingRef.current
    });

    // Only proceed if we have a storyboard with in-progress generation
    if (!currentStoryboard?.generationStatus?.inProgress) {
      console.log("Storyboard not in progress, skipping monitoring setup");
      return;
    }

    console.log("Detected in-progress generation for movie:", currentStoryboard.name);

    // For reopened movies, we need to set up polling since we don't have a valid session
    console.log("Setting up polling for reopened in-progress movie");

    // Mark that we're now polling
    isPollingRef.current = true;

    // But we still want to show the modal
    setShowGeneratingClipsModal(true);

    // Set isGenerating to ensure we show progress UI
    setIsGenerating(true);

    // Initialize progress from current storyboard status
    setGenerationProgress({
      current: currentStoryboard.generationStatus.completedScenes,
      total: currentStoryboard.generationStatus.totalScenes,
      status: 'in_progress' as const
    });

    console.log("Setting initial generation progress:", {
      current: currentStoryboard.generationStatus.completedScenes,
      total: currentStoryboard.generationStatus.totalScenes
    });

    // Set up an interval to check for updates - this is the same approach
    // we use with SSE but with direct API calls instead
    const intervalId = setInterval(async () => {
      try {
        // Only check if we're still polling and the storyboard exists
        if (!isPollingRef.current || !currentStoryboard?.id) {
          console.log("Polling stopped or storyboard missing, cleaning up interval");
          clearInterval(intervalId);
          return;
        }

        console.log(`Polling for updates on movie ${currentStoryboard.id}`);

        // Get latest movie data from server
        const response = await MovieStorageApi.getMovie(currentStoryboard.id);
        if (response?.success && response.movie) {
          console.log("Refreshed movie from server:", {
            name: response.movie.name,
            clipCount: response.movie.clips?.length || 0,
            completedScenes: response.movie.generationStatus?.completedScenes,
            inProgress: response.movie.generationStatus?.inProgress
          });

          // Only update if there's a change in generation status
          if (response.movie.generationStatus) {
            const { inProgress, completedScenes, totalScenes } = response.movie.generationStatus;

            // Update our state with the new data - reuse existing handleNewClip pattern
            if (response.movie.clips?.length > currentStoryboard.clips.length) {
              // Find new clips
              const existingClipIds = new Set(currentStoryboard.clips.map(c => c.id));
              const newClips = response.movie.clips.filter(c => !existingClipIds.has(c.id));

              // Process each new clip
              for (const clip of newClips) {
                console.log(`Found new clip in polling: ${clip.id}`);
                handleNewClip(clip);
              }
            } else {
              // If no new clips but status changed, update directly
              setCurrentStoryboard(response.movie);

              // Update progress display
              setGenerationProgress(prev => ({
                ...prev,
                current: completedScenes,
                total: totalScenes,
                status: !inProgress ? 'completed' : 'in_progress'
              }));
            }

            // If generation is complete, clean up
            if (!inProgress) {
              console.log("Polling detected generation completion, cleaning up");
              setIsGenerating(false);
              setShowGeneratingClipsModal(false);
              isPollingRef.current = false;
              clearInterval(intervalId);
            }
          }
        }
      } catch (error) {
        console.error("Error refreshing movie status:", error);
      }
    }, 2000); // Check every 2 seconds

    // Clean up the interval when the component unmounts or when polling is stopped
    return () => {
      console.log("Cleaning up polling interval");
      isPollingRef.current = false;
      clearInterval(intervalId);
    };
  }, [
    currentStoryboard?.id,
    currentStoryboard?.generationStatus,
    setShowGeneratingClipsModal,
    handleNewClip,
    setIsGenerating,
    setGenerationProgress,
    setCurrentStoryboard,
    currentSession,
    isGenerating
  ]);

  /**
   * Handle storyboard generation
   */
  const handleGenerateStoryboard = async (prompt: string, provider: 'openai' | 'claude' = 'openai', numScenes?: number) => {
    try {
      // Reset any previous state
      setGenerationError(null);
      isPollingRef.current = false;

      // Show the generating modal and hide the generator modal
      setShowGeneratingClipsModal(true);
      setShowStoryboardGeneratorModal(false);

      console.log("Initializing generation with prompt:", prompt);

      // Initialize generation session and create storyboard
      const initResponse = await fetch('/api/movie/generate/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ prompt, provider, numScenes })
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize generation');
      }

      const { sessionId, storyboard } = await initResponse.json();
      console.log(`Created new generation session: ${sessionId} for movie: ${storyboard.name} (${storyboard.id})`);

      // Set current session ID to establish SSE connection
      setCurrentSession(sessionId);

      // Set initial progress state
      setGenerationProgress({
        current: 0,
        total: storyboard.originalScenes?.length || 0,
        status: 'initializing'
      });

      // Set initial storyboard state
      setCurrentStoryboard(storyboard);

      // Start generation
      const startResponse = await fetch(`/api/movie/generate/${sessionId}/start`, {
        method: 'POST'
      });

      if (!startResponse.ok) {
        throw new Error('Failed to start generation');
      }

      console.log(`Started generation for session: ${sessionId}`);

    } catch (error) {
      console.error('Error during storyboard generation:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
      setShowErrorModal(true);
      setShowGeneratingClipsModal(false);
      setCurrentSession(null); // Clear the session on error
      isPollingRef.current = false; // Make sure polling is off
    }
  };

  /**
   * Add a post-generation synchronization check to ensure all clips
   * from Claude generations (which may have more network issues) are properly saved
   */
  const syncClipData = useCallback(async (storyboardId: string, clips: MovieClip[]) => {
    if (!storyboardId || !clips || clips.length === 0) {
      console.log('[POST_GEN_SYNC] No clips to synchronize');
      return;
    }

    console.log(`[POST_GEN_SYNC] Beginning clip data synchronization for ${clips.length} clips`);

    try {
      // Load the storyboard directly from the server to ensure we have the latest data
      const response = await MovieStorageApi.getMovie(storyboardId);

      if (!response || !response.success || !response.movie) {
        console.error(`[POST_GEN_SYNC] Failed to load storyboard ${storyboardId} for synchronization`);
        return;
      }

      const { movie } = response;

      // Verify all clips have been saved correctly in the movie
      const serverClips = movie.clips || [];
      console.log(`[POST_GEN_SYNC] Server has ${serverClips.length} clips vs. ${clips.length} in memory`);

      // Define a type for clip metadata
      interface ClipMeta {
        id: string;
        animationId?: string;
        svgContent: boolean;
      }

      // Build a map of orders to animationIds from our in-memory clips
      const memoryClipsMap = new Map<number, ClipMeta>(
        clips.map(clip => [clip.order, {
          id: clip.id,
          animationId: clip.animationId,
          svgContent: clip.svgContent ? true : false
        }])
      );

      // Build a map of orders to animationIds from server clips
      const serverClipsMap = new Map<number, ClipMeta>(
        serverClips.map(clip => [clip.order, {
          id: clip.id,
          animationId: clip.animationId,
          svgContent: clip.svgContent ? true : false
        }])
      );

      // Check for missing animation IDs in server data
      let needsUpdate = false;
      const updatedServerClips = [...serverClips];

      // Check all potential scene indices
      const memoryOrders = Array.from(memoryClipsMap.keys());
      const serverOrders = Array.from(serverClipsMap.keys());
      const maxOrder = Math.max(
        ...(memoryOrders.length > 0 ? memoryOrders : [0]),
        ...(serverOrders.length > 0 ? serverOrders : [0])
      );

      for (let order = 0; order <= maxOrder; order++) {
        const memoryClip = memoryClipsMap.get(order);
        const serverClip = serverClipsMap.get(order);

        // Skip if both are missing (no clip at this order)
        if (!memoryClip && !serverClip) continue;

        // Case 1: Server clip exists but memory clip doesn't - unexpected
        if (!memoryClip && serverClip) {
          console.log(`[POST_GEN_SYNC] Server has clip at order ${order} that's not in memory: ${serverClip.id}`);
          continue;
        }

        // Case 2: Memory clip exists but server clip doesn't - missing clip
        if (memoryClip && !serverClip) {
          console.warn(`[POST_GEN_SYNC] Memory has clip at order ${order} missing from server: ${memoryClip.id}`);

          // Find the clip from our in-memory array to get complete data
          const fullMemoryClip = clips.find(c => c.id === memoryClip.id);
          if (fullMemoryClip) {
            console.log(`[POST_GEN_SYNC] Adding missing clip at order ${order} to server data`);
            updatedServerClips.push(fullMemoryClip);
            needsUpdate = true;
          }
          continue;
        }

        // Case 3: Both exist but animationId is different or missing in server
        if (memoryClip && serverClip &&
            (!serverClip.animationId || serverClip.animationId !== memoryClip.animationId)) {
          console.warn(`[POST_GEN_SYNC] Animation ID mismatch at order ${order}: ` +
                      `server=${serverClip.animationId || 'MISSING'}, ` +
                      `memory=${memoryClip.animationId || 'MISSING'}`);

          // Find server clip to update
          const serverClipIndex = updatedServerClips.findIndex(c => c.id === serverClip.id);
          if (serverClipIndex !== -1 && memoryClip.animationId) {
            console.log(`[POST_GEN_SYNC] Updating animation ID for clip at order ${order}`);
            updatedServerClips[serverClipIndex].animationId = memoryClip.animationId;
            needsUpdate = true;
          }
        }
      }

      // If any updates were needed, save the changes
      if (needsUpdate) {
        console.log(`[POST_GEN_SYNC] Saving updated storyboard with ${updatedServerClips.length} clips`);
        const updatedMovie = {
          ...movie,
          clips: updatedServerClips
        };
        await MovieStorageApi.saveMovie(updatedMovie);
        console.log(`[POST_GEN_SYNC] Successfully saved synchronized clip data`);
      } else {
        console.log(`[POST_GEN_SYNC] No synchronization needed, all clips match`);
      }
    } catch (error) {
      console.error(`[POST_GEN_SYNC] Error during clip synchronization:`, error);
    }
  }, []);

  return {
    isGenerating,
    generationProgress,
    generationError,
    handleGenerateStoryboard,
    handleGenerationError: setGenerationError,
    syncClipData
  };
}

