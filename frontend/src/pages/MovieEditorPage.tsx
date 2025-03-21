import React, { useState, useEffect, useCallback } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useMovie } from '../contexts/MovieContext';
import StoryboardPanel from '../components/StoryboardPanel';
import AnimationCanvas from '../components/AnimationCanvas';
import AnimationControls from '../components/AnimationControls';
import StoryboardGeneratorModal from '../components/StoryboardGeneratorModal';
import { MovieApi, StoryboardResponse, StoryboardScene } from '../services/movie.api';
import ConfirmationModal from '../components/ConfirmationModal';
import { AnimationApi, AnimationStorageApi, MovieStorageApi } from '../services/api';
import { MovieClip, Storyboard } from '../contexts/MovieContext';
import { Message } from '../contexts/AnimationContext';
import ClipEditor from '../components/ClipEditor';
import Header from '../components/Header';
import SvgThumbnail from '../components/SvgThumbnail';
import { useNavigate, useParams } from 'react-router-dom';
import { useAnimation } from '../contexts/AnimationContext';
import Toast from '../components/Toast';
import LoadStoryboardModal from '../components/LoadStoryboardModal';

// Import custom hooks
import { useModalManager } from '../hooks/useModalManager';
import { useStoryboardOperations } from '../hooks/useStoryboardOperations';
import { useStoryboardGenerator } from '../hooks/useStoryboardGenerator';
import { usePlaybackController } from '../hooks/usePlaybackController';

