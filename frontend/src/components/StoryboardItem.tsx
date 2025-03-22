import React from 'react';
import { Storyboard } from '../contexts/MovieContext';

interface StoryboardItemProps {
  storyboard: Storyboard;
  onLoadStoryboard: (id: string) => Promise<void | boolean>;
  onRequestDelete: (id: string) => void;
}

const StoryboardItem = React.forwardRef<HTMLDivElement, StoryboardItemProps>(
  ({ storyboard, onLoadStoryboard, onRequestDelete }, ref) => {
    // Find the first clip to use as a thumbnail
    const firstClip = storyboard.clips && storyboard.clips.length > 0
      ? storyboard.clips[0]
      : null;

    const handleClick = async () => {
      await onLoadStoryboard(storyboard.id);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onRequestDelete(storyboard.id);
    };

    return (
      <div
        ref={ref}
        className="flex hover:bg-gotham-blue/20 transition p-0"
      >
        {/* Thumbnail area - Lazy load iframe */}
        <div
          className="w-24 h-20 flex-shrink-0 bg-gray-800 cursor-pointer border-r border-gray-700 relative overflow-hidden"
          onClick={handleClick}
        >
          {firstClip && firstClip.svgContent ? (
            <>
              {/* Using iframe for isolated SVG rendering with lazy loading */}
              <div className="absolute inset-0 flex items-center justify-center bg-white">
                <iframe
                  srcDoc={firstClip.svgContent}
                  className="w-full h-full border-0"
                  title={`Thumbnail for ${storyboard.name}`}
                  sandbox="allow-same-origin"
                  loading="lazy"
                />
              </div>
              <div className="absolute bottom-0 right-0 bg-black/60 text-xs text-gray-300 px-1 py-0.5">
                {storyboard.clips?.length || 0} clips
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full text-gray-500">
              <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z" />
              </svg>
              <span className="text-xs">{storyboard.clips?.length || 0} clips</span>
            </div>
          )}
        </div>

        {/* Content area */}
        <div
          className="flex-1 p-3 cursor-pointer flex flex-col justify-between"
          onClick={handleClick}
        >
          <div>
            <div className="font-medium text-bat-yellow text-sm">{storyboard.name}</div>
            <div className="text-xs text-gray-400 mt-1 flex items-center justify-between">
              <span>{storyboard.clips?.length || 0} clips</span>
              <span>{new Date(storyboard.updatedAt).toLocaleString()}</span>
            </div>
          </div>
        </div>

        {/* Delete button */}
        <div className="flex items-center pr-3">
          <button
            className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
            onClick={handleDeleteClick}
          >
            Delete
          </button>
        </div>
      </div>
    );
  }
);

export default StoryboardItem; 