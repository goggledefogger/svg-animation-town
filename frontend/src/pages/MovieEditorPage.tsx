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

  const [showConfirmationModal, setShowConfirmationModal] = useState(false);
  const [showDeleteConfirmationModal, setShowDeleteConfirmationModal] = useState(false);

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
      const scenePromises = storyboard.scenes.map(async (scene, i) => {
        // Convert i to the absolute scene index (for the entire storyboard)
        const absoluteSceneIndex = i + startingSceneIndex;

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
          let retryCount = 0;
          const maxRetries = 1; // One retry attempt

          while (retryCount <= maxRetries) {
            try {
              // Set a timeout to handle the case where the API request hangs
              const timeoutMs = parseInt(import.meta.env.VITE_SCENE_GENERATION_TIMEOUT_MS || '300000', 10);

              // Generate without a manual timeout promise - rely on the API's built-in timeout
              result = await AnimationApi.generate(scene.svgPrompt, aiProvider);

              // If we got here, the generation was successful
              break;
            } catch (generateError) {
              console.error(`Error generating scene ${absoluteSceneIndex+1} (attempt ${retryCount + 1}):`, generateError);

              // Check if it's an abort error - most likely a timeout
              const isAbortError = generateError instanceof Error &&
                (generateError.message.includes('aborted') ||
                 generateError.message.includes('abort') ||
                 generateError.name === 'AbortError');

              if (isAbortError && retryCount < maxRetries) {
                // Only retry for abort/timeout errors
                console.log(`Retrying scene ${absoluteSceneIndex+1} generation after abort/timeout`);
                retryCount++;
                // Short delay before retry
                await new Promise(resolve => setTimeout(resolve, 1000));
                continue;
              }

              // Either not an abort error or we've reached max retries
              throw new Error(`Failed to generate SVG: ${generateError instanceof Error ? generateError.message : 'Unknown error'}`);
            }
          }

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
              animationId: result.animationId
            };

            if (!result.animationId) {
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

          // Log the error details
          errors.push({
            sceneIndex: absoluteSceneIndex,
            error: sceneError instanceof Error ? sceneError.message : String(sceneError)
          });
        }
      });

      try {
        // Wait for all scene generation to complete
        await Promise.all(scenePromises);

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
    <div className="flex flex-col h-screen overflow-hidden bg-gotham-black text-white">
      {/* Header */}
      <Header
        onExport={() => handleExport('svg')}
        onSave={handleSave}
        onLoad={() => setShowLoadModal(true)}
        onGenerate={() => setShowStoryboardGeneratorModal(true)}
        storyboardName={currentStoryboard.name}
        onReset={resetApplication}
      />

      {/* Main content area with flex layout */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Animation view and controls - take less space on mobile */}
        <div className="flex-1 flex flex-col min-h-0 overflow-hidden md:h-full md:max-h-full">
          {activeClipId ? (
            <>
              <div className="flex-1 h-full flex items-center justify-center">
                <AnimationCanvas />
              </div>
              <AnimationControls />
            </>
          ) : (
            <div className="flex items-center justify-center h-full bg-gray-900">
              <div className="text-center">
                <p className="text-lg text-gray-400 mb-4">No clip selected</p>
                <button
                  className="px-4 py-2 bg-gray-800 text-white rounded hover:bg-gray-700"
                  onClick={handleAddClip}
                >
                  Add your first clip
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Storyboard panel - taller on mobile */}
        <div className="md:w-80 h-64 md:h-auto flex-shrink-0 overflow-hidden border-t md:border-t-0 md:border-l border-gray-700">
          <StoryboardPanel
            clips={currentStoryboard.clips}
            activeClipId={activeClipId}
            onClipSelect={handleClipSelect}
            onAddClip={handleAddClip}
            storyboard={currentStoryboard}
          />
        </div>
      </div>

      {/* Modals */}
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

      {/* Error Modal */}
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
                // Use state to track loaded storyboards
                const [loadedStoryboards, setLoadedStoryboards] = useState<Storyboard[]>([]);
                const [isLoadingStoryboards, setIsLoadingStoryboards] = useState(false);
                const [loadError, setLoadError] = useState<string | null>(null);

                // Load storyboards when modal opens
                useEffect(() => {
                  if (showLoadModal) {
                    setIsLoadingStoryboards(true);

                    const fetchStoryboards = async () => {
                      try {
                        // Get list of storyboard IDs
                        const storyboardIds = await getSavedStoryboards();

                        // Fetch details for each storyboard
                        const storyboardsData: Storyboard[] = [];
                        for (const id of storyboardIds) {
                          try {
                            const storyboard = await MovieStorageApi.getMovie(id);
                            if (storyboard) {
                              storyboardsData.push(storyboard as Storyboard);
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
                      } catch (err) {
                        console.error('Error loading storyboards:', err);
                        setLoadError('Failed to load storyboards');
                      } finally {
                        setIsLoadingStoryboards(false);
                      }
                    };

                    fetchStoryboards();
                  }
                }, [showLoadModal]);

                // Show loading state
                if (isLoadingStoryboards) {
                  return <p className="text-gray-400">Loading storyboards...</p>;
                }

                // Show error
                if (loadError) {
                  return <p className="text-red-400">{loadError}</p>;
                }

                // Show empty state
                if (loadedStoryboards.length === 0) {
                  return <p className="text-gray-400">No saved storyboards found.</p>;
                }

                // Show list of storyboards
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
