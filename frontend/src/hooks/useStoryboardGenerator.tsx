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
}

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
      // Start from where we left off - use the actual number of clips as the source of truth
      // for what scenes have been completed
      const completedScenesFromClips = storyboard.clips?.length || 0;

      // Use clip count as the definitive measure of what's been completed
      let startSceneIndex = completedScenesFromClips;

      console.log(`Resume calculation: Found ${completedScenesFromClips} existing clips`);
      console.log(`Will resume from scene index ${startSceneIndex}`);

      // Validate scenes are available
      if (!storyboardResponse.scenes || storyboardResponse.scenes.length === 0) {
        throw new Error('No scenes available for resumption');
      }

      // Skip already completed scenes
      const remainingScenes = storyboardResponse.scenes.slice(startSceneIndex);

      // If no scenes left, just mark as complete
      if (remainingScenes.length === 0) {
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

          MovieStorageApi.saveMovie(finalStoryboard).catch(err => {
            console.error('Error in final storyboard save:', err);
          });

          return finalStoryboard;
        });

        setIsGenerating(false);
        setShowGeneratingClipsModal(false);
        return;
      }

      // Create modified response with only remaining scenes
      const resumedResponse = {
        ...storyboardResponse,
        scenes: remainingScenes
      };

      // Process the remaining scenes
      await processStoryboard(resumedResponse, aiProvider, startSceneIndex);
    } catch (error) {
      console.error('Error resuming storyboard generation:', error);
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
    startingSceneIndex = 0
  ) => {
    console.log('Beginning storyboard generation...');

    // If we're starting from the beginning, create a new storyboard
    let storyboardId: string;
    let newStoryboard: Storyboard;

    if (startingSceneIndex === 0) {
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
      // We're resuming an existing storyboard
      storyboardId = currentStoryboard!.id;
      console.log(`Resuming storyboard with ID: ${storyboardId}`);

      // Use the current storyboard as starting point
      newStoryboard = {
        ...currentStoryboard!,
        updatedAt: new Date(),
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
      // Set the initial storyboard and save it to the server right away
      setCurrentStoryboard(newStoryboard);
      setShowGeneratingClipsModal(true);

      // Initialize the progress with the total count and starting point but no completed scenes yet
      updateGenerationProgress(
        null, // null indicates initialization rather than completion
        storyboard.scenes.length,
        startingSceneIndex > 0 ? startingSceneIndex : undefined
      );

      // Save the initial storyboard to the server using direct API call
      console.log('Saving initial/resumed storyboard to server...');
      try {
        // Use direct API call to avoid stale state issues
        const result = await MovieStorageApi.saveMovie(newStoryboard);
        console.log(`Initial/resumed storyboard saved to server with ID: ${result.id}`);

        // CRITICAL: Store the server-assigned ID if different
        if (result.id !== storyboardId) {
          console.log(`Server assigned different ID: ${result.id} (original: ${storyboardId})`);
          newStoryboard.id = result.id;
        }
      } catch (error) {
        console.error('Error saving initial/resumed storyboard:', error);
      }

      // Track any scene generation errors
      const errors: { sceneIndex: number, error: string }[] = [];

      // Track successful clips locally to avoid state timing issues
      let successfulClipsCount = 0;

      // Process scenes in parallel with appropriate concurrency
      // For OpenAI we limit concurrency on the client side
      // For Claude we let the server's rate limiter handle it completely
      const totalScenes = storyboard.scenes.length;

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

        processedScenes.add(absoluteSceneIndex);

        try {
          console.log(`Generating SVG for scene ${absoluteSceneIndex+1}/${startingSceneIndex + totalScenes}: ${scene.id || 'Untitled'}`);
          console.log(`Prompt: ${scene.svgPrompt.substring(0, 100)}${scene.svgPrompt.length > 100 ? '...' : ''}`);

          // Generate SVG for this scene, with error handling for mobile timeouts
          let result: AnimationGenerateResponse | null = null;
          let retryCount = 0;
          const maxRetries = 1; // One retry attempt

          while (retryCount <= maxRetries && !result) {
            try {
              // Generate without a manual timeout promise - rely on the API's built-in timeout
              result = await AnimationApi.generate(scene.svgPrompt, aiProvider);

              // Only update progress counter when scene is actually completed
              updateGenerationProgress(
                absoluteSceneIndex, // Pass the completed scene index
                startingSceneIndex + totalScenes,
                startingSceneIndex > 0 ? startingSceneIndex : undefined
              );

              // Verify the generated SVG is valid
              if (!result || !result.svg || !result.svg.includes('<svg')) {
                throw new Error(`Invalid SVG generated for scene ${absoluteSceneIndex+1}`);
              }

              // Create chat history for this scene
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

              // Get the scene name
              const sceneName = `Scene ${absoluteSceneIndex + 1}: ${scene.id || 'Untitled'}`;

              // Detailed animation ID logging only for missing IDs
              if (!result.animationId) {
                console.warn(`No animation ID returned for scene ${absoluteSceneIndex+1}`);
              }

              // Add this scene to the storyboard
              const newClip: MovieClip = {
                id: uuidv4(),
                name: sceneName,
                svgContent: result.svg,
                duration: scene.duration || 5,
                order: absoluteSceneIndex,
                prompt: scene.svgPrompt,
                chatHistory,
                // Add a timestamp to track when this was created
                createdAt: new Date(),
                // Store the animation ID (which might be undefined)
                animationId: result.animationId,
                // Store the provider used to generate this clip
                provider: aiProvider
              };

              // Update the storyboard with the new clip and updated generation status
              setCurrentStoryboard(prevStoryboard => {
                // Create a deep copy of the existing clips to avoid reference issues
                const existingClips = JSON.parse(JSON.stringify(prevStoryboard.clips || []));

                // Important: Create a fresh newClip object to ensure all properties are correctly serialized
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
                  // Store the animation ID with detailed logging if missing
                  animationId: result?.animationId
                };

                if (!result?.animationId) {
                  console.warn(`Adding clip #${absoluteSceneIndex+1} with missing animationId`);
                }

                const updatedStoryboard = {
                  ...prevStoryboard,
                  clips: [...existingClips, clipToAdd],
                  updatedAt: new Date(),
                  generationStatus: {
                    ...prevStoryboard.generationStatus!,
                    // IMPORTANT: Only update completedScenes AFTER successful generation
                    completedScenes: absoluteSceneIndex + 1
                  }
                };

                // CRITICAL FIX: Save the storyboard directly with the updated clips
                // We need to save the storyboard directly using the updated object, not the React state
                MovieStorageApi.saveMovie(updatedStoryboard)
                  .catch(err => {
                    console.error('Error saving storyboard after adding clip:', err);
                  });

                // Increment our local counter for successful clips
                successfulClipsCount++;

                return updatedStoryboard;
              });

              // Success report with minimal information
              console.log(`Generated scene ${absoluteSceneIndex+1}: ${sceneName}`);
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
                console.warn(`Failed to generate scene ${absoluteSceneIndex+1} after ${maxRetries} retries, continuing to next scene`);
              }
            }
          }
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

        return finalStoryboard;
      });

      // Report final status with errors if any
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
      MovieStorageApi.saveMovie(errorStoryboard).then(result => {
        console.log(`Error state saved with ID: ${result.id}`);
      }).catch(err => {
        console.error('Error saving storyboard error state:', err);
      });

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
