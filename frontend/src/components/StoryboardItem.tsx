import React from 'react';
import { Storyboard } from '../contexts/MovieContext';
import { GenerationStatusBadge } from './StoryboardPanel';

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

    // Calculate generation status values
    const isGenerating = storyboard.generationStatus?.inProgress === true;
    const completedScenes = storyboard.generationStatus?.completedScenes || 0;
    const totalScenes = storyboard.generationStatus?.totalScenes || 0;
    const hasGenerationStatus = storyboard.generationStatus !== undefined;

    const handleClick = async () => {
      await onLoadStoryboard(storyboard.id);
    };

    const handleDeleteClick = (e: React.MouseEvent) => {
      e.stopPropagation();
      onRequestDelete(storyboard.id);
    };

    const formatDate = (date: Date) => {
      return new Date(date).toLocaleString(undefined, {
        month: 'numeric',
        day: 'numeric',
        hour: 'numeric',
        minute: '2-digit'
      });
    };

    return (
      <div
        ref={ref}
        className="flex hover:bg-gotham-blue/20 transition p-0"
      >
        {/* Thumbnail area - Lazy load iframe */}
        <div
          className="w-12 md:w-24 h-20 flex-shrink-0 bg-gray-800 cursor-pointer border-r border-gray-700 relative overflow-hidden"
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
                {storyboard.clips?.length || 0}
                <span className="hidden md:inline"> clips</span>
              </div>
            </>
          ) : (
            <div className="flex flex-col items-center justify-center w-full h-full text-gray-500">
              <svg className="w-6 md:w-8 h-6 md:h-8 mb-0.5 md:mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z" />
              </svg>
              <span className="text-xs">{storyboard.clips?.length || 0}<span className="hidden md:inline"> clips</span></span>
            </div>
          )}
        </div>

        {/* Content area */}
        <div
          className="flex-1 py-1.5 px-3 cursor-pointer flex flex-col justify-center min-w-0"
          onClick={handleClick}
        >
          {/* Title row - full width */}
          <h3 className="font-medium text-bat-yellow text-sm truncate">{storyboard.name}</h3>

          {/* Date row */}
          <div className="text-xs text-gray-400 mt-0.5">
            {formatDate(storyboard.updatedAt)}
          </div>

          {/* Description row */}
          {storyboard.description && (
            <div className="text-xs text-gray-400 mt-0.5 truncate italic">
              {storyboard.description}
            </div>
          )}

          {/* Status row - only show if there's generation status */}
          {hasGenerationStatus && (
            <div className="text-xs text-gray-400 mt-0.5 flex items-center">
              <GenerationStatusBadge
                isGenerating={isGenerating}
                completedScenes={completedScenes}
                totalScenes={totalScenes}
                showText={false}
                className="mr-2"
              />
              {isGenerating && <span>Generating...</span>}
            </div>
          )}
        </div>

        {/* Delete button */}
        <div className="flex items-center px-3">
          <button
            className="text-red-400 hover:text-red-300 p-1.5 rounded hover:bg-gray-700 flex-shrink-0"
            onClick={handleDeleteClick}
            aria-label="Delete storyboard"
          >
            <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16" />
            </svg>
          </button>
        </div>
      </div>
    );
  }
);

export default StoryboardItem;
