import React, { useState, useEffect, useCallback } from 'react';
import { MovieClip, Storyboard } from '../contexts/MovieContext';
import SvgThumbnail from './SvgThumbnail';
import { MovieStorageApi, AnimationStorageApi } from '../services/api';
import AnimationList, { AnimationItem } from './AnimationList';

interface StoryboardPanelProps {
  clips: MovieClip[];
  activeClipId: string | null;
  onClipSelect: (clipId: string) => void;
  onAddClip: () => void;
  storyboard?: Storyboard; // Add storyboard prop to access generation status
  renderHeaderContent?: boolean; // Whether to render the header content or not
}

// Helper function to create a generation status component for reuse
export const GenerationStatusBadge: React.FC<{
  isGenerating: boolean;
  completedScenes: number;
  totalScenes: number;
  className?: string;
}> = ({ isGenerating, completedScenes, totalScenes, className = "" }) => {
  if (totalScenes === 0) return null;

  if (isGenerating) {
    return (
      <div className={`flex items-center text-xs text-gray-400 ${className}`}>
        <div className="w-3 h-3 bg-green-500 rounded-full animate-pulse mr-1"></div>
        {completedScenes}/{totalScenes}
      </div>
    );
  } else if (completedScenes > 0) {
    return (
      <div className={`text-xs text-gray-400 ${className}`}>
        {completedScenes}/{totalScenes} generated
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
  renderHeaderContent = false
}) => {
  const hasGenerationStatus = storyboard?.generationStatus !== undefined;
  const isGenerating = storyboard?.generationStatus?.inProgress === true;
  const totalScenes = storyboard?.generationStatus?.totalScenes || 0;
  const completedScenes = storyboard?.generationStatus?.completedScenes || 0;
  const generationProgress = totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0;

  // State to track clip thumbnails
  const [clipThumbnails, setClipThumbnails] = useState<Record<string, string>>({});
  const [loadingClips, setLoadingClips] = useState<Record<string, boolean>>({});

  // State for clip selector
  const [showClipSelector, setShowClipSelector] = useState(false);

  // Load animation content for clips that have animationId but no SVG content
  useEffect(() => {
    const loadMissingThumbnails = async () => {
      // Identify clips that need content loading
      const clipsToLoad = clips.filter(clip => !clip.svgContent && clip.animationId);

      if (clipsToLoad.length === 0) return;

      // Mark these clips as loading
      const newLoadingState = { ...loadingClips };
      clipsToLoad.forEach(clip => { newLoadingState[clip.id] = true; });
      setLoadingClips(newLoadingState);

      // Load each clip's content
      for (const clip of clipsToLoad) {
        try {
          console.log(`Loading thumbnail for clip: ${clip.name} (ID: ${clip.animationId})`);
          const animation = await MovieStorageApi.getClipAnimation(clip.animationId!);

          if (animation && animation.svg) {
            // Update our thumbnail cache
            setClipThumbnails(prev => ({
              ...prev,
              [clip.id]: animation.svg
            }));
          } else {
            // Set a placeholder for failed loads
            setClipThumbnails(prev => ({
              ...prev,
              [clip.id]: createPlaceholderSvg("No content")
            }));
          }
        } catch (error) {
          console.error(`Error loading thumbnail for clip ${clip.id}:`, error);
          setClipThumbnails(prev => ({
            ...prev,
            [clip.id]: createPlaceholderSvg("Load error")
          }));
        } finally {
          // Mark this clip as done loading
          setLoadingClips(prev => ({
            ...prev,
            [clip.id]: false
          }));
        }
      }
    };

    loadMissingThumbnails();
  }, [clips]);

  // Helper to get SVG content for a clip (from content or cache)
  const getClipSvgContent = (clip: MovieClip): string => {
    if (clip.svgContent) {
      return clip.svgContent;
    }

    if (clipThumbnails[clip.id]) {
      return clipThumbnails[clip.id];
    }

    if (clip.animationId) {
      return createPlaceholderSvg(loadingClips[clip.id] ? "Loading..." : "Click to load");
    }

    return createPlaceholderSvg("No Preview");
  };

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
    <div className="grid grid-rows-[auto_minmax(0,1fr)_auto] h-full w-full overflow-hidden">
      {/* Top section */}
      <div>
        {/* Generation status - desktop only */}
        {hasGenerationStatus && (
          <div className="hidden md:block p-2 bg-gray-800 rounded-md mb-2">
            {isGenerating ? (
              <div>
                <div className="text-sm font-medium mb-1">
                  Generating storyboard: {completedScenes}/{totalScenes} scenes
                </div>
                <div className="w-full bg-gray-700 h-2 rounded-full overflow-hidden">
                  <div
                    className="bg-green-500 h-full rounded-full transition-all duration-500"
                    style={{ width: `${generationProgress}%` }}
                  ></div>
                </div>
              </div>
            ) : (
              <div className="text-sm">
                {completedScenes > 0 ?
                  `Generated ${completedScenes}/${totalScenes} scenes` :
                  'Ready to generate'}
              </div>
            )}
          </div>
        )}

        {/* Animation selector */}
        {showClipSelector && (
          <div className="mb-2 w-full overflow-visible relative z-10">
            <AnimationList
              title="Add a Clip"
              onSelectAnimation={handleSelectExistingAnimation}
              onClose={() => setShowClipSelector(false)}
              showThumbnails={true}
              maxHeight="max-h-64"
              containerClassName="bg-gray-800 rounded-md p-3 border border-gray-700 w-full overflow-hidden absolute top-0 left-0 right-0"
              transformAnimations={getAnimationsWithCreateOption}
              renderSpecialItem={renderSpecialItem}
            />
          </div>
        )}
      </div>

      {/* Middle section - scrollable content with minmax and max-height to constrain even when parent changes */}
      <div className="overflow-auto max-h-[calc(100vh-150px)]">
        {/* No clips message */}
        {clips.length === 0 && (
          <div className="flex flex-col items-center justify-center border border-dashed border-gray-600 rounded-lg p-4 h-32 mb-2">
            <p className="text-gray-400 text-center">No clips in storyboard</p>
            <p className="text-gray-400 text-center text-sm mt-1">Use the button below to add your first clip</p>
          </div>
        )}

        {/* Clips list with responsive scrolling */}
        {clips.length > 0 && (
          <div className="h-full w-full overflow-auto">
            {/* For mobile: horizontal layout, For desktop: vertical layout */}
            <div className="flex md:flex-col md:space-y-3 space-x-3 md:space-x-0 p-1 w-max md:w-full">
              {clips
                .sort((a, b) => a.order - b.order)
                .map((clip) => (
                  <div
                    key={clip.id}
                    className={`border border-gray-700 rounded-lg overflow-hidden cursor-pointer transition-all flex-shrink-0 md:w-full w-60
                      ${clip.id === activeClipId ? 'ring-2 ring-bat-yellow' : 'hover:border-gray-500'}
                    `}
                    onClick={() => onClipSelect(clip.id)}
                  >
                    {/* Clip thumbnail preview with overlaid info */}
                    <div className="aspect-video overflow-hidden relative group">
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
                          {clip.animationId && (
                            <span className="text-xs text-white bg-black/30 px-1 rounded">Server Saved</span>
                          )}
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
          </div>
        )}
      </div>

      {/* Bottom section */}
      <div className="pt-2 border-t border-gray-700 mt-auto w-full">
        <button
          className="w-full btn btn-sm btn-primary"
          onClick={() => setShowClipSelector(true)}
        >
          Add a Clip
        </button>
      </div>
    </div>
  );
};

export default StoryboardPanel;
