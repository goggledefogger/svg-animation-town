import { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMovie } from '../contexts/MovieContext';
import { MovieApi, StoryboardResponse, StoryboardScene } from '../services/movie.api';
import { AnimationApi, MovieStorageApi } from '../services/api';
import { Storyboard, MovieClip } from '../contexts/MovieContext';

/**
 * Interface for generation progress state
 */
interface GenerationProgressState {
  current: number;
  total: number;
  resumedFrom?: number;
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
    setActiveClipId
  } = useMovie();

  const [isGenerating, setIsGenerating] = useState(false);
  const [generationProgress, setGenerationProgress] = useState<GenerationProgressState>({
    current: 0,
    total: 0
  });
  const [generationError, setGenerationError] = useState<string | null>(null);

  const updateGenerationProgress = (completedIndex: number | null, total: number, resumedFrom?: number) => {
    setGenerationProgress(prev => {
      // When starting generation, just set the total and starting point
      if (completedIndex === null) {
        return {
          current: resumedFrom || 0,
          total,
          resumedFrom
        };
      }

      // When a scene completes, increment the counter by 1
      return {
        current: prev.current + 1,
        total,
        resumedFrom
      };
    });
  };

  /**
   * Generate a storyboard based on a prompt
   */
  const handleGenerateStoryboard = async (prompt: string, aiProvider: 'openai' | 'claude', numScenes?: number) => {
    try {
      // Reset any previous errors
      setGenerationError(null);

      // First set loading state for the initial storyboard generation
      setIsGenerating(true);

      // Call the API to generate a storyboard
      const response = await MovieApi.generateStoryboard(prompt, aiProvider, numScenes);

      // Close the generator modal
      setShowStoryboardGeneratorModal(false);

      // Process the storyboard response
      await processStoryboard(response, aiProvider);
    } catch (error) {
      console.error('Error generating storyboard:', error);

      // Extract error message
      let errorMessage = 'An unexpected error occurred while generating the storyboard.';

      if (error instanceof Error) {
        errorMessage = error.message;
      } else if (typeof error === 'object' && error !== null && 'message' in error) {
        errorMessage = (error as {message: string}).message;
      }

      // If it's a response error with details
      if (typeof error === 'object' && error !== null && 'response' in error) {
        const responseError = error as {response?: {data?: {error?: string}}};
        if (responseError.response?.data?.error) {
          errorMessage = responseError.response.data.error;
        }
      }

      // Set error and show error modal
      setGenerationError(errorMessage);
      setShowErrorModal(true);

      // Hide progress modals
      setShowGeneratingClipsModal(false);
      setIsGenerating(false);
    }
  };

  /**
   * Resume storyboard generation from where it left off
   */
  const resumeStoryboardGeneration = async (
    storyboard: Storyboard,
    storyboardResponse: StoryboardResponse,
    aiProvider: 'openai' | 'claude'
  ) => {
    console.log('Resuming storyboard generation from scene:', storyboard.generationStatus?.completedScenes || 0);

    try {
      // Ensure we have clips array
      if (!storyboard.clips) {
        storyboard.clips = [];
      }

      // Get a list of orders from existing clips to avoid regenerating them
      const existingClipOrders = new Set(storyboard.clips.map(clip => clip.order));

      // Calculate the next scene index to generate based on existing clips
      let startSceneIndex = 0;

      // If we have existing clips, find the highest order + 1
      if (storyboard.clips.length > 0) {
        const highestOrder = Math.max(...Array.from(existingClipOrders));
        startSceneIndex = highestOrder + 1;
      }

      // Validate scenes are available
      if (!storyboardResponse.scenes || storyboardResponse.scenes.length === 0) {
        throw new Error('No scenes available for resumption');
      }

      // Verify scene data is complete
      storyboardResponse.scenes.forEach((scene, idx) => {
        if (!scene.svgPrompt) {
          throw new Error(`Invalid scene data at index ${idx}: missing svgPrompt`);
        }
      });

      // Skip already completed scenes
      const remainingScenes = storyboardResponse.scenes.slice(startSceneIndex);

      // Filter scenes that still need generation
      const scenesNeedingGeneration = remainingScenes.filter((_, index) => {
        const absoluteIndex = index + startSceneIndex;
        const hasExistingClip = existingClipOrders.has(absoluteIndex);
        return !hasExistingClip; // Only keep scenes without existing clips
      });

      // If no scenes left to generate, just mark as complete
      if (scenesNeedingGeneration.length === 0) {
        console.log('No remaining scenes to generate, marking as complete');

        // Update status to completed
        setCurrentStoryboard(prevStoryboard => {
          const finalStoryboard = {
            ...prevStoryboard,
            updatedAt: new Date(),
            generationStatus: {
              ...prevStoryboard.generationStatus!,
              inProgress: false,
              completedAt: new Date()
            }
          };

          // Don't call MovieStorageApi.saveMovie directly during state update
          // Instead, return the new state and save outside the state update
          setTimeout(() => {
            MovieStorageApi.saveMovie(finalStoryboard)
              .catch(err => console.error('Error saving completed storyboard:', err));
          }, 0);

          return finalStoryboard;
        });

        setIsGenerating(false);
        setShowGeneratingClipsModal(false);
        return;
      }

      console.log(`Found ${scenesNeedingGeneration.length} remaining scenes to generate`);

      // Create modified response with only remaining scenes
      const resumedResponse = {
        ...storyboardResponse,
        scenes: scenesNeedingGeneration,
        // Keep original scene count for correct progress display
        originalSceneCount: storyboardResponse.scenes.length
      };

      // Process the remaining scenes - pass true for isResuming
      await processStoryboard(resumedResponse, aiProvider, startSceneIndex, true);
    } catch (error) {
      console.error('Error resuming storyboard generation:', error);

      // Update the storyboard to mark generation as failed
      setCurrentStoryboard(prevStoryboard => {
        const updatedStoryboard = {
          ...prevStoryboard,
          updatedAt: new Date(),
          generationStatus: {
            ...prevStoryboard.generationStatus!,
            inProgress: false,
            error: error instanceof Error ? error.message : 'Unknown error resuming generation'
          }
        };

        // Save the updated status
        setTimeout(() => {
          MovieStorageApi.saveMovie(updatedStoryboard)
            .catch(err => console.error('Error saving storyboard with error status:', err));
        }, 0);

        return updatedStoryboard;
      });

      setGenerationError(error instanceof Error ? error.message : 'Unknown error resuming generation');
      setShowErrorModal(true);
      setIsGenerating(false);
      setShowGeneratingClipsModal(false);
    }
  };

  /**
   * Process a storyboard response into clips
   */
  const processStoryboard = async (
    storyboard: StoryboardResponse,
    aiProvider: 'openai' | 'claude',
    startingSceneIndex = 0,
    isResuming = false
  ) => {
    console.log('Beginning storyboard generation...');

    // CRITICAL FIX: If there are no scenes to process, bail out early
    if (!storyboard.scenes || storyboard.scenes.length === 0) {
      console.log('No scenes to process, skipping generation');

      // If we're resuming, just mark the storyboard as complete
      if (isResuming && currentStoryboard) {
        setCurrentStoryboard(prevStoryboard => {
          const completedStoryboard = {
            ...prevStoryboard,
            updatedAt: new Date(),
            generationStatus: {
              ...prevStoryboard.generationStatus!,
              inProgress: false,
              completedAt: new Date()
            }
          };

          // Don't call MovieStorageApi.saveMovie directly during state update
          // Instead, return the new state and save outside the state update
          setTimeout(() => {
            MovieStorageApi.saveMovie(completedStoryboard)
              .catch(err => console.error('Error saving completed storyboard:', err));
          }, 0);

          return completedStoryboard;
        });
      }

      // Hide modals and reset state
      setShowGeneratingClipsModal(false);
      setIsGenerating(false);
      return;
    }

    // If we're starting from the beginning, create a new storyboard
    let storyboardId: string;
    let newStoryboard: Storyboard;

    if (startingSceneIndex === 0 && !isResuming) {
      // Create a new storyboard
      storyboardId = uuidv4();
      console.log(`Created new storyboard with ID: ${storyboardId}`);

      newStoryboard = {
        id: storyboardId,
        name: storyboard.title || 'New Movie',
        description: storyboard.description || '',
        clips: [],
        createdAt: new Date(),
        updatedAt: new Date(),
        // Store the aiProvider so we know which to use for resuming
        aiProvider: aiProvider,
        // Store the original scenes to use for resuming
        originalScenes: storyboard.scenes,
        generationStatus: {
          inProgress: true,
          startedAt: new Date(),
          totalScenes: storyboard.scenes.length,
          completedScenes: 0
        }
      };
    } else {
      // We're resuming an existing storyboard or continuing from a non-zero index
      if (isResuming) {
        console.log(`Continuing with existing storyboard ID: ${currentStoryboard!.id} (resume operation)`);
        console.log(`Preserving ${currentStoryboard!.clips.length} existing clips`);
      } else {
        console.log(`Continuing from scene ${startingSceneIndex} with storyboard ID: ${currentStoryboard!.id}`);
      }

      storyboardId = currentStoryboard!.id;

      // CRITICAL FIX: We need to make a deep copy of existing clips to ensure we preserve them
      const existingClips = currentStoryboard!.clips ?
        JSON.parse(JSON.stringify(currentStoryboard!.clips)) : [];

      // Log the existing clips we're preserving (important for debugging)
      console.log(`Preserving ${existingClips.length} existing clips during resume/continue`);

      // Use the current storyboard as starting point - WITH the existing clips
      newStoryboard = {
        ...currentStoryboard!,
        updatedAt: new Date(),
        // CRITICAL: Ensure we preserve the existing clips
        clips: existingClips,
        generationStatus: {
          ...currentStoryboard!.generationStatus!,
          inProgress: true,
          // Update completedScenes to match the actual number of clips
          completedScenes: startingSceneIndex
        }
      };

      // If we don't have original scenes yet, store them
      if (!newStoryboard.originalScenes) {
        newStoryboard.originalScenes = storyboard.scenes;
      }
    }

    try {
      // Save the storyboard and wait for it to complete before starting generation
      console.log('Saving initial/resumed storyboard to server...');
      const savedResult = await MovieStorageApi.saveMovie(newStoryboard);
      console.log(`Initial/resumed storyboard saved to server with ID: ${savedResult.id}`);

      // Always use the server-assigned ID
      newStoryboard.id = savedResult.id;
      storyboardId = savedResult.id;

      // Update current storyboard state
      setCurrentStoryboard(newStoryboard);
      setShowGeneratingClipsModal(true);

      // Track scene generation errors
      const errors: SceneGenerationError[] = [];

      // Track successful clips locally to avoid state timing issues
      let successfulClipsCount = 0;

      // Process scenes in parallel with appropriate concurrency
      // For OpenAI we limit concurrency on the client side
      // For Claude we let the server's rate limiter handle it completely
      const totalScenes = storyboard.scenes.length;
      // If we're resuming and have originalSceneCount, use that for total scene count
      const totalScenesForProgress = (storyboard as any).originalSceneCount || totalScenes;

      // Update the initial progress with the correct total
      updateGenerationProgress(
        null, // null indicates initialization rather than completion
        totalScenesForProgress, // Use the consistent total count for progress
        startingSceneIndex > 0 ? startingSceneIndex : undefined
      );

      // Create an array to track which scenes have been processed to avoid duplicates
      const processedScenes = new Set<number>();

      // In a parallel approach, we process all scenes concurrently for Claude,
      // while using a controlled batch size for OpenAI
      const scenePromises = storyboard.scenes.map((scene, index) => {
        return () => generateScene(scene, index);
      });

      // Function to generate a single scene
      const generateScene = async (scene: StoryboardScene, index: number): Promise<void> => {
        const absoluteSceneIndex = index + startingSceneIndex;

        // Skip if already processed to prevent duplicate processing
        if (processedScenes.has(absoluteSceneIndex)) {
          return;
        }

        // Skip if this scene already has a clip with matching order
        const existingClipWithOrder = newStoryboard.clips.find(clip => clip.order === absoluteSceneIndex);
        if (existingClipWithOrder) {
          processedScenes.add(absoluteSceneIndex);
          updateGenerationProgress(
            absoluteSceneIndex,
            totalScenesForProgress,
            startingSceneIndex > 0 ? startingSceneIndex : undefined
          );
          successfulClipsCount++;
          return;
        }

        processedScenes.add(absoluteSceneIndex);

        try {
          console.log(`Generating SVG for scene ${absoluteSceneIndex+1}/${startingSceneIndex + totalScenesForProgress}: ${scene.id || 'Untitled'}`);

          // Prepare movie context for backend request
          const movieContext = {
            storyboardId: newStoryboard.id,
            sceneIndex: absoluteSceneIndex,
            sceneCount: totalScenesForProgress,
            sceneDuration: scene.duration || 5,
            sceneDescription: scene.description || ''
          };

          // Use backend-assisted generation - this will handle updating the movie JSON
          let result: AnimationGenerateResponse | null = null;
          let retryCount = 0;
          const maxRetries = 1; // One retry attempt

          while (retryCount <= maxRetries && !result) {
            try {
              // Generate with movie context to enable backend-assisted generation
              result = await AnimationApi.generateWithMovieContext(
                scene.svgPrompt,
                aiProvider,
                movieContext
              );

              // Check if the backend successfully updated the movie JSON
              if (result && result.movieUpdateStatus) {
                // For backend-assisted generation, use the server's information to update local state
                const { sceneIndex, completedScenes, totalScenes, clipId } = result.movieUpdateStatus;

                // Update progress to reflect the server's state
                updateGenerationProgress(
                  sceneIndex,
                  totalScenes,
                  startingSceneIndex > 0 ? startingSceneIndex : undefined
                );

                // Create a clip object for local state only - the backend already saved it
                const newClip = {
                  id: clipId,
                  name: `Scene ${absoluteSceneIndex + 1}${scene.description ? ': ' + scene.description : ''}`,
                  svgContent: result.svg,
                  duration: scene.duration || 5,
                  order: absoluteSceneIndex,
                  prompt: scene.svgPrompt,
                  chatHistory: [{
                    id: uuidv4(),
                    sender: 'user' as 'user',
                    text: scene.svgPrompt,
                    timestamp: new Date()
                  }, {
                    id: uuidv4(),
                    sender: 'ai' as 'ai',
                    text: result.message,
                    timestamp: new Date()
                  }],
                  animationId: result.animationId,
                  createdAt: new Date(),
                  provider: aiProvider
                };

                // Update frontend state to match backend state
                setCurrentStoryboard(prevStoryboard => {
                  const clipExists = prevStoryboard.clips.some(c => c.order === absoluteSceneIndex);

                  if (clipExists) {
                    return prevStoryboard;
                  }

                  const updatedClips = [...prevStoryboard.clips, newClip];
                  updatedClips.sort((a, b) => a.order - b.order);

                  const updatedStoryboard = {
                    ...prevStoryboard,
                    clips: updatedClips,
                    updatedAt: new Date(),
                    generationStatus: {
                      ...prevStoryboard.generationStatus!,
                      completedScenes: completedScenes,
                      inProgress: result?.movieUpdateStatus?.inProgress ?? prevStoryboard.generationStatus!.inProgress
                    }
                  };

                  return updatedStoryboard;
                });

                return;
              }
            } catch (sceneError) {
              // Handle errors for this specific scene
              console.error(`Error generating scene ${absoluteSceneIndex+1}:`, sceneError);
              retryCount++;

              // Log the error details
              errors.push({
                sceneIndex: absoluteSceneIndex,
                error: sceneError instanceof Error ? sceneError.message : String(sceneError)
              });

              // If we've exhausted retries, continue to the next scene
              if (retryCount > maxRetries) {
                // Update storyboard to reflect the error for this scene
                setCurrentStoryboard(prevStoryboard => {
                  return {
                    ...prevStoryboard,
                    updatedAt: new Date(),
                    generationStatus: {
                      ...prevStoryboard.generationStatus!,
                      error: `Failed to generate scene ${absoluteSceneIndex+1}: ${sceneError instanceof Error ? sceneError.message : String(sceneError)}`
                    }
                  };
                });
              }
            }
          }

          // If we got here, the backend didn't properly update the movie, fall back to regular generate
          if (!result || !result.svg || !result.svg.includes('<svg')) {
            throw new Error(`Invalid SVG generated for scene ${absoluteSceneIndex+1}`);
          }

          // Continue with the fallback approach - create clip and save it ourselves
          updateGenerationProgress(
            absoluteSceneIndex,
            totalScenesForProgress,
            startingSceneIndex > 0 ? startingSceneIndex : undefined
          );

          const chatHistory = [{
            id: uuidv4(),
            sender: 'user' as 'user',
            text: scene.svgPrompt,
            timestamp: new Date()
          }, {
            id: uuidv4(),
            sender: 'ai' as 'ai',
            text: result.message,
            timestamp: new Date()
          }];

          const sceneName = `Scene ${absoluteSceneIndex + 1}: ${scene.description || 'Untitled'}`;

          const newClip: MovieClip = {
            id: uuidv4(),
            name: sceneName,
            svgContent: result.svg,
            duration: scene.duration || 5,
            order: absoluteSceneIndex,
            prompt: scene.svgPrompt,
            chatHistory,
            createdAt: new Date(),
            animationId: result.animationId,
            provider: aiProvider
          };

          // Update the storyboard with the new clip
          setCurrentStoryboard(prevStoryboard => {
            const existingClips = JSON.parse(JSON.stringify(prevStoryboard.clips || []));
            const exists = existingClips.some((clip: MovieClip) => clip.order === absoluteSceneIndex);

            if (exists) {
              return prevStoryboard;
            }

            const clipToAdd = {
              id: newClip.id,
              name: newClip.name,
              svgContent: newClip.svgContent,
              duration: newClip.duration,
              order: newClip.order,
              prompt: newClip.prompt || "",
              chatHistory: newClip.chatHistory || [],
              createdAt: newClip.createdAt,
              provider: newClip.provider,
              animationId: result?.animationId
            };

            const updatedStoryboard = {
              ...prevStoryboard,
              clips: [...existingClips, clipToAdd],
              updatedAt: new Date(),
              generationStatus: {
                ...prevStoryboard.generationStatus!,
                completedScenes: Math.max(prevStoryboard.generationStatus?.completedScenes || 0, absoluteSceneIndex + 1)
              }
            };

            return updatedStoryboard;
          });
        } catch (sceneError) {
          // Handle any other errors for this scene
          console.error(`Unhandled error for scene ${absoluteSceneIndex+1}:`, sceneError);
          errors.push({
            sceneIndex: absoluteSceneIndex,
            error: sceneError instanceof Error ? sceneError.message : String(sceneError)
          });
        }
      };

      // Execute scene generation with appropriate concurrency based on provider
      if (aiProvider === 'openai') {
        // For OpenAI, process scenes in batches to control concurrency
        const openAIConcurrencyLimit = 6;
        console.log(`Using OpenAI with controlled concurrency of ${openAIConcurrencyLimit}`);

        for (let i = 0; i < scenePromises.length; i += openAIConcurrencyLimit) {
          const batch = scenePromises.slice(i, i + openAIConcurrencyLimit).map(promiseFn => promiseFn());
          await Promise.all(batch);
        }
      } else {
        // For Claude, let the server's rate limiter handle throttling
        // The server is already configured to limit Claude to 2 concurrent requests
        // with proper token-based throttling
        console.log('Using Claude with server-side rate limiting');

        // Process all scenes, the server will queue them appropriately
        await Promise.all(scenePromises.map(promiseFn => promiseFn()));
      }

      // Create final copy of storyboard with current state
      setCurrentStoryboard(prevStoryboard => {
        const finalStoryboard: Storyboard = {
          ...prevStoryboard,
          updatedAt: new Date(),
          generationStatus: {
            ...prevStoryboard.generationStatus!,
            inProgress: false,
            completedAt: new Date()
          }
        };

        // Explicitly log the final state to verify clips are present
        console.log(`Finalizing storyboard ${finalStoryboard.id} with ${finalStoryboard.clips.length} clips`);

        // Save the final storyboard and ensure we preserve the current ID
        setTimeout(() => {
          MovieStorageApi.saveMovie(finalStoryboard)
            .then(result => {
              // Log the saved state
              console.log(`Final storyboard saved with ID: ${result.id} (original: ${finalStoryboard.id})`);

              // If server assigned a different ID, update our reference but keep all clips
              if (result.id !== finalStoryboard.id) {
                console.log(`Server assigned different ID - updating reference only`);
                finalStoryboard.id = result.id;
              }
            })
            .catch(saveError => {
              console.error('Failed to save final storyboard:', saveError);
            });
        }, 0);

        return finalStoryboard;
      });

      // Log completion success
      console.log(`Completed storyboard generation with ${successfulClipsCount} clips`);
      if (errors.length > 0) {
        console.error(`Encountered ${errors.length} errors during generation`);
      }

      // IMPORTANT: Reset UI state after successful generation
      setShowGeneratingClipsModal(false);
      setIsGenerating(false);
    } catch (error) {
      handleGenerationError(error);
    }
  };

  /**
   * Handle generation errors by updating the storyboard status
   */
  const handleGenerationError = (error: unknown) => {
    console.error('Error processing storyboard:', error);

    // Update status to indicate failure but mark inProgress false
    setCurrentStoryboard(prevStoryboard => {
      const errorStoryboard = {
        ...prevStoryboard,
        updatedAt: new Date(),
        generationStatus: {
          ...prevStoryboard.generationStatus!,
          inProgress: false, // Critical: Mark as not in progress even if it failed
          completedAt: new Date(),
          error: error instanceof Error ? error.message : 'Unknown error during generation'
        }
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

  return {
    isGenerating,
    setIsGenerating,
    generationProgress,
    setGenerationProgress,
    updateGenerationProgress,
    generationError,
    setGenerationError,
    handleGenerateStoryboard,
    resumeStoryboardGeneration,
    processStoryboard,
    handleGenerationError
  };
}
