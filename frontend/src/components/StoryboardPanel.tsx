import React, { useState, useEffect, useCallback, useRef } from 'react';
import { MovieClip, Storyboard } from '../contexts/MovieContext';
import SvgThumbnail from './SvgThumbnail';
import { MovieStorageApi, AnimationStorageApi } from '../services/api';
import AnimationList, { AnimationItem } from './AnimationList';
import { useMovie } from '../contexts/MovieContext';

interface StoryboardPanelProps {
  clips: MovieClip[];
  activeClipId: string | null;
  onClipSelect: (clipId: string) => void;
  onAddClip: () => void;
  storyboard?: Storyboard; // Add storyboard prop to access generation status
  renderHeaderContent?: boolean; // Whether to render the header content or not
  generationProgress?: {
    current: number;
    total: number;
    resumedFrom?: number;
  };
  isGenerating?: boolean;
}

// Helper function to create a generation status component for reuse
export const GenerationStatusBadge: React.FC<{
  isGenerating: boolean;
  completedScenes: number;
  totalScenes: number;
  className?: string;
  showText?: boolean;
}> = ({ isGenerating, completedScenes, totalScenes, className = "", showText = true }) => {
  if (totalScenes === 0) return null;

  if (isGenerating) {
    return (
      <div className={`flex items-center text-xs text-gray-400 ${className}`}>
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-1"></div>
        {showText && `${completedScenes}/${totalScenes}`}
      </div>
    );
  } else if (completedScenes > 0) {
    const isComplete = completedScenes >= totalScenes;
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        {showText && (isComplete
          ? `${completedScenes}/${totalScenes} completed`
          : `${completedScenes}/${totalScenes} generated`)}
      </div>
    );
  }

  return null;
};

// Helper function to truncate prompt text
const truncatePrompt = (prompt: string | undefined, maxLength = 100) => {
  if (!prompt) return '';
  return prompt.length > maxLength ? `${prompt.substring(0, maxLength)}...` : prompt;
};

