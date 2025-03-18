import React, { useState, useEffect } from 'react';
import { MovieClip, Storyboard } from '../contexts/MovieContext';
import SvgThumbnail from './SvgThumbnail';
import { MovieStorageApi } from '../services/api';

interface StoryboardPanelProps {
  clips: MovieClip[];
  activeClipId: string | null;
  onClipSelect: (clipId: string) => void;
  onAddClip: () => void;
  storyboard?: Storyboard; // Add storyboard prop to access generation status
}

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
  storyboard
}) => {
  const hasGenerationStatus = storyboard?.generationStatus !== undefined;
  const isGenerating = storyboard?.generationStatus?.inProgress === true;
  const totalScenes = storyboard?.generationStatus?.totalScenes || 0;
  const completedScenes = storyboard?.generationStatus?.completedScenes || 0;
  const generationProgress = totalScenes > 0 ? Math.round((completedScenes / totalScenes) * 100) : 0;

  // State to track clip thumbnails
  const [clipThumbnails, setClipThumbnails] = useState<Record<string, string>>({});
  const [loadingClips, setLoadingClips] = useState<Record<string, boolean>>({});

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

  return (
    <div className="flex flex-col h-full">
      {/* Generation Status Indicator */}
      {hasGenerationStatus && (
        <div className="mb-4 p-2 bg-gray-800 rounded-md">
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

      {/* Clips List */}
      <div className="flex-1 overflow-y-auto">
        {/* No clips message */}
        {clips.length === 0 && (
          <div className="flex flex-col items-center justify-center h-40 border border-dashed border-gray-600 rounded-lg p-4">
            <p className="text-gray-400 text-center mb-2">No clips in storyboard</p>
            <button
              className="btn btn-sm btn-outline"
              onClick={onAddClip}
            >
              Add Clip
            </button>
          </div>
        )}

        {/* Clip items */}
        {clips.length > 0 && (
          <div className="space-y-3 p-1">
            {clips
              .sort((a, b) => a.order - b.order)
              .map((clip) => (
                <div
                  key={clip.id}
                  className={`border border-gray-700 rounded-lg overflow-hidden cursor-pointer transition-all ${
                    clip.id === activeClipId ? 'ring-2 ring-bat-yellow' : 'hover:border-gray-500'
                  }`}
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
        )}
      </div>

      {/* Add Clip Button */}
      <div className="mt-4">
        <button
          className="w-full btn btn-sm btn-primary"
          onClick={onAddClip}
        >
          Add New Clip
        </button>
      </div>
    </div>
  );
};

export default StoryboardPanel;
