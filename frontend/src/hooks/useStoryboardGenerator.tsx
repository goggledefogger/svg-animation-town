import { useState, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMovie } from '../contexts/MovieContext';
import { MovieApi, StoryboardResponse, StoryboardScene } from '../services/movie.api';
import { AnimationApi, MovieStorageApi } from '../services/api';
import { Storyboard, MovieClip } from '../contexts/MovieContext';
import { AnimationRegistryHelpers } from '../hooks/useAnimationLoader';

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

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressState>({
    current: 0,
    total: 0,
    status: 'initializing'
  });
  const [generationError, setGenerationError] = useState<string | null>(null);
  const [currentSession, setCurrentSession] = useState<string | null>(null);

  // Cleanup function for SSE connection
  const cleanupSession = useCallback(async (sessionId: string) => {
    try {
      await fetch(`/api/movie/generate/${sessionId}`, { method: 'DELETE' });
    } catch (error) {
      console.error('Error cleaning up session:', error);
    }
  }, []);

  // Effect to cleanup session on unmount
  useEffect(() => {
    return () => {
      if (currentSession) {
        cleanupSession(currentSession);
      }
    };
  }, [currentSession, cleanupSession]);

  /**
   * Handle storyboard generation
   */
  const handleGenerateStoryboard = async (prompt: string, provider: 'openai' | 'claude' = 'openai', numScenes?: number) => {
    try {
      setIsGenerating(true);
      setShowGeneratingClipsModal(true);
      setGenerationError(null);

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
      setCurrentSession(sessionId);

      // Set initial storyboard state
      setCurrentStoryboard(storyboard);

      // Set up SSE connection for progress updates
      const events = new EventSource(`/api/movie/generate/${sessionId}/progress`);

      events.onmessage = (event) => {
        const update = JSON.parse(event.data);

        if (update.type === 'progress') {
          setGenerationProgress(update.data);

          // Handle new clip updates
          if (update.data.newClip) {
            const { clip } = update.data.newClip;
            // Add clip to storyboard
            setCurrentStoryboard(prev => ({
              ...prev,
              clips: [...prev.clips, clip].sort((a, b) => a.order - b.order)
            }));

            // Select first clip if none selected
            if (!activeClipId) {
              setActiveClipId(clip.id);
            }
          }

          // Handle completion
          if (update.data.status === 'completed' || update.data.status === 'completed_with_errors') {
            events.close();
            setIsGenerating(false);
            setShowGeneratingClipsModal(false);
            setShowStoryboardGeneratorModal(false);

            // Verify final state with backend
            verifyFinalState(storyboard.id);

            cleanupSession(sessionId);
          }

          // Handle errors
          if (update.data.status === 'failed') {
            events.close();
            setGenerationError('Generation failed. Please try again.');
            setShowErrorModal(true);
            setIsGenerating(false);
            setShowGeneratingClipsModal(false);
            cleanupSession(sessionId);
          }
        }
      };

      events.onerror = () => {
        events.close();
        setGenerationError('Lost connection to server. Please try again.');
        setShowErrorModal(true);
        setIsGenerating(false);
        setShowGeneratingClipsModal(false);
        if (sessionId) {
          cleanupSession(sessionId);
        }
      };

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
      setIsGenerating(false);
      setShowGeneratingClipsModal(false);
    }
  };

  // Verify final state matches backend
  const verifyFinalState = async (storyboardId: string) => {
    try {
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
      }
    } catch (error) {
      console.error('Error verifying final state:', error);
    }
  };

  /**
   * Handle generation errors by updating the storyboard status
   */
  const handleGenerationError = (error: unknown) => {
    console.error('Error processing storyboard:', error);

    // Update storyboard to mark the error
    setCurrentStoryboard(prevStoryboard => {
      const errorStoryboard = {
        ...prevStoryboard,
        updatedAt: new Date()
      };

      // Direct save of error state using the same ID to prevent creating a new file
      console.log(`Saving error state for storyboard with ID ${errorStoryboard.id}`);
      setTimeout(() => {
        MovieStorageApi.saveMovie(errorStoryboard)
          .then(result => {
            console.log(`Error state saved with ID: ${result.id}`);
          })
          .catch(err => {
            console.error('Error saving storyboard error state:', err);
          });
      }, 0);

      return errorStoryboard;
    });

    // Extract the error message
    const errorMsg = error instanceof Error ? error.message : 'Unknown error processing storyboard';
    console.error(`Generation failed: ${errorMsg}`);

    // Only set error and show modal for complete failures
    setGenerationError(errorMsg);
    setShowErrorModal(true);

    // Hide modals and reset state
    setShowGeneratingClipsModal(false);
    setIsGenerating(false);
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
    handleGenerationError,
    syncClipData
  };
}