// Import the new session storage utility
import {
  getPendingAnimation,
  clearPendingAnimation,
  setPendingClipName,
  clearCacheForServerRefresh
} from '../utils/sessionStorageUtils';

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
    addClip,
    renameStoryboard
  } = useMovie();

  // Initialize the custom hooks
  const modalManager = useModalManager();
  const storyboardOps = useStoryboardOperations(modalManager.showToastNotification);
  const playbackController = usePlaybackController();
  const storyboardGenerator = useStoryboardGenerator(
    modalManager.setShowGeneratingClipsModal,
    modalManager.setShowStoryboardGeneratorModal,
    modalManager.setShowErrorModal
  );

  const navigate = useNavigate();

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
              const storyboardsList = Object.values(storyboards) as Array<{
                id: string;
                name: string;
                updatedAt: string | Date;
                clips?: Array<any>;
              }>;

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

  // Add a new function to handle proper storyboard creation
  const handleCreateNewStoryboard = useCallback(() => {
    console.log('Creating new storyboard and resetting generation check flag');
    // Clear the incomplete check flag to ensure it doesn't interfere with new storyboards
    sessionStorage.removeItem('hasCheckedIncompleteGeneration');
    // Create a new storyboard
    createNewStoryboard();
  }, [createNewStoryboard]);

  // Update the URL parameter handling
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
            // Create new storyboard with the reset function
            handleCreateNewStoryboard();
          } else {
            modalManager.showToastNotification(`Storyboard loaded successfully!`);
          }
        } catch (error) {
          console.error(`Error loading movie with ID ${movieId}:`, error);
          alert(`Error loading movie: ${error instanceof Error ? error.message : 'Unknown error'}. Creating a new storyboard instead.`);
          // Create new storyboard with the reset function
          handleCreateNewStoryboard();
        }
      };

      loadMovieFromUrl();
    }
  }, [loadStoryboard, handleCreateNewStoryboard]);

  // Create a utility function to add an existing animation as a clip
  const addExistingAnimationAsClip = async (animationId: string, animationName: string) => {
    console.log(`Adding existing animation as clip: ${animationName} (ID: ${animationId})`);

    try {
      // Get animation content
      const animation = await AnimationStorageApi.getAnimation(animationId);

      if (animation && animation.svg) {
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
          name: animationName,
          svgContent: animation.svg,
          duration: 5, // Default duration
          animationId: animationId,
          prompt: prompt,
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

  // Update the useEffect to use the consolidated function
  useEffect(() => {
    const checkForPendingAnimation = async () => {
      const pendingAnimation = getPendingAnimation();

      if (pendingAnimation) {
        try {
          await addExistingAnimationAsClip(pendingAnimation.id, pendingAnimation.name);

          // Clear the pending animation data
          clearPendingAnimation();
        } catch (error) {
          console.error('Error adding pending animation:', error);
        }
      }
    };

    checkForPendingAnimation();
  }, [addClip, setActiveClipId]);

  // Update handleAddClip to use utility functions
  const handleAddClip = () => {
    // Check if we have a pending animation to add directly
    const pendingAnimation = getPendingAnimation();

    if (pendingAnimation) {
      // Add the existing animation and clear the session storage
      addExistingAnimationAsClip(pendingAnimation.id, pendingAnimation.name)
        .then(success => {
          if (success) {
            // Clear the pending animation data
            clearPendingAnimation();
          }
        });
    } else {
      // Set a default name that can be changed later
      setPendingClipName('New Clip');

      // Navigate to the animation editor
      navigate('/');
    }
  };

  // Add a new effect to check for incomplete generations when the page loads
  useEffect(() => {
    // Skip if we don't have a storyboard yet or if we're already generating something
    if (!currentStoryboard || storyboardGenerator.isGenerating) return;
    
    // Use storyboard ID in the check to avoid checking the same board multiple times
    const checkKey = `hasCheckedIncompleteGeneration_${currentStoryboard.id}`;
    const hasCheckedIncomplete = sessionStorage.getItem(checkKey);

    if (hasCheckedIncomplete === 'true') {
      // Already checked this specific storyboard
      return;
    }

    const checkIncompleteGenerations = async () => {
      try {
        // Check if there's a current storyboard that's incomplete
        if (currentStoryboard.generationStatus?.inProgress) {
          console.log('Found incomplete storyboard generation:', {
            id: currentStoryboard.id,
            name: currentStoryboard.name,
          });

          // Set the flag to prevent checking this storyboard again
          sessionStorage.setItem(checkKey, 'true');

          // Show a confirmation to the user
          const shouldResume = window.confirm(
            `It looks like you have an incomplete movie generation "${currentStoryboard.name}". Would you like to resume where you left off?`
          );

          if (shouldResume) {
            console.log('Resuming generation for storyboard:', currentStoryboard.id);
            // Show the generating clips modal
            modalManager.setShowGeneratingClipsModal(true);
            storyboardGenerator.setIsGenerating(true);

            // Determine which AI provider was being used
            const aiProvider = currentStoryboard.aiProvider || 'openai';

            // We need to create a faux storyboard response from the existing storyboard
            const resumeStoryboardResponse = {
              title: currentStoryboard.name,
              description: currentStoryboard.description || '',
              scenes: [] as StoryboardScene[] // Properly typed as StoryboardScene[]
            };

            // If we have the original scenes data stored, use it
            if (currentStoryboard.originalScenes && currentStoryboard.originalScenes.length > 0) {
              resumeStoryboardResponse.scenes = currentStoryboard.originalScenes;
            } else {
              // Attempt to reconstruct scenes from existing clips
              currentStoryboard.clips.forEach((clip, index) => {
                // Only add if we have the necessary data
                if (clip.prompt) {
                  resumeStoryboardResponse.scenes.push({
                    id: clip.id,
                    description: clip.name,
                    svgPrompt: clip.prompt,
                    duration: clip.duration || 5,
                    provider: aiProvider as 'openai' | 'claude'
                  });
                }
              });
              
              // If we still couldn't reconstruct any scenes, show an error
              if (resumeStoryboardResponse.scenes.length === 0) {
                console.error('Could not reconstruct scenes from existing clips');
                modalManager.showToastNotification('Could not resume generation - missing scene data', 'error');
                modalManager.setShowGeneratingClipsModal(false);
                storyboardGenerator.setIsGenerating(false);
                
                // Clear the inProgress flag to prevent future attempts
                const updatedStoryboard = {
                  ...currentStoryboard,
                  generationStatus: {
                    ...currentStoryboard.generationStatus,
                    inProgress: false,
                    error: 'Missing scene data for resume'
                  }
                };
                setCurrentStoryboard(updatedStoryboard);
                saveStoryboard();
                return;
              }
            }

            // Check if we actually have scenes remaining based on clips already generated
            const clipCount = currentStoryboard.clips?.length || 0;
            const sceneCount = resumeStoryboardResponse.scenes.length;
            
            if (clipCount >= sceneCount) {
              modalManager.showToastNotification('All scenes already completed, no need to resume', 'info');
              modalManager.setShowGeneratingClipsModal(false);
              storyboardGenerator.setIsGenerating(false);
              
              // Mark as completed
              const updatedStoryboard = {
                ...currentStoryboard,
                generationStatus: {
                  ...currentStoryboard.generationStatus,
                  inProgress: false,
                  completedAt: new Date()
                }
              };
              setCurrentStoryboard(updatedStoryboard);
              saveStoryboard();
              return;
            }

            // Resume from the last completed scene
            try {
              await storyboardGenerator.resumeStoryboardGeneration(currentStoryboard, resumeStoryboardResponse, aiProvider);
            } catch (error) {
              console.error('Error during resume generation:', error);
              // Clear the inProgress flag to prevent future attempts
              const updatedStoryboard = {
                ...currentStoryboard,
                generationStatus: {
                  ...currentStoryboard.generationStatus,
                  inProgress: false,
                  error: error instanceof Error ? error.message : 'Unknown error during resume'
                }
              };
              setCurrentStoryboard(updatedStoryboard);
              saveStoryboard();
              
              modalManager.showToastNotification('Failed to resume generation', 'error');
            } finally {
              modalManager.setShowGeneratingClipsModal(false);
              storyboardGenerator.setIsGenerating(false);
            }
          } else {
            // User declined to resume - clear the inProgress flag
            const updatedStoryboard = {
              ...currentStoryboard,
              generationStatus: {
                ...currentStoryboard.generationStatus,
                inProgress: false
              }
            };
            setCurrentStoryboard(updatedStoryboard);
            saveStoryboard();
          }
        }
      } catch (error) {
        console.error('Error checking for incomplete generations:', error);
        // Set the flag to prevent infinite loop
        sessionStorage.setItem(checkKey, 'true');
      }
    };

    // Run the check
    checkIncompleteGenerations();
  }, [currentStoryboard?.id, storyboardGenerator.isGenerating]); // Only depend on storyboard ID, not the entire object

  // Add a reset function to clear the incomplete check flag when creating a new storyboard
  useEffect(() => {
    // Clear the incomplete check flag when creating a new storyboard
    if (currentStoryboard && !currentStoryboard.generationStatus?.inProgress) {
      sessionStorage.removeItem('hasCheckedIncompleteGeneration');
    }
  }, [currentStoryboard?.id]);

  // Function to reset application state
  const resetApplication = useCallback(() => {
    // Clear localStorage
    localStorage.removeItem('svg-animator-storyboards');

    // Clear sessionStorage animation state using utility function
    clearCacheForServerRefresh();

    // Create a new empty storyboard
    createNewStoryboard();

    // Clear URL parameters
    window.history.replaceState({}, document.title, window.location.pathname);

    // Reload the page to ensure a clean state
    window.location.reload();

    // Clear sessionStorage flags
    sessionStorage.removeItem('hasCheckedIncompleteGeneration');
  }, [createNewStoryboard]);

  const handleClipSelect = (clipId: string) => {
    setActiveClipId(clipId);
  };

  // Function to handle showing the rename modal
  const handleShowRenameModal = () => {
    storyboardOps.setStoryboardName(currentStoryboard.name);
    modalManager.setShowRenameModal(true);
  };

  // Handle save click with modal selection logic
  const handleSaveClick = async () => {
    const result = await storyboardOps.handleSave();

    // If null returned, show the save modal
    if (result === null) {
      storyboardOps.setStoryboardName(currentStoryboard.name);
      modalManager.setShowSaveModal(true);
    }
  };

  // Add a function to handle clip updates
  const handleClipUpdate = useCallback(() => {
    // This will be called when the clip is updated
    // We can use it to trigger refreshes or show notifications
    modalManager.showToastNotification("Clip updated successfully", "success");
  }, [modalManager]);

  return (
    <>
      <div className="flex flex-col h-screen overflow-hidden bg-gotham-black text-white">
        {/* Header */}
        <Header
          onExport={() => storyboardOps.handleExport('svg')}
          onSave={handleSaveClick}
          onLoad={() => modalManager.setShowLoadModal(true)}
          onGenerate={() => modalManager.setShowStoryboardGeneratorModal(true)}
          onRename={handleShowRenameModal}
          storyboardName={currentStoryboard.name}
          onReset={resetApplication}
        />

        {/* Main content area with flex layout */}
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          {/* Storyboard panel - on the left (desktop) or bottom (mobile) */}
          <div className="md:w-80 h-auto max-h-[40vh] min-h-[200px] md:max-h-none md:h-auto flex-shrink-0 overflow-hidden border-t md:border-t-0 md:border-r border-gray-700 order-2 md:order-1 mb-[30px] md:mb-0 bg-gray-900">
            <StoryboardPanel
              clips={currentStoryboard.clips}
              activeClipId={activeClipId}
              onClipSelect={handleClipSelect}
              onAddClip={handleAddClip}
              storyboard={currentStoryboard}
              generationProgress={storyboardGenerator.generationProgress}
              isGenerating={storyboardGenerator.isGenerating}
            />
          </div>

          {/* Middle section - Animation view and controls */}
          <div className="flex-1 flex flex-col min-h-0 overflow-hidden h-[calc(100vh-var(--header-height)-var(--storyboard-height,40vh)-30px)] md:h-full md:max-h-full order-1 md:order-2">
            {activeClipId ? (
              <>
                <div className="flex-1 h-full flex items-center justify-center w-full overflow-hidden">
                  <div className="w-full max-w-full px-2 md:px-0">
                    <AnimationCanvas />
                  </div>
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

          {/* Right sidebar - Clip Editor (desktop only) */}
          {activeClipId && (
            <div className="hidden md:block md:w-72 border-l border-gray-700 bg-gray-800 p-4 overflow-y-auto order-3">
              <h3 className="text-lg font-medium text-white mb-4">Clip Properties</h3>
              <ClipEditor onClipUpdate={handleClipUpdate} />
            </div>
          )}
        </div>

        {/* Modals */}
        {/* StoryboardGenerator Modal */}
        <StoryboardGeneratorModal
          isOpen={modalManager.showStoryboardGeneratorModal}
          onCancel={() => modalManager.setShowStoryboardGeneratorModal(false)}
          onGenerate={storyboardGenerator.handleGenerateStoryboard}
          isLoading={storyboardGenerator.isGenerating}
        />

        {/* Generating Clips Progress Modal */}
        <ConfirmationModal
          isOpen={modalManager.showGeneratingClipsModal}
          title="Generating Clips"
          message={
            <div className="mt-2">
              <p className="text-center mb-4">
                {storyboardGenerator.generationProgress.resumedFrom ?
                  `Resuming animation generation from scene ${storyboardGenerator.generationProgress.resumedFrom + 1}...` :
                  `Creating animations for each scene in your storyboard...`
                }
              </p>
              <div className="w-full bg-gray-700 rounded-full h-2.5">
                <div
                  className="bg-bat-yellow h-2.5 rounded-full"
                  style={{
                    width: `${storyboardGenerator.generationProgress.total ?
                      (storyboardGenerator.generationProgress.current / storyboardGenerator.generationProgress.total) * 100 : 0}%`
                  }}
                ></div>
              </div>
              <p className="text-center mt-2 text-sm text-gray-400">
                {Math.floor(storyboardGenerator.generationProgress.current)} of {storyboardGenerator.generationProgress.total} scenes completed
                {storyboardGenerator.generationProgress.resumedFrom ?
                  ` (resumed from scene ${storyboardGenerator.generationProgress.resumedFrom + 1})` :
                  ''
                }
              </p>
              <p className="text-center mt-2 text-sm text-gray-400">
                This may take a few minutes. Please don't close this window.
              </p>
              {storyboardGenerator.generationProgress.resumedFrom && (
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
          isOpen={modalManager.showErrorModal}
          title="Storyboard Generation Error"
          message={
            <div className="mt-2">
              <p className="text-center mb-4 text-red-500">
                Failed to generate storyboard
              </p>
              <p className="text-sm text-gray-300 bg-gotham-gray p-3 rounded max-h-60 overflow-y-auto">
                {storyboardGenerator.generationError || 'Unknown error occurred'}
              </p>
              <p className="text-center mt-4 text-sm text-gray-400">
                Please try again with a different prompt or AI provider.
              </p>
            </div>
          }
          confirmText="OK"
          cancelText={undefined}
          onConfirm={() => modalManager.setShowErrorModal(false)}
          onCancel={() => modalManager.setShowErrorModal(false)}
        />

        {/* Save Modal */}
        <ConfirmationModal
          isOpen={modalManager.showSaveModal}
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
                value={storyboardOps.storyboardName}
                onChange={(e) => storyboardOps.setStoryboardName(e.target.value)}
                autoFocus
              />
            </div>
          }
          confirmText="Save"
          cancelText="Cancel"
          onConfirm={async () => {
            const success = await storyboardOps.handleSaveWithName();
            if (success) {
              modalManager.setShowSaveModal(false);
            }
          }}
          onCancel={() => modalManager.setShowSaveModal(false)}
        />

        {/* Rename Modal */}
        <ConfirmationModal
          isOpen={modalManager.showRenameModal}
          title="Rename Storyboard"
          message={
            <div className="mt-2">
              <label htmlFor="renameStoryboard" className="block text-sm font-medium text-gray-300">
                Storyboard Name
              </label>
              <input
                type="text"
                id="renameStoryboard"
                className="input"
                placeholder="Enter a new name for your storyboard"
                value={storyboardOps.storyboardName}
                onChange={(e) => storyboardOps.setStoryboardName(e.target.value)}
                autoFocus
              />
            </div>
          }
          confirmText="Rename"
          cancelText="Cancel"
          onConfirm={async () => {
            const success = await storyboardOps.handleRename();
            if (success) {
              modalManager.setShowRenameModal(false);
            }
          }}
          onCancel={() => modalManager.setShowRenameModal(false)}
        />

        {/* Delete Storyboard Confirmation */}
        <ConfirmationModal
          isOpen={modalManager.showDeleteConfirmation}
          title="Delete Storyboard"
          message="Are you sure you want to delete this storyboard? This action cannot be undone."
          confirmText="Delete"
          cancelText="Cancel"
          onConfirm={async () => {
            if (modalManager.storyboardToDelete) {
              await deleteStoryboard(modalManager.storyboardToDelete);
              modalManager.setStoryboardToDelete(null);
              modalManager.setShowDeleteConfirmation(false);
            }
          }}
          onCancel={() => {
            modalManager.setStoryboardToDelete(null);
            modalManager.setShowDeleteConfirmation(false);
          }}
        />
      </div>

      {/* Move the LoadStoryboardModal outside all containers to ensure it's not constrained */}
      <LoadStoryboardModal
        isOpen={modalManager.showLoadModal}
        onClose={() => modalManager.setShowLoadModal(false)}
        onLoadStoryboard={async (id) => {
          const success = await loadStoryboard(id);
          if (success) {
            modalManager.showToastNotification(`Storyboard loaded successfully!`);
          }
          return success;
        }}
        onDeleteStoryboard={async (id) => {
          const success = await deleteStoryboard(id);
          if (success) {
            modalManager.showToastNotification(`Storyboard deleted successfully!`);
            // Increment refresh trigger to reload storyboards in load modal
            storyboardOps.setLoadModalRefreshTrigger(prev => prev + 1);
          }
          return success;
        }}
        getSavedStoryboards={getSavedStoryboards}
        refreshTrigger={storyboardOps.loadModalRefreshTrigger}
      />

      {/* Toast Notification */}
      <Toast
        message={modalManager.toastMessage}
        type={modalManager.toastType}
        show={modalManager.showToast}
      />

      {/* Mobile Clip Editor modal */}
      {activeClipId && modalManager.showMobileClipEditor && (
        <div className="fixed inset-0 z-50 flex md:hidden items-center justify-center p-4 bg-black/50">
          <div className="bg-gray-800 border border-gray-700 rounded-lg shadow-lg w-full max-w-md max-h-[80vh] flex flex-col overflow-hidden">
            {/* Header */}
            <div className="bg-gray-800 border-b border-gray-700 p-4 flex justify-between items-center">
              <h2 className="text-lg font-medium text-white">Edit Clip</h2>
              <button
                onClick={() => modalManager.setShowMobileClipEditor(false)}
                className="text-gray-400 hover:text-white"
                aria-label="Close"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
                </svg>
              </button>
            </div>
            {/* Content */}
            <div className="flex-1 overflow-auto p-4">
              <ClipEditor onClipUpdate={() => {
                handleClipUpdate();
                modalManager.setShowMobileClipEditor(false);
              }} />
            </div>
          </div>
        </div>
      )}

      {/* Floating action button for mobile to open the clip editor */}
      {activeClipId && (
        <button
          className="md:hidden fixed right-4 bottom-4 z-40 w-14 h-14 rounded-full bg-bat-yellow text-black flex items-center justify-center shadow-lg"
          onClick={() => modalManager.setShowMobileClipEditor(true)}
          aria-label="Edit clip"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M15.232 5.232l3.536 3.536m-2.036-5.036a2.5 2.5 0 113.536 3.536L6.5 21.036H3v-3.572L16.732 3.732z" />
          </svg>
        </button>
      )}
    </>
  );
};

export default MovieEditorPage;
