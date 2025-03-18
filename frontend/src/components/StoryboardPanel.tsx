import React from 'react';
import { MovieClip, Storyboard } from '../contexts/MovieContext';
import SvgThumbnail from './SvgThumbnail';

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
      <div className="flex-1 overflow-y-auto space-y-3">
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
        {clips.map((clip) => (
          <div
            key={clip.id}
            className={`relative p-2 rounded-md cursor-pointer transition-colors ${
              clip.id === activeClipId
                ? 'bg-blue-900 border border-blue-500'
                : 'bg-gray-800 hover:bg-gray-700 border border-transparent'
            }`}
            onClick={() => onClipSelect(clip.id)}
          >
            <div className="flex items-center space-x-3">
              <div className="w-16 h-16 bg-gray-900 rounded overflow-hidden flex-shrink-0">
                <SvgThumbnail svgContent={clip.svgContent} />
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">{clip.name}</p>
                <p className="text-xs text-gray-400 truncate">
                  {clip.duration}s {clip.animationId ? '• Server Saved' : ''}
                </p>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Add Clip Button */}
      <div className="mt-4">
        <button
          className="w-full btn btn-sm btn-primary"
          onClick={onAddClip}
        >
          Add Clip
        </button>
      </div>
    </div>
  );
};

export default StoryboardPanel;
