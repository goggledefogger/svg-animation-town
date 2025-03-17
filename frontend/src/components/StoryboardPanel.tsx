import React from 'react';
import { MovieClip } from '../contexts/MovieContext';

interface StoryboardPanelProps {
  clips: MovieClip[];
  activeClipId: string | null;
  onClipSelect: (clipId: string) => void;
  onAddClip?: () => void;
}

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
            {/* Clip thumbnail preview */}
            <div className="aspect-video bg-gotham-gray flex items-center justify-center">
              {clip.svgContent ? (
                <div
                  className="w-full h-full flex items-center justify-center"
                  dangerouslySetInnerHTML={{ __html: clip.svgContent.replace('<svg', '<svg preserveAspectRatio="xMidYMid meet" width="100%" height="100%"') }}
                />
              ) : (
                <div className="text-gray-500 text-xs">No preview</div>
              )}
            </div>

            {/* Clip info */}
            <div className="p-2 bg-gotham-black">
              <div className="text-sm font-medium truncate">{clip.name}</div>
              <div className="flex justify-between text-xs text-gray-400 mt-1">
                <span>{clip.duration}s</span>
                <span>#{clip.order + 1}</span>
              </div>
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
