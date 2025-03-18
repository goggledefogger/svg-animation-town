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
    createNewStoryboard
  } = useMovie();

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

  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [storyboardName, setStoryboardName] = useState(currentStoryboard.name);
  const [showStoryboardGeneratorModal, setShowStoryboardGeneratorModal] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const [showGeneratingClipsModal, setShowGeneratingClipsModal] = useState(false);
  const [generationProgress, setGenerationProgress] = useState({ current: 0, total: 0 });
  const [clipName, setClipName] = useState('');
  const [showAddClipModal, setShowAddClipModal] = useState(false);
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

  const handleAddClip = () => {
    setClipName('');
    setShowAddClipModal(true);
  };

  const handleSaveClip = () => {
    if (clipName.trim()) {
      const clipId = saveCurrentAnimationAsClip(clipName.trim());
      if (clipId) {
        setActiveClipId(clipId);
      }
      setShowAddClipModal(false);
    }
  };

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

  // Process a storyboard response into clips
  const processStoryboard = async (storyboard: StoryboardResponse, aiProvider: 'openai' | 'claude') => {
    console.log('Beginning storyboard generation...');

    // Create a new storyboard
    const storyboardId = uuidv4(); // Generate a stable ID for the storyboard
    console.log(`Created new storyboard with ID: ${storyboardId}`);

    const newStoryboard: Storyboard = {
      id: storyboardId,
      name: storyboard.title || 'New Movie',
      description: storyboard.description || '',
      clips: [],
      createdAt: new Date(),
      updatedAt: new Date(),
      generationStatus: {
        inProgress: true,
        startedAt: new Date(),
        totalScenes: storyboard.scenes.length,
        completedScenes: 0
      }
    };

    try {
      // Set the initial storyboard and save it to the server right away
      setCurrentStoryboard(newStoryboard);

      // Save the initial storyboard to the server using direct API call
      console.log('Saving initial storyboard to server...');
      try {
        // Use direct API call to avoid stale state issues
        const result = await MovieStorageApi.saveMovie(newStoryboard);
        console.log(`Initial storyboard saved to server with ID: ${result.id}`);

        // CRITICAL: Store the server-assigned ID if different
        if (result.id !== storyboardId) {
          console.log(`Server assigned different ID: ${result.id} (original: ${storyboardId})`);
          newStoryboard.id = result.id;
        }
      } catch (error) {
        console.error('Error saving initial storyboard:', error);
      }

      // Track any scene generation errors
      const errors: { sceneIndex: number, error: string }[] = [];

      // Track successful clips locally to avoid state timing issues
      let successfulClipsCount = 0;

      // Generate each scene manually to track progress
      for (let i = 0; i < storyboard.scenes.length; i++) {
        const scene = storyboard.scenes[i];
        try {
          setGenerationProgress({ current: i, total: storyboard.scenes.length });

          console.log(`Generating SVG for scene ${i+1}/${storyboard.scenes.length}: ${scene.id || 'Untitled'}`);
          console.log(`Prompt: ${scene.svgPrompt.substring(0, 100)}${scene.svgPrompt.length > 100 ? '...' : ''}`);

          // Generate SVG for this scene
          const result = await AnimationApi.generate(scene.svgPrompt, aiProvider);

          // Verify the generated SVG is valid
          if (!result.svg || !result.svg.includes('<svg')) {
            throw new Error(`Invalid SVG generated for scene ${i+1}`);
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
          const sceneName = `Scene ${i + 1}: ${scene.id || 'Untitled'}`;
          console.log(`Generated scene ${i+1} with name: ${sceneName}`);

          // Use the animation ID returned from the API since the backend now saves animations automatically
          // If no ID is returned, log a warning but continue with local data
          if (!result.animationId) {
            console.warn(`No animation ID returned for scene ${i+1}, this may indicate the backend didn't save it`);
          } else {
            console.log(`Scene ${i+1} saved with animation ID: ${result.animationId}`);
          }

          // Add this scene to the storyboard
          const newClip: MovieClip = {
            id: uuidv4(),
            name: sceneName,
            svgContent: result.svg,
            duration: scene.duration || 5,
            order: i,
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
                completedScenes: (prevStoryboard.generationStatus?.completedScenes || 0) + 1
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
          console.log(`Storyboard updated with scene ${i+1} and saved to server`);

          console.log(`Successfully generated SVG for scene ${i+1}`);

          // Update progress
          setGenerationProgress({ current: i + 1, total: storyboard.scenes.length });
        } catch (error) {
          console.error(`Error generating clip for scene ${i}:`, error);
          errors.push({
            sceneIndex: i,
            error: error instanceof Error ? error.message : 'Unknown error'
          });
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

      // Update status to indicate failure
      setCurrentStoryboard(prevStoryboard => {
        const errorStoryboard = {
          ...prevStoryboard,
          updatedAt: new Date(),
          generationStatus: {
            ...prevStoryboard.generationStatus!,
            inProgress: false,
            completedAt: new Date()
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
      />

      {/* Main content area */}
      <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
        {/* Left panel - Storyboard (hidden on mobile, will appear below) */}
        <div className="hidden md:block md:w-1/4 border-r border-gray-700 bg-gotham-black p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Storyboard</h2>
          <div className="text-xs text-gray-500 mb-2">
            {currentStoryboard.clips.length} clips available
          </div>
          <StoryboardPanel
            clips={currentStoryboard.clips}
            activeClipId={activeClipId}
            onClipSelect={handleClipSelect}
            onAddClip={handleAddClip}
            storyboard={currentStoryboard}
          />
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
            <h2 className="text-lg font-semibold mb-2">Storyboard</h2>
            <div className="overflow-x-auto pb-4">
              <div className="inline-flex space-x-3 min-w-full">
                {currentStoryboard.clips.length === 0 ? (
                  <div className="flex flex-col items-center justify-center h-40 min-w-full border border-dashed border-gray-600 rounded-lg p-4">
                    <p className="text-gray-400 text-center mb-2">No clips in storyboard</p>
                    <button
                      className="btn btn-sm btn-outline"
                      onClick={handleAddClip}
                    >
                      Add Clip
                    </button>
                  </div>
                ) : (
                  <StoryboardPanel
                    clips={currentStoryboard.clips}
                    activeClipId={activeClipId}
                    onClipSelect={handleClipSelect}
                    onAddClip={handleAddClip}
                    storyboard={currentStoryboard}
                  />
                )}
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

      {/* Add Clip Modal */}
      <ConfirmationModal
        isOpen={showAddClipModal}
        title="Add Clip"
        message={
          <div className="mt-2">
            <label htmlFor="clipName" className="block text-sm font-medium text-gray-300">
              Clip Name
            </label>
            <input
              type="text"
              id="clipName"
              className="input"
              placeholder="Enter a name for your clip"
              value={clipName}
              onChange={(e) => setClipName(e.target.value)}
              autoFocus
            />
            <p className="mt-2 text-sm text-gray-400">
              This will save the current animation as a clip in your storyboard.
            </p>
          </div>
        }
        confirmText="Add Clip"
        cancelText="Cancel"
        onConfirm={handleSaveClip}
        onCancel={() => setShowAddClipModal(false)}
        confirmDisabled={!clipName.trim()}
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
              Creating animations for each scene in your storyboard...
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
            </p>
            <p className="text-center mt-2 text-sm text-gray-400">
              This may take a few minutes. Please don't close this window.
            </p>
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