// Helper function to create a placeholder SVG
const createPlaceholderSvg = (message: string): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <rect width="800" height="600" fill="#1a1a2e" />
    <circle cx="400" cy="300" r="50" fill="#4a5568">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
    </circle>
    <text x="400" y="400" font-family="Arial" font-size="16" fill="white" text-anchor="middle">${message}</text>
  </svg>`;
};

const StoryboardPanel: React.FC<StoryboardPanelProps> = ({
  clips,
  activeClipId,
  onClipSelect,
  onAddClip,
  storyboard,
  renderHeaderContent = false,
  generationProgress,
  isGenerating: propIsGenerating
}) => {
  // Get removeClip from MovieContext to allow clip deletion
  const { removeClip } = useMovie();

  // Use provided values if available, fallback to storyboard values
  const hasGenerationStatus = storyboard?.generationStatus !== undefined || generationProgress !== undefined;
  const isGenerating = propIsGenerating !== undefined ? propIsGenerating : storyboard?.generationStatus?.inProgress === true;
  const totalScenes = generationProgress?.total || storyboard?.generationStatus?.totalScenes || 0;
  const completedScenes = generationProgress?.current || storyboard?.generationStatus?.completedScenes || 0;

  // Pass the storyboard status and progress to the children
  useEffect(() => {
    // No-op effect to track changes in generation status
  }, [hasGenerationStatus, isGenerating, completedScenes, totalScenes, storyboard?.generationStatus, generationProgress]);

  // Simple counter for display purposes
  const [displayCount, setDisplayCount] = useState(completedScenes);

  // Reset display count when generation starts/stops or when props change
  useEffect(() => {
    if (!isGenerating) {
      // When generation completes, show actual final count
      setDisplayCount(completedScenes);
    } else if (totalScenes > 0 && completedScenes > 0) {
      // When we're generating and the completed scenes have changed,
      // update the display count to match the new progress
      // Only update if the value has actually changed to prevent unnecessary re-renders
      if (Math.abs(displayCount - completedScenes) > 0.01) {
        setDisplayCount(completedScenes);
      }
    }
  }, [isGenerating, completedScenes, totalScenes]);

  // Simplified animation logic to avoid infinite loops and excessive renders
  useEffect(() => {
    // Only run animation when actively generating and we have valid counts
    if (!isGenerating || totalScenes === 0) return;

    // Don't animate if we're already at the target value
    // Use a tolerance to avoid floating point comparison issues
    if (Math.abs(displayCount - completedScenes) < 0.01) return;

    const timer = setInterval(() => {
      setDisplayCount(current => {
        // Calculate the next value with a small increment
        const next = Math.min(current + 0.1, completedScenes);

        // If we're very close to the target, just set it exactly
        if (Math.abs(next - completedScenes) < 0.01) {
          return completedScenes;
        }

        return next;
      });
    }, 300); // Slower updates to reduce CPU usage and avoid excessive API calls

    return () => {
      clearInterval(timer);
    };
  }, [isGenerating, completedScenes, totalScenes, displayCount]);

  // Simple progress calculation based on displayed count - ensure it's a percentage
  const displayProgress = totalScenes > 0 ? Math.min(Math.round((Math.floor(displayCount) / totalScenes) * 100), 100) : 0;

  // State to track clip thumbnails
  const [clipThumbnails, setClipThumbnails] = useState<Record<string, string>>({});
  const [loadingClips, setLoadingClips] = useState<Record<string, boolean>>({});
  // Add a ref to track which clips have already been requested to prevent duplicate loads
  const requestedClipsRef = useRef<Set<string>>(new Set());
  // Replace failed clip tracking with pending animation tracking
  const [pendingClips, setPendingClips] = useState<Record<string, boolean>>({});

  // Effect to update thumbnails when clips change
  useEffect(() => {
    // First, store any existing SVG content in the thumbnails cache
    const newThumbnails = { ...clipThumbnails };

    // Process all clips with existing SVG content
    clips.forEach(clip => {
      if (clip.svgContent) {
        newThumbnails[clip.id] = clip.svgContent;
      }
    });

    // Update state with initial values
    setClipThumbnails(newThumbnails);

    // Track clips that need loading
    const clipsToLoad = clips.filter(
      clip => clip.animationId && !clip.svgContent && !clipThumbnails[clip.id]
    );

    if (clipsToLoad.length > 0) {
      // Set loading state for all clips that need fetching
      const newLoadingState = { ...loadingClips };
      clipsToLoad.forEach(clip => {
        newLoadingState[clip.id] = true;
      });
      setLoadingClips(newLoadingState);

      // Fetch all animations in parallel
      Promise.all(clipsToLoad.map(async (clip) => {
        if (!clip.animationId) return;

        try {
          // Try to get the animation from the server
          const animation = await MovieStorageApi.getClipAnimation(clip.animationId);
          if (animation && animation.svg) {
            // Successfully got SVG content - update cache
            setClipThumbnails(prev => ({
              ...prev,
              [clip.id]: animation.svg
            }));
          }
        } catch (error) {
          console.error(`Error loading clip thumbnail: ${clip.id}`, error);
        } finally {
          // Always update loading state
          setLoadingClips(prev => ({
            ...prev,
            [clip.id]: false
          }));
        }
      }));
    }
  }, [clips]);

  // Effect to listen for animation-loaded events from the registry
  useEffect(() => {
    // Function to handle animation loaded events
    const handleAnimationLoaded = (event: Event) => {
      const customEvent = event as CustomEvent<{animationId: string, svg: string}>;
      if (!customEvent.detail) return;

      const { animationId, svg } = customEvent.detail;

      // Find any clips using this animation ID
      clips.forEach(clip => {
        if (clip.animationId === animationId) {
          // Update our thumbnails cache with the SVG content
          setClipThumbnails(prev => ({
            ...prev,
            [clip.id]: svg
          }));

          // Mark as not loading anymore
          setLoadingClips(prev => ({
            ...prev,
            [clip.id]: false
          }));
        }
      });
    };

    // Listen for animation-loaded events
    window.addEventListener('animation-loaded', handleAnimationLoaded);

    // Cleanup
    return () => {
      window.removeEventListener('animation-loaded', handleAnimationLoaded);
    };
  }, [clips]);

  // Helper to get SVG content for a clip
  const getClipSvgContent = (clip: MovieClip): string => {
    // Direct SVG content takes precedence
    if (clip.svgContent) {
      return clip.svgContent;
    }

    // Check our local thumbnail cache
    if (clipThumbnails[clip.id]) {
      return clipThumbnails[clip.id];
    }

    // If we have an animation ID but no content yet
    if (clip.animationId) {
      // Try to get from the registry directly as a last resort
      try {
        // This is a synchronous check to see if animation is already in registry
        const registryCheck = MovieStorageApi.getClipAnimationFromRegistry(clip.animationId);
        if (registryCheck && registryCheck.svg) {
          // If found in registry, update our cache for next time and return the SVG
          setTimeout(() => {
            setClipThumbnails(prev => ({
              ...prev,
              [clip.id]: registryCheck.svg
            }));
          }, 0);

          return registryCheck.svg;
        }
      } catch (e) {
        // Ignore registry lookup errors
      }

      // Show loading state if we're actively loading
      if (loadingClips[clip.id]) {
        return createPlaceholderSvg("Loading...");
      }

      // Pending or needs manual load
      const isPending = pendingClips[clip.id];
      return createPlaceholderSvg(isPending ? "Animation in progress..." : "Click to load");
    }

    // Fallback for clips with no content
    return createPlaceholderSvg("No Preview");
  };

  // Simple helper to manually load a thumbnail if clicking fails
  const loadClipThumbnail = useCallback(async (clip: MovieClip) => {
    if (!clip.animationId || loadingClips[clip.id] || clipThumbnails[clip.id]) {
      return;
    }

    setLoadingClips(prev => ({ ...prev, [clip.id]: true }));

    try {
      const animation = await MovieStorageApi.getClipAnimation(clip.animationId);
      if (animation && animation.svg) {
        setClipThumbnails(prev => ({ ...prev, [clip.id]: animation.svg }));
      }
    } catch (error) {
      console.error(`Error loading thumbnail: ${clip.id}`, error);
    } finally {
      setLoadingClips(prev => ({ ...prev, [clip.id]: false }));
    }
  }, [clipThumbnails, loadingClips]);

  // Function to handle selecting an existing animation
  const handleSelectExistingAnimation = useCallback((animation: AnimationItem, animationSvg?: string) => {
    try {
      // Special case for "Create New" option
      if (animation.id === 'create-new') {
        // For new clips, just call onAddClip directly which will handle navigation to the editor
        onAddClip();
        setShowClipSelector(false);
        return;
      }

      // For existing animations, store details in sessionStorage
      sessionStorage.setItem('pending_animation_id', animation.id);
      sessionStorage.setItem('pending_animation_name', animation.name);

      // Close the selector
      setShowClipSelector(false);

      // Call onAddClip which will now detect and add the existing animation
      onAddClip();
    } catch (error) {
      console.error('Error handling animation selection:', error);
    }
  }, [onAddClip]);

  // Get animation list with the "Create New" option added at the top
  const getAnimationsWithCreateOption = useCallback((animations: AnimationItem[]): AnimationItem[] => {
    // Check if the list already has a create-new option
    const hasCreateNewOption = animations.some(animation => animation.id === 'create-new');
    if (hasCreateNewOption) {
      return animations;
    }

    // Add a special "Create New" option at the top
    const createNewOption: AnimationItem = {
      id: 'create-new',
      name: 'Create New Clip',
      timestamp: new Date().toISOString()
    };

    return [createNewOption, ...animations];
  }, []);

  // Special item renderer for the "Create New" option
  const renderSpecialItem = useCallback((animation: AnimationItem) => {
    if (animation.id === 'create-new') {
      return (
        <div className="flex items-center">
          <div className="w-16 h-12 mr-2 flex-shrink-0 flex items-center justify-center bg-gray-900 rounded">
            <svg className="w-6 h-6 text-bat-yellow" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 6v6m0 0v6m0-6h6m-6 0H6" />
            </svg>
          </div>
          <div>
            <div className="font-medium text-bat-yellow text-sm">Create New Clip</div>
            <div className="text-xs text-gray-400">Start creating your animation right away</div>
          </div>
        </div>
      );
    }
    return null; // Return null for regular items
  }, []);

  // State for clip selector
  const [showClipSelector, setShowClipSelector] = useState(false);

  // Function to handle clip deletion
  const handleDeleteClip = useCallback((e: React.MouseEvent, clipId: string) => {
    e.stopPropagation(); // Prevent clip selection when clicking delete

    if (window.confirm("Are you sure you want to delete this clip?")) {
      removeClip(clipId);
    }
  }, [removeClip]);

  // If renderHeaderContent is true, just return the generation badge for the header
  if (renderHeaderContent && hasGenerationStatus) {
    return (
      <div className="flex items-baseline">
        <div className="text-gray-300 mr-2">Clips</div>
        <GenerationStatusBadge
          isGenerating={isGenerating}
          completedScenes={completedScenes}
          totalScenes={totalScenes}
        />
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Top section with generation status */}
      {hasGenerationStatus && (
        <div className="hidden md:block bg-gray-800 rounded-md m-2 p-2 flex-shrink-0">
          {isGenerating ? (
            <div>
              <div className="text-sm font-medium mb-1">
                Generating storyboard: {Math.floor(displayCount)}/{totalScenes} scenes
              </div>
              <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                <div
                  className="bg-green-500 h-full rounded-full transition-all duration-300"
                  style={{ width: `${displayProgress}%` }}
                ></div>
              </div>
            </div>
          ) : (
            <div className="text-sm">
              {completedScenes > 0 ?
                (completedScenes >= totalScenes ?
                  `Completed ${Math.floor(completedScenes)}/${totalScenes} scenes` :
                  `Generated ${Math.floor(completedScenes)}/${totalScenes} scenes`) :
                'Ready to generate'}
            </div>
          )}
        </div>
      )}

      {/* Middle section - scrollable clips */}
      <div className="flex-1 overflow-auto">
        {/* No clips message */}
        {clips.length === 0 ? (
          <div className="flex flex-col items-center justify-center h-full py-4 px-3">
            <div className="border border-dashed border-gray-600 rounded-lg p-4 w-full flex flex-col items-center justify-center">
              <p className="text-gray-400 text-center">No clips in storyboard</p>
              <p className="text-gray-400 text-center text-sm mt-1">Use the button below to add your first clip</p>
            </div>
          </div>
        ) : (
          /* Clips with responsive layout: horizontal on mobile, vertical on desktop */
          <div className="flex flex-nowrap md:flex-col md:space-y-2 space-x-3 md:space-x-0 px-3 py-2 overflow-x-auto md:w-full">
            {clips
              .sort((a, b) => a.order - b.order)
              .map((clip) => (
                <div
                  key={clip.id}
                  className={`border border-gray-700 rounded-lg overflow-hidden cursor-pointer transition-all flex-shrink-0 md:w-full w-52
                    ${clip.id === activeClipId ? 'ring-2 ring-bat-yellow shadow-md' : 'hover:border-gray-500'}
                  `}
                  onClick={() => onClipSelect(clip.id)}
                >
                  {/* Clip thumbnail preview with overlaid info */}
                  <div className="aspect-video overflow-hidden relative group" onClick={(e) => {
                    // Don't stop propagation - we want the parent onClick to fire too
                    // Only manually load the thumbnail if it's not already loaded
                    if (clip.animationId && !clipThumbnails[clip.id] && !clip.svgContent) {
                      loadClipThumbnail(clip);
                    }
                  }}>
                    <SvgThumbnail svgContent={getClipSvgContent(clip)} />

                    {/* Top overlay with clip name and number */}
                    <div className="absolute top-0 left-0 right-0 px-2 py-1 flex justify-between bg-gradient-to-b from-black/70 to-transparent">
                      <span className="text-xs text-white font-medium truncate max-w-[70%] drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                        {clip.name}
                      </span>
                      <span className="text-xs text-white bg-black/50 rounded-full h-5 w-5 flex items-center justify-center">
                        {clip.order + 1}
                      </span>
                    </div>

                    {/* Bottom overlay with duration and prompt */}
                    <div className="absolute bottom-0 left-0 right-0 p-2 bg-gradient-to-t from-black/70 to-transparent opacity-90 group-hover:opacity-100 transition-opacity">
                      <div className="flex justify-between items-center mb-1">
                        <span className="text-xs text-white font-medium">{clip.duration}s</span>
                        <div className="flex items-center gap-1">
                          <button
                            className="text-red-400 hover:text-red-300 p-1 rounded hover:bg-black/30"
                            onClick={(e) => handleDeleteClip(e, clip.id)}
                            aria-label="Delete clip"
                          >
                            <svg className="w-3.5 h-3.5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
                            </svg>
                          </button>
                        </div>
                      </div>
                      {clip.prompt && (
                        <p className="text-xs text-white italic truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                          {truncatePrompt(clip.prompt)}
                        </p>
                      )}
                    </div>
                  </div>
                </div>
              ))}
          </div>
        )}
      </div>

      {/* Bottom section - Add a Clip button with safety margin for mobile */}
      <div className="px-3 py-3 pb-6 md:pb-4 mt-auto flex-shrink-0 bg-gotham-black border-t border-gray-800">
        <button
          className="w-full bg-bat-yellow text-black py-3 rounded-md font-medium text-sm"
          onClick={() => setShowClipSelector(true)}
        >
          Add a Clip
        </button>
      </div>

      {/* Animation selector modal */}
      {showClipSelector && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black bg-opacity-50">
          <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 w-11/12 max-w-lg shadow-xl">
            <AnimationList
              title="Add a Clip"
              onSelectAnimation={handleSelectExistingAnimation}
              onClose={() => setShowClipSelector(false)}
              showThumbnails={true}
              maxHeight="max-h-72"
              containerClassName="overflow-hidden w-full"
              transformAnimations={getAnimationsWithCreateOption}
              renderSpecialItem={renderSpecialItem}
            />
          </div>
        </div>
      )}
    </div>
  );
};

export default StoryboardPanel;
