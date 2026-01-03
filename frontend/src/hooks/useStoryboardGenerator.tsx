import { useState, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMovie } from '../contexts/MovieContext';
import { StoryboardResponse, StoryboardScene } from '../services/movie.api';
import { AnimationApi, MovieStorageApi } from '../services/api';
import { Storyboard, MovieClip } from '../contexts/MovieContext';
import { AnimationRegistryHelpers } from '../hooks/useAnimationLoader';
import { useGenerationProgress } from './useGenerationProgress';
import { useAnimation } from '../contexts/AnimationContext';
import type { AIProviderId } from '@/types/ai';

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
  status?: string;
  activeSessionId?: string;
  currentSceneIndex?: number;
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

  const { aiProvider: globalProvider, aiModel: globalModel } = useAnimation();

  // State for tracking generation progress and error
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<string | null>(null);

  // Use a ref to track if we're already polling an in-progress movie
  const isPollingRef = useRef<boolean>(false);
  // Track the polling interval ID for conditional polling
  const conditionalPollingIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const lastErrorRef = useRef<string | null>(null);

  // Clear conditional polling interval
  const clearConditionalPolling = useCallback(() => {
    if (conditionalPollingIntervalRef.current) {
      clearInterval(conditionalPollingIntervalRef.current);
      conditionalPollingIntervalRef.current = null;
    }
  }, []);

  // Verify final state matches backend (with retry limit to prevent infinite recursion)
  const MAX_VERIFY_RETRIES = 5;
  const verifyFinalState = useCallback(async (storyboardId: string, retryCount = 0): Promise<void> => {
    if (!storyboardId) {
      console.error("Cannot verify final state: No storyboard ID provided");
      return;
    }

    try {
      const response = await MovieStorageApi.getMovie(storyboardId);

      if (response?.success && response.movie) {
        // Only update if there's a mismatch and the movie has clips
        if (response.movie.clips && response.movie.clips.length > 0) {
          setCurrentStoryboard(prev => {
            if (JSON.stringify(prev.clips) !== JSON.stringify(response.movie.clips)) {
              return response.movie;
            }
            return prev;
          });
        } else if (retryCount < MAX_VERIFY_RETRIES) {
          // Wait a bit and try again if no clips are present (with retry limit)
          console.log(`[verifyFinalState] No clips yet, retry ${retryCount + 1}/${MAX_VERIFY_RETRIES}`);
          await new Promise(resolve => setTimeout(resolve, 2000));
          await verifyFinalState(storyboardId, retryCount + 1);
          return;
        } else {
          console.warn(`[verifyFinalState] Max retries reached, giving up`);
        }
      } else {
        console.warn(`Failed to verify final state: Movie not found or invalid response`);
      }
    } catch (error: unknown) {
      console.error('Error verifying final state:', error);
    }
  }, [setCurrentStoryboard]);

  // Handle generation completion
  const handleComplete = useCallback((storyboardId: string) => {
    // Make sure the ID is valid
    if (!storyboardId) {
      console.error("No storyboard ID provided to handleComplete");
      return;
    }

    // Stop polling if we were doing that
    isPollingRef.current = false;
    clearConditionalPolling();

    // Update the storyboard state immediately to prevent infinite SSE reconnections
    setCurrentStoryboard(prev => {
      if (!prev) return prev;

      return {
        ...prev,
        generationStatus: prev.generationStatus ? {
          ...prev.generationStatus,
          inProgress: false,
          completedScenes: prev.clips.length,
          completedAt: new Date(),
          status: 'completed',
          activeSessionId: undefined // Clear the session ID to prevent reconnection
        } : undefined
      };
    });

    // Use a coordinated approach to prevent flickering:
    // 1. First verify the final state to ensure we have all clips
    // 2. Then close modals and select the first clip in a single batch
    verifyFinalState(storyboardId).then(() => {
      // Find the first clip to select
      let firstClipId: string | null = null;
      if (currentStoryboard?.clips && currentStoryboard.clips.length > 0) {
        const sortedClips = [...currentStoryboard.clips].sort((a, b) => a.order - b.order);
        if (sortedClips[0]?.id) {
          firstClipId = sortedClips[0].id;
        }
      }

      // Close modals and select first clip in a coordinated way to prevent flicker
      // Use requestAnimationFrame to batch these updates together
      requestAnimationFrame(() => {
        // First close modals
        setShowGeneratingClipsModal(false);
        setShowStoryboardGeneratorModal(false);

        // Then select first clip if we found one
        if (firstClipId) {
          setActiveClipId(firstClipId);
        }
      });
    }).catch((error: unknown) => {
      console.error('Error verifying final state:', error);
      // If verification fails, still close modals to prevent being stuck
      setShowGeneratingClipsModal(false);
      setShowStoryboardGeneratorModal(false);
    });
  }, [setShowGeneratingClipsModal, setShowStoryboardGeneratorModal, verifyFinalState, setCurrentStoryboard, currentStoryboard, setActiveClipId, clearConditionalPolling]);

  // Handle new clip updates
  const handleNewClip = useCallback((clip: MovieClip) => {
    // Update the storyboard with the new clip
    setCurrentStoryboard(prev => {
      // Check if the clip already exists in the storyboard
      const existingClipIndex = prev.clips.findIndex(c => c.id === clip.id);

      // If the clip already exists, don't add it again
      if (existingClipIndex !== -1) {
        return prev;
      }

      // Add the new clip and sort by order
      const updatedClips = [...prev.clips, clip].sort((a, b) => a.order - b.order);

      // Calculate new generation status
      const completedScenes = updatedClips.length;
      const totalScenes = prev.generationStatus?.totalScenes || 0;

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

  // Handle generation errors
  const handleError = useCallback((error: string) => {
    console.error('Generation error:', error);
    setGenerationError(error);
    setShowErrorModal(true);
    setShowGeneratingClipsModal(false);

    // Stop polling if we were doing that
    isPollingRef.current = false;
  }, [setGenerationError, setShowErrorModal, setShowGeneratingClipsModal]);

  // Handle session cleanup
  const handleCleanup = useCallback((sessionId: string) => {
    // Only clear the session if it matches the current one
    setCurrentSession(current => sessionId === current ? null : current);
    // Ensure modals are closed on cleanup
    setShowGeneratingClipsModal(false);
    setShowStoryboardGeneratorModal(false);
  }, [setShowGeneratingClipsModal, setShowStoryboardGeneratorModal]);

  // Use the new generation progress hook
  const {
    isGenerating,
    progress: generationProgress,
    setIsGenerating,
    setProgress: setGenerationProgress,
    processedClipIdsRef
  } = useGenerationProgress({
    sessionId: currentSession,
    onNewClip: handleNewClip,
    onComplete: handleComplete,
    onError: handleError,
    onCleanup: handleCleanup
  });

  // Add effect to check for in-progress generation when currentStoryboard changes
  useEffect(() => {
    // Skip this effect completely if we have an active SSE connection
    if (currentSession) {
      return;
    }

    // This useEffect is intended to sync the storyboard status with our local state
    if (!currentStoryboard || !currentStoryboard.generationStatus) {
      return;
    }

    // Only proceed if we have a storyboard with in-progress generation
    if (!currentStoryboard.generationStatus.inProgress) {
      return;
    }

    // Clear any existing conditional polling
    clearConditionalPolling();

    // Set isGenerating to ensure we show progress UI
    // Note: We always call this since the condition above ensures generation is in progress
    setIsGenerating(true);

    // But we still want to show the modal
    setShowGeneratingClipsModal(true);

    // Initialize progress from current storyboard status
    setGenerationProgress({
      current: currentStoryboard.generationStatus.completedScenes,
      total: currentStoryboard.generationStatus.totalScenes,
      status: 'in_progress' as const
    });

    // Check if we have an activeSessionId
    if (currentStoryboard.generationStatus.activeSessionId) {
      // If we have an active session ID, connect to SSE directly
      setCurrentSession(currentStoryboard.generationStatus.activeSessionId);

      // No need for polling
      return;
    }

    // Create a stable storyboard ID reference to use in the interval
    const storyboardId = currentStoryboard.id;

    // Start conditional polling interval
    conditionalPollingIntervalRef.current = setInterval(async () => {
      try {
        // Get latest movie data from server
        const response = await MovieStorageApi.getMovie(storyboardId);

        if (!response?.success || !response.movie) {
          console.warn("Failed to refresh movie data from server");
          return;
        }

        // Check if generation has completed
        if (response.movie.generationStatus && !response.movie.generationStatus.inProgress) {
          // Update our storyboard with the server state
          setCurrentStoryboard(response.movie);

          // Update UI state
          setIsGenerating(false);
          setShowGeneratingClipsModal(false);

          // Clear the polling interval
          clearConditionalPolling();
          return;
        }

        // Check if an activeSessionId is now available
        if (response.movie.generationStatus?.activeSessionId) {
          // Set the session ID to connect to SSE
          setCurrentSession(response.movie.generationStatus.activeSessionId);

          // Update our storyboard with the server state
          setCurrentStoryboard(response.movie);

          // Make sure UI state is correct
          setIsGenerating(true);

          // Clear the polling interval since SSE will take over
          clearConditionalPolling();
          return;
        }

        // If we get here, the movie is still in progress but no activeSessionId yet
        // Continue polling until one of the above conditions is met

        // Update our storyboard with any changes from the server (like new clips)
        // Use functional update to avoid stale closure - compare with latest state
        setCurrentStoryboard(prev => {
          if (response.movie.clips?.length !== prev.clips?.length) {
            // Update progress display when clips change
            if (response.movie.generationStatus) {
              setGenerationProgress(prevProgress => ({
                ...prevProgress,
                current: response.movie.generationStatus?.completedScenes || 0,
                total: response.movie.generationStatus?.totalScenes || 0
              }));
            }
            return response.movie;
          }
          return prev;
        });
      } catch (error) {
        console.error("Error in conditional polling:", error);
      }
    }, 6000); // Poll every 6 seconds

    // Clean up interval when component unmounts or when the currentStoryboard changes
    return () => {
      clearConditionalPolling();
    };
  }, [
    currentStoryboard?.id,
    currentSession,
    setShowGeneratingClipsModal,
    setIsGenerating,
    setGenerationProgress,
    setCurrentStoryboard,
    clearConditionalPolling
  ]);

  /**
   * Handle storyboard generation
   */
  const handleGenerateStoryboard = useCallback(async (
    prompt: string,
    selection?: { provider: AIProviderId; model: string },
    numScenes?: number
  ): Promise<void> => {
    try {
      // Reset any previous state
      setGenerationError(null);
      isPollingRef.current = false;

      // Set initial progress state to 0/0 before showing the modal
      setGenerationProgress({
        current: 0,
        total: 0,
        status: 'initializing'
      });

      // Show the generating modal and hide the generator modal
      setShowGeneratingClipsModal(true);
      setShowStoryboardGeneratorModal(false);

      const provider = selection?.provider ?? globalProvider;
      const model = selection?.model ?? globalModel;

      // Initialize generation session and create storyboard
      const initResponse = await fetch('/api/movie/generate/initialize', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          prompt,
          provider,
          model,
          numScenes,
          // If we have a current storyboard and it's in initializing state, reuse it
          existingMovieId: currentStoryboard?.generationStatus?.status === 'initializing' ? currentStoryboard.id : undefined
        })
      });

      if (!initResponse.ok) {
        throw new Error('Failed to initialize generation');
      }

      const { sessionId, storyboard } = await initResponse.json();

      if (storyboard) {
        storyboard.aiProvider = storyboard.aiProvider || provider;
        storyboard.aiModel = storyboard.aiModel || model;
        if (Array.isArray(storyboard.originalScenes)) {
          storyboard.originalScenes = storyboard.originalScenes.map((scene: StoryboardScene) => ({
            ...scene,
            provider: scene.provider ?? provider,
            model: (scene as any).model ?? model
          }));
        }
      }

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

    } catch (error) {
      console.error('Error during storyboard generation:', error);
      setGenerationError(error instanceof Error ? error.message : 'Unknown error');
      setShowErrorModal(true);
      setShowGeneratingClipsModal(false);
      setCurrentSession(null); // Clear the session on error
      isPollingRef.current = false; // Make sure polling is off
    }
  }, [
    currentStoryboard?.generationStatus?.status,
    currentStoryboard?.id,
    globalModel,
    globalProvider,
    setGenerationError,
    setGenerationProgress,
    setShowGeneratingClipsModal,
    setShowStoryboardGeneratorModal,
    setCurrentStoryboard,
    setCurrentSession,
    setShowErrorModal
  ]);

  /**
   * Add a post-generation synchronization check to ensure all clips
   * from Claude generations (which may have more network issues) are properly saved
   */
  const syncClipData = useCallback(async (storyboardId: string, clips: MovieClip[]) => {
    if (!storyboardId || !clips || clips.length === 0) {
      return;
    }

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
          continue;
        }

        // Case 2: Memory clip exists but server clip doesn't - missing clip
        if (memoryClip && !serverClip) {
          // Find the clip from our in-memory array to get complete data
          const fullMemoryClip = clips.find(c => c.id === memoryClip.id);
          if (fullMemoryClip) {
            updatedServerClips.push(fullMemoryClip);
            needsUpdate = true;
          }
          continue;
        }

        // Case 3: Both exist but animationId is different or missing in server
        if (memoryClip && serverClip &&
          (!serverClip.animationId || serverClip.animationId !== memoryClip.animationId)) {

          // Find server clip to update
          const serverClipIndex = updatedServerClips.findIndex(c => c.id === serverClip.id);
          if (serverClipIndex !== -1 && memoryClip.animationId) {
            updatedServerClips[serverClipIndex].animationId = memoryClip.animationId;
            needsUpdate = true;
          }
        }
      }

      // If any updates were needed, save the changes
      if (needsUpdate) {
        const updatedMovie = {
          ...movie,
          clips: updatedServerClips
        };
        await MovieStorageApi.saveMovie(updatedMovie);
      }
    } catch (error) {
      console.error(`[POST_GEN_SYNC] Error during clip synchronization:`, error);
    }
  }, []);

  // Add polling functionality
  const startPolling = useCallback(() => {
    if (isPollingRef.current) return;
    isPollingRef.current = true;

    const pollInterval = setInterval(async () => {
      if (!currentStoryboard?.id) {
        clearInterval(pollInterval);
        isPollingRef.current = false;
        return;
      }

      try {
        const response = await MovieStorageApi.getMovie(currentStoryboard.id);
        if (response?.movie?.generationStatus) {
          const { completedScenes, totalScenes, inProgress } = response.movie.generationStatus;

          setGenerationProgress({
            current: completedScenes || 0,
            total: totalScenes || 0,
            status: inProgress ? 'in_progress' : 'completed'
          });

          if (!inProgress) {
            clearInterval(pollInterval);
            isPollingRef.current = false;
            setIsGenerating(false);
          }
        }
      } catch (error) {
        console.error('Error polling movie status:', error);
      }
    }, 5000); // Poll every 5 seconds

    return () => {
      clearInterval(pollInterval);
      isPollingRef.current = false;
    };
  }, [currentStoryboard?.id]);

  // Check storyboard generation status and resume if needed
  useEffect(() => {
    if (!currentStoryboard?.id) return;

    const checkGenerationStatus = async () => {
      // If there's no generation status, nothing to do
      if (!currentStoryboard.generationStatus) return;

      const {
        inProgress,
        status,
        completedScenes,
        totalScenes,
        activeSessionId
      } = currentStoryboard.generationStatus;

      // If generation is not in progress, nothing to do
      if (!inProgress) return;

      // Update UI state to show generation in progress
      setIsGenerating(true);
      setGenerationProgress({
        current: completedScenes || 0,
        total: totalScenes || 0,
        status: (status as GenerationProgressState['status']) || 'in_progress'
      });

      // If we have an active session ID, set it up for SSE
      if (activeSessionId) {
        setCurrentSession(activeSessionId);

        // If the status is still 'initializing', we need to call start
        if (status === 'initializing') {
          try {
            // Start generation
            const startResponse = await fetch(`/api/movie/generate/${activeSessionId}/start`, {
              method: 'POST'
            });

            if (!startResponse.ok) {
              throw new Error('Failed to start generation');
            }
          } catch (error) {
            console.error('[GENERATION_FLOW] Error starting generation for existing session:', error);
            setGenerationError(error instanceof Error ? error.message : 'Unknown error occurred');
          }
        }

        return;
      }

      // If we're in initializing state, we need to restart generation
      if (status === 'initializing' && currentStoryboard.originalScenes) {
        try {
          // Initialize new generation session but reuse existing movie
          const initResponse = await fetch('/api/movie/generate/initialize', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
              prompt: currentStoryboard.description,
              provider: currentStoryboard.aiProvider || globalProvider,
              model: currentStoryboard.aiModel || globalModel,
              numScenes: currentStoryboard.originalScenes.length,
              existingMovieId: currentStoryboard.id // Pass the existing movie ID to reuse it
            })
          });

          if (!initResponse.ok) {
            throw new Error('Failed to initialize generation');
          }

          const { sessionId } = await initResponse.json();

          // Set current session ID to establish SSE connection
          setCurrentSession(sessionId);

          // Start generation
          const startResponse = await fetch(`/api/movie/generate/${sessionId}/start`, {
            method: 'POST'
          });

          if (!startResponse.ok) {
            throw new Error('Failed to start generation');
          }

          return;
        } catch (error) {
          console.error('[GENERATION_RECOVERY] Error restarting generation:', error);
          setGenerationError(error instanceof Error ? error.message : 'Unknown error occurred');
        }
      }

      // If we get here, we're in progress but have no active session
      startPolling();
    };

    checkGenerationStatus();
  }, [currentStoryboard?.id, globalProvider, globalModel, startPolling]);

  return {
    isGenerating,
    generationProgress,
    generationError,
    handleGenerateStoryboard,
    handleGenerationError: setGenerationError,
    syncClipData
  };
}
