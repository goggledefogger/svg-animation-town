import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMovie } from '../contexts/MovieContext';
import StoryboardPanel from '../components/StoryboardPanel';
import AnimationCanvas from '../components/AnimationCanvas';
import AnimationControls from '../components/AnimationControls';
import StoryboardGeneratorModal from '../components/StoryboardGeneratorModal';
import { MovieApi, StoryboardResponse } from '../services/movie.api';
import ConfirmationModal from '../components/ConfirmationModal';
import { AnimationApi, AnimationStorageApi, MovieStorageApi } from '../services/api';
import { MovieClip, Storyboard } from '../contexts/MovieContext';
import { Message } from '../contexts/AnimationContext';
import ClipEditor from '../components/ClipEditor';
import Header from '../components/Header';
import SvgThumbnail from '../components/SvgThumbnail';
import { useNavigate, useParams } from 'react-router-dom';
import { useAnimation } from '../contexts/AnimationContext';

const MovieEditorPage: React.FC = () => {
  const {
    currentStoryboard,
    activeClipId,
    setActiveClipId,
    saveStoryboard,
    exportStoryboard,
    isPlaying,
    setIsPlaying,
    createStoryboardFromResponse,
    saveCurrentAnimationAsClip,
    setCurrentStoryboard,
    savedStoryboards,
    loadStoryboard,
    currentPlaybackPosition,
    getActiveClip,
    setCurrentPlaybackPosition,
    deleteStoryboard,
    getSavedStoryboards,
    createNewStoryboard,
    addClip
  } = useMovie();

  const navigate = useNavigate();

  // Add useEffect to track changes to currentStoryboard
  useEffect(() => {
    console.log('Current storyboard updated:', currentStoryboard.id);
    console.log('Clips count:', currentStoryboard.clips.length);
    if (currentStoryboard.clips.length > 0) {
      console.log('First clip:', currentStoryboard.clips[0].name);
    }
  }, [currentStoryboard]);

  // Playback timer for clips - refined for better performance and sync
  useEffect(() => {
    if (!isPlaying || !activeClipId) return;

    const activeClip = getActiveClip();
    if (!activeClip) return;

    let lastTimestamp: number | null = null;
    let animationFrameId: number;

    // Animation loop to update playback position
    const updatePlayback = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      // Calculate time elapsed since last frame
      const elapsed = (timestamp - lastTimestamp) / 1000; // convert to seconds
      lastTimestamp = timestamp;

      // Get current position from state
      const newPosition = currentPlaybackPosition + elapsed;
      const clipDuration = activeClip.duration || 5;

      // If we've reached the end of the clip, loop back to start
      if (newPosition >= clipDuration) {
        // Loop back to the beginning
        setCurrentPlaybackPosition(0);
      } else {
        // Update position
        setCurrentPlaybackPosition(newPosition);
      }

      // Continue the animation loop
      animationFrameId = requestAnimationFrame(updatePlayback);
    };

    // Start the animation loop
    animationFrameId = requestAnimationFrame(updatePlayback);

    // Clean up when component unmounts or dependencies change
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, activeClipId, getActiveClip, currentPlaybackPosition, setCurrentPlaybackPosition]);

  // Load the most recent storyboard on component mount if available
  useEffect(() => {
    const fetchStoryboards = async () => {
      try {
        await getSavedStoryboards();

        // If no clips, try to load from localStorage
        if (currentStoryboard.clips.length === 0) {
          const storyboardsString = localStorage.getItem('svg-animator-storyboards');
          if (storyboardsString) {
            try {
              const storyboards = JSON.parse(storyboardsString);
              const storyboardsList = Object.values(storyboards) as Storyboard[];

              // Convert stored dates back to Date objects for comparison
              storyboardsList.forEach((sb) => {
                sb.updatedAt = new Date(sb.updatedAt);
              });

              // Sort by updated date (newest first)
              storyboardsList.sort((a, b) =>
                new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
              );

              if (storyboardsList.length > 0) {
                const newestStoryboard = storyboardsList[0];
                console.log(`Loading most recent storyboard: ${newestStoryboard.name} with ${newestStoryboard.clips?.length || 0} clips`);
                try {
                  await loadStoryboard(newestStoryboard.id);
                } catch (loadError) {
                  console.error('Error loading most recent storyboard:', loadError);
                  // Display an error toast or notification to the user
                  alert(`Failed to load storyboard: ${loadError instanceof Error ? loadError.message : 'Unknown error'}`);
                }
              }
            } catch (error) {
              console.error('Error loading most recent storyboard:', error);
            }
          }
        }
      } catch (error) {
        console.error('Error fetching storyboards:', error);
      }
    };

    fetchStoryboards();
  }, [loadStoryboard]);

  // Check for movie ID in URL
  useEffect(() => {
    const urlParams = new URLSearchParams(window.location.search);
    const movieId = urlParams.get('id');

    if (movieId) {
      console.log(`Found movie ID in URL: ${movieId}`);
      const loadMovieFromUrl = async () => {
        try {
          const success = await loadStoryboard(movieId);
          if (!success) {
            console.error(`Failed to load movie with ID: ${movieId}`);
            alert(`Movie with ID "${movieId}" not found. Creating a new storyboard instead.`);
            // Create new storyboard
            createNewStoryboard();
          }
        } catch (error) {
          console.error(`Error loading movie with ID ${movieId}:`, error);
          alert(`Error loading movie: ${error instanceof Error ? error.message : 'Unknown error'}. Creating a new storyboard instead.`);
          // Create new storyboard
          createNewStoryboard();
        }
      };

      loadMovieFromUrl();
    }
  }, [loadStoryboard, createNewStoryboard]);

  // Check for pending animation ID from the StoryboardPanel
  useEffect(() => {
    const checkForPendingAnimation = async () => {
      const pendingAnimationId = sessionStorage.getItem('pending_animation_id');
      const pendingAnimationName = sessionStorage.getItem('pending_animation_name');

      if (pendingAnimationId && pendingAnimationName) {
        console.log(`Adding existing animation as clip: ${pendingAnimationName} (ID: ${pendingAnimationId})`);

        try {
          // Get animation content
          const animation = await AnimationStorageApi.getAnimation(pendingAnimationId);

          if (animation && animation.svg) {
            console.log('Animation retrieved:', {
              name: pendingAnimationName,
              prompt: animation.prompt,
              svg: animation.svg ? 'SVG content exists' : 'No SVG content'
            });

            // Get the prompt from animation or try to extract from chat history
            let prompt = animation.prompt || '';

            // If no prompt but chat history exists, try to extract prompt from latest user message
            if (!prompt && Array.isArray(animation.chatHistory) && animation.chatHistory.length > 0) {
              // Find the most recent user message to use as prompt
              for (let i = animation.chatHistory.length - 1; i >= 0; i--) {
                if (animation.chatHistory[i].sender === 'user') {
                  prompt = animation.chatHistory[i].text;
                  console.log('Extracted prompt from chat history:', prompt);
                  break;
                }
              }
            }

            // Add as a new clip with reference to existing animation
            const newClipId = addClip({
              name: pendingAnimationName, // Use the pending animation name for the clip name
              svgContent: animation.svg,
              duration: 5, // Default duration
              animationId: pendingAnimationId,
              prompt: prompt, // Use extracted or original prompt
              chatHistory: animation.chatHistory || []
            });

            // Set as active clip
            if (newClipId) {
              setActiveClipId(newClipId);
            }
          }
        } catch (error) {
          console.error('Error adding existing animation as clip:', error);
        } finally {
          // Clear the pending animation data
          sessionStorage.removeItem('pending_animation_id');
          sessionStorage.removeItem('pending_animation_name');
        }
      }
    };

    checkForPendingAnimation();
  }, [addClip, setActiveClipId]);

  // Function to add an existing animation directly to the storyboard
  const addExistingAnimationAsClip = async (animationId: string, animationName: string) => {
    console.log(`Adding existing animation as clip: ${animationName} (ID: ${animationId})`);

    try {
      // Get animation content
      const animation = await AnimationStorageApi.getAnimation(animationId);

      if (animation && animation.svg) {
        console.log('Animation retrieved:', {
          name: animationName,
          prompt: animation.prompt,
          svg: animation.svg ? 'SVG content exists' : 'No SVG content'
        });

        // Get the prompt from animation or try to extract from chat history
        let prompt = animation.prompt || '';

        // If no prompt but chat history exists, try to extract prompt from latest user message
        if (!prompt && Array.isArray(animation.chatHistory) && animation.chatHistory.length > 0) {
          // Find the most recent user message to use as prompt
          for (let i = animation.chatHistory.length - 1; i >= 0; i--) {
            if (animation.chatHistory[i].sender === 'user') {
              prompt = animation.chatHistory[i].text;
              console.log('Extracted prompt from chat history:', prompt);
              break;
            }
          }
        }

        // Add as a new clip with reference to existing animation
        const newClipId = addClip({
          name: animationName, // Use the animation name for the clip name
          svgContent: animation.svg,
          duration: 5, // Default duration
          animationId: animationId,
          prompt: prompt, // Use extracted or original prompt
          chatHistory: animation.chatHistory || []
        });

        // Set as active clip
        if (newClipId) {
          setActiveClipId(newClipId);
        }

        // Return success
        return true;
      }
    } catch (error) {
      console.error('Error adding existing animation as clip:', error);
    }

    return false;
  };

  const handleAddClip = () => {
    // Check if we have a pending animation to add directly
    const pendingAnimationId = sessionStorage.getItem('pending_animation_id');
    const pendingAnimationName = sessionStorage.getItem('pending_animation_name');

    if (pendingAnimationId && pendingAnimationName) {
      // Add the existing animation and clear the session storage
      addExistingAnimationAsClip(pendingAnimationId, pendingAnimationName).then(success => {
        if (success) {
          // Clear the pending animation data
          sessionStorage.removeItem('pending_animation_id');
          sessionStorage.removeItem('pending_animation_name');
        }
      });
    } else {
      // Set a default name that can be changed later
      localStorage.setItem('pending_clip_name', 'New Clip');

      // Navigate to the animation editor
      navigate('/');
    }
  };

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [storyboardName, setStoryboardName] = useState(currentStoryboard.name);
  const [showStoryboardGeneratorModal, setShowStoryboardGeneratorModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGeneratingClipsModal, setShowGeneratingClipsModal] = useState(false);

  // Update with a properly defined interface for the progress state
  interface GenerationProgressState {
    current: number;
    total: number;
    resumedFrom?: number;
  }

  const [generationProgress, setGenerationProgress] = useState<GenerationProgressState>({
    current: 0,
    total: 0
  });

  const [generationError, setGenerationError] = useState<string | null>(null);
  const [showErrorModal, setShowErrorModal] = useState(false);
  const [showLoadModal, setShowLoadModal] = useState(false);
  const [showMobileClipEditor, setShowMobileClipEditor] = useState(false);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [storyboardToDelete, setStoryboardToDelete] = useState<string | null>(null);

  // Function to reset application state
  const resetApplication = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('svg-animator-storyboards');

    // Clear sessionStorage animation state (needed to reset the animation viewer)
    sessionStorage.removeItem('current_animation_state');
    sessionStorage.removeItem('page_just_loaded');
    sessionStorage.setItem('force_server_refresh', 'true');

    // Create a new empty storyboard
    createNewStoryboard();

    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);

    // Reload the page to ensure a clean state
    window.location.reload();
  }, [createNewStoryboard]);

  const handleClipSelect = (clipId: string) => {
    setActiveClipId(clipId);
  };

  const handleSave = async () => {
    await saveStoryboard();
    setShowSaveModal(false);
  };

  const handleExport = (format: 'json' | 'svg') => {
    exportStoryboard(format);
    setShowExportModal(false);
  };

  // Add a new effect to check for incomplete generations when the page loads
  useEffect(() => {
    const checkIncompleteGenerations = async () => {
      try {
        // Only run this if we're not already generating something
        if (isGenerating) return;

        // Check if there's a current storyboard that's incomplete
        if (currentStoryboard?.generationStatus?.inProgress) {
          console.log('Found incomplete storyboard generation:', currentStoryboard.id);

          // Show a confirmation to the user
          const shouldResume = window.confirm(
            `It looks like you have an incomplete movie generation "${currentStoryboard.name}". Would you like to resume where you left off?`
          );

          if (shouldResume) {
            console.log('Resuming generation for storyboard:', currentStoryboard.id);
            // Show the generating clips modal
            setShowGeneratingClipsModal(true);
            setIsGenerating(true);

            // Determine which AI provider was being used
            const aiProvider = currentStoryboard.aiProvider || 'openai';

            // Resume the generation process - simulating the storyboard response
            // We need to create a faux storyboard response from the existing storyboard
            const resumeStoryboardResponse: StoryboardResponse = {
              title: currentStoryboard.name,
              description: currentStoryboard.description || '',
              scenes: [] // This will be populated with remaining scenes
            };

            // If we have the original scenes data stored, use it
            if (currentStoryboard.originalScenes) {
              resumeStoryboardResponse.scenes = currentStoryboard.originalScenes;
            } else {
              // Without original scenes, we can only infer from clips
              // This is a fallback and may not work perfectly
              console.warn('No original scenes data found, using limited resume capability');
            }

            // Resume from the last completed scene
            await resumeStoryboardGeneration(currentStoryboard, resumeStoryboardResponse, aiProvider);
          }
        }
      } catch (error) {
        console.error('Error checking for incomplete generations:', error);
      }
    };

    // Run the check when the component mounts
    checkIncompleteGenerations();
  }, [currentStoryboard, isGenerating]);

  const handleGenerateStoryboard = async (prompt: string, aiProvider: 'openai' | 'claude') => {
    try {
      // Reset any previous errors
      setGenerationError(null);

      // First set loading state for the initial storyboard generation
      setIsGenerating(true);

      // Call the API to generate a storyboard
      const response = await MovieApi.generateStoryboard(prompt, aiProvider);

      console.log('Generated storyboard:', response);

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

  // Add a new function to resume storyboard generation
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

  // Process a storyboard response into clips
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

      // Generate each scene manually to track progress
      // If we're resuming, we'll start at the specified index
      for (let i = 0; i < storyboard.scenes.length; i++) {
        // Convert i to the absolute scene index (for the entire storyboard)
        const absoluteSceneIndex = i + startingSceneIndex;

        // Get the scene from the restartable scenes array
        const scene = storyboard.scenes[i];

        try {
          // Update the progress display
          setGenerationProgress({
            current: absoluteSceneIndex,
            total: startingSceneIndex + storyboard.scenes.length,
            resumedFrom: startingSceneIndex > 0 ? startingSceneIndex : undefined
          });

          console.log(`Generating SVG for scene ${absoluteSceneIndex+1}/${startingSceneIndex + storyboard.scenes.length}: ${scene.id || 'Untitled'}`);
          console.log(`Prompt: ${scene.svgPrompt.substring(0, 100)}${scene.svgPrompt.length > 100 ? '...' : ''}`);

          // Generate SVG for this scene, with error handling for mobile timeouts
          let result;
          try {
            // Set a timeout to handle the case where the API request hangs
            const timeoutMs = 30000; // 30 seconds timeout
            const timeoutPromise = new Promise<never>((_, reject) => {
              setTimeout(() => reject(new Error(`Scene generation timed out after ${timeoutMs/1000} seconds`)), timeoutMs);
            });

            // Race the actual API call against the timeout
            result = await Promise.race([
              AnimationApi.generate(scene.svgPrompt, aiProvider),
              timeoutPromise
            ]);
          } catch (generateError) {
            console.error(`Error generating scene ${absoluteSceneIndex+1}:`, generateError);
            throw new Error(`Failed to generate SVG: ${generateError instanceof Error ? generateError.message : 'Unknown error'}`);
          }

          // Verify the generated SVG is valid
          if (!result.svg || !result.svg.includes('<svg')) {
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
          console.log(`Generated scene ${absoluteSceneIndex+1} with name: ${sceneName}`);

          // Use the animation ID returned from the API since the backend now saves animations automatically
          // If no ID is returned, log a warning but continue with local data
          if (!result.animationId) {
            console.warn(`No animation ID returned for scene ${absoluteSceneIndex+1}, this may indicate the backend didn't save it`);
          } else {
            console.log(`Scene ${absoluteSceneIndex+1} saved with animation ID: ${result.animationId}`);
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
            animationId: result.animationId // Use the animation ID from the generate API result
          };

          // Log the animation ID before updating state
          console.log(`About to add clip with animation ID: ${result.animationId}`);

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
              animationId: result.animationId // Explicitly set again to ensure it's included
            };

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

            // Log the storyboard for debugging
            console.log(`Updated storyboard now has ${updatedStoryboard.clips.length} clips`);
            console.log(`Last clip has animation ID: ${updatedStoryboard.clips[updatedStoryboard.clips.length-1].animationId}`);

            // CRITICAL FIX: Save the storyboard directly with the updated clips
            // We need to save the storyboard directly using the updated object, not the React state
            MovieStorageApi.saveMovie(updatedStoryboard).then(result => {
              console.log(`Direct save successful with ID: ${result.id}`);
            }).catch(err => {
              console.error('Error in direct storyboard save:', err);
            });

            // Increment our local counter for successful clips
            successfulClipsCount++;

            return updatedStoryboard;
          });

          // Save storyboard after each clip to persist progress
          // REMOVED: await saveStoryboard() - this would use stale state
          console.log(`Storyboard updated with scene ${absoluteSceneIndex+1} and saved to server`);

          console.log(`Successfully generated SVG for scene ${absoluteSceneIndex+1}`);

          // Sleep briefly between scene generations to prevent overwhelming mobile devices
          await new Promise(resolve => setTimeout(resolve, 500));

        } catch (error) {
          console.error(`Error generating clip for scene ${absoluteSceneIndex}:`, error);
          errors.push({
            sceneIndex: absoluteSceneIndex,
            error: error instanceof Error ? error.message : 'Unknown error'
          });

          // On mobile, sleep a bit longer after an error to allow recovery
          await new Promise(resolve => setTimeout(resolve, 2000));
        }
      }

      // Check if we have any successful clips - Using our local counter instead of state
      if (successfulClipsCount === 0) {
        throw new Error(`Failed to generate any scenes for the storyboard. ${errors.length > 0 ?
          `Errors: ${errors.map(e => `Scene ${e.sceneIndex + 1}: ${e.error}`).join(', ')}` : ''}`);
      } else {
        console.log(`Successfully generated ${successfulClipsCount} scenes for the storyboard`);

        // If there were some errors but not all
        if (errors.length > 0) {
          console.warn(`Generated ${successfulClipsCount} scenes but ${errors.length} failed`);
        }
      }

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

        // Do a direct save of the final storyboard with the same ID to avoid creating a new file
        console.log(`Final save of storyboard with ID ${finalStoryboard.id}`);
        MovieStorageApi.saveMovie(finalStoryboard).then(result => {
          console.log(`Final storyboard saved successfully with ID: ${result.id}`);
        }).catch(err => {
          console.error('Error in final storyboard save:', err);
        });

        return finalStoryboard;
      });

      // Final save with completed status
      // await saveStoryboard(); - This was creating a second file with a different ID
      console.log(`Storyboard generation completed with ${newStoryboard.clips.length} clips`);

      // Set the first clip as active if available
      if (newStoryboard.clips.length > 0) {
        setActiveClipId(newStoryboard.clips[0].id);
      }

      // Hide the progress modal
      setShowGeneratingClipsModal(false);
      setIsGenerating(false);

      // Show warning if some scenes failed
      if (errors.length > 0) {
        const warningMessage = `Generated ${successfulClipsCount} out of ${storyboard.scenes.length} scenes. ${errors.length} scenes failed to generate.`;
        console.warn(warningMessage);
        // Don't set error message or show error modal for partial successes
        // Just log a warning in the console instead
      }
    } catch (error) {
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
    }
  };

  return (
    <div className="flex flex-col h-screen h-mobile-screen overflow-hidden">
      {/* Use the shared Header component instead of custom header */}
      <Header
        storyboardName={currentStoryboard.name || 'New Movie'}
        onGenerate={() => setShowStoryboardGeneratorModal(true)}
        onSave={() => setShowSaveModal(true)}
        onLoad={() => setShowLoadModal(true)}
        onExport={() => setShowExportModal(true)}
        onReset={resetApplication}
      />

      {/* Main content area */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left panel - Storyboard (hidden on mobile, will appear below) */}
        <div className="hidden md:block md:w-1/4 border-r border-gray-700 bg-gotham-black p-4 flex flex-col">
          <h2 className="text-lg font-semibold mb-2">Storyboard</h2>
          <div className="text-xs text-gray-500 mb-3">
            {currentStoryboard.clips.length} clips available
          </div>
          <div className="h-[calc(100%-80px)]">
            <StoryboardPanel
              clips={currentStoryboard.clips}
              activeClipId={activeClipId}
              onClipSelect={handleClipSelect}
              onAddClip={handleAddClip}
              storyboard={currentStoryboard}
            />
          </div>
        </div>

        {/* Center content - Animation Preview and Mobile Panels */}
        <div className="flex-1 flex flex-col overflow-hidden">
          {/* Center panel - Animation Preview */}
          <div className="flex-grow p-4 flex flex-col">
            <AnimationCanvas />
            <AnimationControls />
          </div>

          {/* Mobile Only - Horizontally scrolling StoryboardPanel */}
          <div className="md:hidden bg-gotham-black border-t border-gray-700 p-4">
            <div className="flex items-baseline mb-2">
              <h2 className="text-lg font-semibold">Storyboard</h2>
              {currentStoryboard.generationStatus && (
                <div className="ml-2 text-xs text-gray-400">
                  {currentStoryboard.generationStatus.completedScenes}/{currentStoryboard.generationStatus.totalScenes} generated
                </div>
              )}
            </div>
            <div className="overflow-x-auto pb-4 relative">
              <div className="inline-flex space-x-3 min-w-full">
                <StoryboardPanel
                  clips={currentStoryboard.clips}
                  activeClipId={activeClipId}
                  onClipSelect={handleClipSelect}
                  onAddClip={handleAddClip}
                  storyboard={currentStoryboard}
                />
              </div>
            </div>
          </div>
        </div>

        {/* Right panel - Clip Editor */}
        <div className="hidden md:block md:w-1/4 border-l border-gray-700 bg-gotham-black p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Clip Editor</h2>
          <ClipEditor onClipUpdate={() => {
            // This will be called when a clip is updated
            console.log('Clip updated successfully');
          }} />
        </div>
      </div>

      {/* Mobile - Floating Clip Editor Button */}
      <div className="md:hidden fixed bottom-16 right-4 z-50">
        <button
          className="bg-bat-yellow text-black rounded-full p-3 shadow-lg"
          onClick={() => setShowMobileClipEditor(true)}
          aria-label="Edit Clip"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      </div>

      {/* Mobile - Clip Editor Modal */}
      <ConfirmationModal
        isOpen={showMobileClipEditor}
        title="Edit Clip"
        message={
          <div className="mt-2">
            {activeClipId ? (
              <ClipEditor onClipUpdate={() => {
                console.log('Clip updated successfully');
                setShowMobileClipEditor(false);
              }} />
            ) : (
              <div className="text-gray-400 text-center p-4">
                Select a clip to edit its properties
              </div>
            )}
          </div>
        }
        confirmText="Close"
        cancelText={undefined}
        onConfirm={() => setShowMobileClipEditor(false)}
        onCancel={() => setShowMobileClipEditor(false)}
      />

      {/* Save Modal */}
      <ConfirmationModal
        isOpen={showSaveModal}
        title="Save Storyboard"
        message={
          <div className="mt-2">
            <label htmlFor="storyboardName" className="block text-sm font-medium text-gray-300">
              Storyboard Name
            </label>
            <input
              type="text"
              id="storyboardName"
              className="input"
              placeholder="Enter a name for your storyboard"
              value={storyboardName}
              onChange={(e) => setStoryboardName(e.target.value)}
              autoFocus
            />
          </div>
        }
        confirmText="Save"
        cancelText="Cancel"
        onConfirm={handleSave}
        onCancel={() => setShowSaveModal(false)}
      />

      {/* StoryboardGenerator Modal */}
      <StoryboardGeneratorModal
        isOpen={showStoryboardGeneratorModal}
        onCancel={() => setShowStoryboardGeneratorModal(false)}
        onGenerate={handleGenerateStoryboard}
        isLoading={isGenerating}
      />

      {/* Generating Clips Progress Modal */}
      <ConfirmationModal
        isOpen={showGeneratingClipsModal}
        title="Generating Clips"
        message={
          <div className="mt-2">
            <p className="text-center mb-4">
              {generationProgress.resumedFrom ?
                `Resuming animation generation from scene ${generationProgress.resumedFrom + 1}...` :
                `Creating animations for each scene in your storyboard...`
              }
            </p>
            <div className="w-full bg-gray-700 rounded-full h-2.5">
              <div
                className="bg-bat-yellow h-2.5 rounded-full"
                style={{
                  width: `${generationProgress.total ?
                    (generationProgress.current / generationProgress.total) * 100 : 0}%`
                }}
              ></div>
            </div>
            <p className="text-center mt-2 text-sm text-gray-400">
              {generationProgress.current} of {generationProgress.total} scenes completed
              {generationProgress.resumedFrom ?
                ` (resumed from scene ${generationProgress.resumedFrom + 1})` :
                ''
              }
            </p>
            <p className="text-center mt-2 text-sm text-gray-400">
              This may take a few minutes. Please don't close this window.
            </p>
            {generationProgress.resumedFrom && (
              <p className="text-center mt-2 text-sm text-yellow-400">
                Your previous progress was saved. Generation will continue where it left off.
              </p>
            )}
          </div>
        }
        confirmText="Please wait..."
        cancelText="Cancel"
        onConfirm={() => {}} // No action on confirm
        onCancel={() => {}} // No action on cancel - force user to wait
        confirmDisabled={true}
        showSpinner={true}
      />

      {/* Add Error Modal */}
      <ConfirmationModal
        isOpen={showErrorModal}
        title="Storyboard Generation Error"
        message={
          <div className="mt-2">
            <p className="text-center mb-4 text-red-500">
              Failed to generate storyboard
            </p>
            <p className="text-sm text-gray-300 bg-gotham-gray p-3 rounded max-h-60 overflow-y-auto">
              {generationError || 'Unknown error occurred'}
            </p>
            <p className="text-center mt-4 text-sm text-gray-400">
              Please try again with a different prompt or AI provider.
            </p>
          </div>
        }
        confirmText="OK"
        cancelText={undefined}
        onConfirm={() => setShowErrorModal(false)}
        onCancel={() => setShowErrorModal(false)}
      />

      {/* Load Storyboard Modal */}
      <ConfirmationModal
        isOpen={showLoadModal}
        title="Load Storyboard"
        message={
          <div className="mt-2">
            <p className="text-sm text-gray-300 mb-4">
              Select a storyboard to load:
            </p>
            <div className="max-h-96 overflow-y-auto">
              {(() => {
                // Use state to store the fetched storyboards
                const [loadedStoryboards, setLoadedStoryboards] = useState<Storyboard[]>([]);
                const [isLoading, setIsLoading] = useState(false);
                const [loadError, setLoadError] = useState<string | null>(null);

                // When modal opens, fetch storyboards
                useEffect(() => {
                  if (showLoadModal) {
                    setIsLoading(true);
                    setLoadError(null);

                    // Fetch storyboards
                    const fetchStoryboards = async () => {
                      try {
                        // Get IDs from context
                        const storyboardIds = await getSavedStoryboards();

                        // Fetch full storyboard details
                        const storyboardsData: Storyboard[] = [];
                        for (const id of storyboardIds) {
                          try {
                            const storyboard = await MovieStorageApi.getMovie(id);
                            if (storyboard) {
                              storyboardsData.push(storyboard);
                            }
                          } catch (err) {
                            console.error(`Error fetching storyboard ${id}:`, err);
                          }
                        }

                        // Sort by updated date (newest first)
                        storyboardsData.sort((a, b) =>
                          new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
                        );

                        setLoadedStoryboards(storyboardsData);
                      } catch (error) {
                        console.error('Error fetching storyboards:', error);
                        setLoadError('Failed to load storyboards');
                      } finally {
                        setIsLoading(false);
                      }
                    };

                    fetchStoryboards();
                  }
                }, [showLoadModal]); // Remove savedStoryboards from dependencies

                // Display loading state
                if (isLoading) {
                  return <p className="text-gray-400">Loading storyboards...</p>;
                }

                // Display error state
                if (loadError) {
                  return <p className="text-red-400">{loadError}</p>;
                }

                // Display empty state
                if (loadedStoryboards.length === 0) {
                  return <p className="text-gray-400">No saved storyboards found.</p>;
                }

                // Display storyboards list
                return loadedStoryboards.map((storyboard) => (
                  <div
                    key={storyboard.id}
                    className="border border-gray-700 hover:border-bat-yellow rounded-md p-3 mb-2"
                  >
                    <div
                      className="cursor-pointer"
                      onClick={async () => {
                        await loadStoryboard(storyboard.id);
                        setShowLoadModal(false);
                      }}
                    >
                      <div className="font-medium text-bat-yellow">{storyboard.name}</div>
                      <div className="text-sm text-gray-400 mt-1">
                        {storyboard.clips?.length || 0} clips
                      </div>
                      <div className="text-xs text-gray-500 mt-1">
                        Updated: {new Date(storyboard.updatedAt).toLocaleString()}
                      </div>
                    </div>
                    <div className="mt-2 pt-2 border-t border-gray-700">
                      <button
                        className="text-xs text-red-400 hover:text-red-300"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStoryboardToDelete(storyboard.id);
                          setShowDeleteConfirmation(true);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                ));
              })()}
            </div>
          </div>
        }
        confirmText="Close"
        cancelText={undefined}
        onConfirm={() => setShowLoadModal(false)}
        onCancel={() => {}}
      />

      {/* Delete Storyboard Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Delete Storyboard"
        message="Are you sure you want to delete this storyboard? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={async () => {
          if (storyboardToDelete) {
            await deleteStoryboard(storyboardToDelete);
            setStoryboardToDelete(null);
            setShowDeleteConfirmation(false);
          }
        }}
        onCancel={() => {
          setStoryboardToDelete(null);
          setShowDeleteConfirmation(false);
        }}
      />
    </div>
  );
};

export default MovieEditorPage;
