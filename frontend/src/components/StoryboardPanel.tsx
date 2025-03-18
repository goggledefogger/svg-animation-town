import React from 'react';
import { MovieClip } from '../contexts/MovieContext';
import SvgThumbnail from './SvgThumbnail';

interface StoryboardPanelProps {
  clips: MovieClip[];
  activeClipId: string | null;
  onClipSelect: (clipId: string) => void;
  onAddClip?: () => void;
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
  onAddClip
}) => {
  if (clips.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center h-40 border border-dashed border-gray-600 rounded-lg p-4">
        <p className="text-gray-400 text-center mb-2">No clips in storyboard</p>
        <button
          className="btn btn-sm btn-outline"
          onClick={onAddClip}
        >
          Add Clip
        </button>
      </div>
    );
  }

  return (
    <div className="space-y-3">
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
              {clip.svgContent ? (
                <>
                  <SvgThumbnail svgContent={clip.svgContent} />
                  
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
                    </div>
                    {clip.prompt && (
                      <p className="text-xs text-white italic truncate drop-shadow-[0_1px_1px_rgba(0,0,0,0.8)]">
                        {truncatePrompt(clip.prompt)}
                      </p>
                    )}
                  </div>
                </>
              ) : (
                <div className="text-gray-500 text-xs flex items-center justify-center h-full">No preview</div>
              )}
            </div>
          </div>
        ))}

      {/* Add clip button */}
      <button
        className="w-full btn btn-sm btn-outline"
        onClick={onAddClip}
      >
        Add New Clip
      </button>
    </div>
  );
};

export default StoryboardPanel;
