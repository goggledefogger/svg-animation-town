import React, { useState } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMovie } from '../contexts/MovieContext';
import StoryboardPanel from '../components/StoryboardPanel';
import AnimationCanvas from '../components/AnimationCanvas';
import AnimationControls from '../components/AnimationControls';
import StoryboardGeneratorModal from '../components/StoryboardGeneratorModal';
import { MovieApi, StoryboardResponse } from '../services/movie.api';
import ConfirmationModal from '../components/ConfirmationModal';
import { AnimationApi } from '../services/api';
import { MovieClip } from '../contexts/MovieContext';
import { Message } from '../contexts/AnimationContext';

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
    setCurrentStoryboard
  } = useMovie();

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
      saveStoryboard();
      console.log(`Storyboard saved with ${newStoryboard.clips.length} clips`);

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

          {/* Timeline controls */}
          <div className="h-16 border-t border-gray-700 bg-gotham-black p-2 flex items-center">
            <button
              className="btn btn-circle mr-2"
              onClick={() => setIsPlaying(!isPlaying)}
              aria-label={isPlaying ? 'Pause' : 'Play'}
            >
              {isPlaying ? (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6" />
                </svg>
              ) : (
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
                </svg>
              )}
            </button>
            <div className="flex-1 h-2 bg-gray-700 rounded-full">
              {/* Playback progress bar */}
              <div className="h-full bg-bat-yellow rounded-full" style={{ width: '30%' }}></div>
            </div>
          </div>
        </div>

        {/* Right panel - Clip Editor */}
        <div className="w-1/4 border-l border-gray-700 bg-gotham-black p-4 overflow-y-auto">
          <h2 className="text-lg font-semibold mb-4">Clip Editor</h2>
          {/* Clip properties editor */}
          {activeClipId ? (
            <div>
              <p>Edit clip properties</p>
              {/* Form fields for clip properties will go here */}
            </div>
          ) : (
            <div className="text-gray-400">
              Select a clip to edit or create a new one
            </div>
          )}
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
