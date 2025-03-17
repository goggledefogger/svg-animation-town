import React, { useState, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMovie } from '../contexts/MovieContext';
import StoryboardPanel from '../components/StoryboardPanel';
import AnimationCanvas from '../components/AnimationCanvas';
import AnimationControls from '../components/AnimationControls';
import StoryboardGeneratorModal from '../components/StoryboardGeneratorModal';
import { MovieApi, StoryboardResponse } from '../services/movie.api';
import ConfirmationModal from '../components/ConfirmationModal';
import { AnimationApi } from '../services/api';
import { MovieClip, Storyboard } from '../contexts/MovieContext';
import { Message } from '../contexts/AnimationContext';
import ClipEditor from '../components/ClipEditor';

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
    setCurrentPlaybackPosition
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
    const savedStoryboardIds = savedStoryboards;
    if (savedStoryboardIds.length > 0 && currentStoryboard.clips.length === 0) {
      // Sort by last updated date and load the most recent one
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
            loadStoryboard(newestStoryboard.id);
          }
        } catch (error) {
          console.error('Error loading most recent storyboard:', error);
        }
      }
    }
  }, [savedStoryboards, currentStoryboard.clips.length, loadStoryboard]);

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

  const handleClipSelect = (clipId: string) => {
    setActiveClipId(clipId);
  };

  const handleSave = () => {
    saveStoryboard();
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
    // Show the progress modal
    setShowGeneratingClipsModal(true);
    setGenerationProgress({ current: 0, total: storyboard.scenes.length });

    try {
      // Create a new storyboard object to fill with clips
      const newStoryboard = {
        id: uuidv4(),
        name: storyboard.title || 'New Movie',
        description: storyboard.description || '',
        clips: [] as MovieClip[],
        createdAt: new Date(),
        updatedAt: new Date()
      };

      // Track any scene generation errors
      const errors: { sceneIndex: number, error: string }[] = [];

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

          // Add this scene to the storyboard
          const newClip: MovieClip = {
            id: uuidv4(),
            name: `Scene ${i + 1}: ${scene.id || 'Untitled'}`,
            svgContent: result.svg,
            duration: scene.duration || 5,
            order: i,
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
            }]
          };

          newStoryboard.clips.push(newClip);
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

      // Check if we have any successful clips
      if (newStoryboard.clips.length === 0) {
        throw new Error(`Failed to generate any scenes for the storyboard. ${errors.length > 0 ?
          `Errors: ${errors.map(e => `Scene ${e.sceneIndex + 1}: ${e.error}`).join(', ')}` : ''}`);
      }

      // If there were some errors but not all
      if (errors.length > 0) {
        console.warn(`Generated ${newStoryboard.clips.length} scenes but ${errors.length} failed`);
      }

      // Set the new storyboard with all clips
      setCurrentStoryboard(newStoryboard);

      // Set the first clip as active if available
      if (newStoryboard.clips.length > 0) {
        setActiveClipId(newStoryboard.clips[0].id);
      }

      // Save the new storyboard
      await saveStoryboard();
      console.log(`Storyboard saved with ${newStoryboard.clips.length} clips`);

      // Force refresh the state to make sure UI updates
      const refreshedStoryboard = {...newStoryboard, updatedAt: new Date()};
      setCurrentStoryboard(refreshedStoryboard);

      // Hide the progress modal
      setShowGeneratingClipsModal(false);
      setIsGenerating(false);

      // Show warning if some scenes failed
      if (errors.length > 0) {
        const errorMessage = `Generated ${newStoryboard.clips.length} out of ${storyboard.scenes.length} scenes.
        ${errors.length} scenes failed to generate.`;
        setGenerationError(errorMessage);
        setShowErrorModal(true);
      }
    } catch (error) {
      console.error('Error processing storyboard:', error);

      // Set error and show error modal
      setGenerationError(error instanceof Error ? error.message : 'Unknown error processing storyboard');
      setShowErrorModal(true);

      setShowGeneratingClipsModal(false);
      setIsGenerating(false);
    }
  };

  return (
    <div className="flex flex-col h-screen h-mobile-screen overflow-hidden">
      {/* Header for Movie Editor */}
      <header className="bg-gotham-black p-4 shadow-lg border-b border-gray-700 flex justify-between items-center">
        <div className="flex items-center">
          <h1 className="text-lg md:text-xl font-bold mr-4 text-bat-yellow">
            {currentStoryboard.name || 'New Movie'}
          </h1>
        </div>

        <div className="flex space-x-2">
          <button
            className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
            onClick={() => setShowStoryboardGeneratorModal(true)}
            aria-label="Generate"
          >
            <svg
              className="w-4 h-4 md:mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <span className="hidden md:inline">Generate with AI</span>
          </button>

          <button
            className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
            onClick={() => setShowSaveModal(true)}
            aria-label="Save"
          >
            <svg
              className="w-4 h-4 md:mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
              />
            </svg>
            <span className="hidden md:inline">Save</span>
          </button>

          <button
            className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
            onClick={() => setShowExportModal(true)}
            aria-label="Export"
          >
            <svg
              className="w-4 h-4 md:mr-1"
              fill="none"
              stroke="currentColor"
              viewBox="0 0 24 24"
              xmlns="http://www.w3.org/2000/svg"
            >
              <path
                strokeLinecap="round"
                strokeLinejoin="round"
                strokeWidth={2}
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
              />
            </svg>
            <span className="hidden md:inline">Export</span>
          </button>
        </div>
      </header>

      {/* Main content area */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Storyboard */}
        <div className="w-1/4 border-r border-gray-700 bg-gotham-black p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Storyboard</h2>
          {/* Add debugging info about clips */}
          <div className="text-xs text-gray-500 mb-2">
            {currentStoryboard.clips.length} clips available
          </div>
          {/* Storyboard panel component will be implemented separately */}
          <StoryboardPanel
            clips={currentStoryboard.clips}
            activeClipId={activeClipId}
            onClipSelect={handleClipSelect}
            onAddClip={handleAddClip}
          />
        </div>

        {/* Center panel - Animation Preview */}
        <div className="flex-1 flex flex-col">
          <div className="flex-grow p-4 flex flex-col">
            <AnimationCanvas />
            <AnimationControls />
          </div>
        </div>

        {/* Right panel - Clip Editor */}
        <div className="w-1/4 border-l border-gray-700 bg-gotham-black p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Clip Editor</h2>
          <ClipEditor onClipUpdate={() => {
            // This will be called when a clip is updated
            console.log('Clip updated successfully');
          }} />
        </div>
      </div>

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
        cancelText=""
        onConfirm={() => setShowErrorModal(false)}
        onCancel={() => setShowErrorModal(false)}
      />
    </div>
  );
};

export default MovieEditorPage;
