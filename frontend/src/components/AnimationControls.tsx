import React, { useState } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';

const AnimationControls: React.FC = () => {
  const { playing, pauseAnimations, resumeAnimations, resetAnimations, svgContent, playbackSpeed, setPlaybackSpeed } = useAnimation();
  const { activeClipId, getActiveClip, isPlaying, setIsPlaying } = useMovie();
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);

  // Get the active clip
  const activeClip = activeClipId ? getActiveClip() : null;

  // Determine if we should show controls based on either svgContent or activeClip
  const hasContent = svgContent || activeClip?.svgContent;

  // Toggle play/pause - use movie context if we have an active clip
  const togglePlayback = () => {
    if (activeClipId) {
      // Using movie playback controls
      setIsPlaying(!isPlaying);
    } else {
      // Using animation playback controls
      if (playing) {
        pauseAnimations();
      } else {
        resumeAnimations();
      }
    }
  };

  // Reset animation
  const handleReset = () => {
    resetAnimations();
  };

  // Change playback speed
  const handleSpeedChange = (speed: number | 'groovy') => {
    setPlaybackSpeed(speed);
    setShowSpeedOptions(false);
  };

  // Format speed for display
  const formatSpeed = (speed: number | 'groovy') => {
    if (speed === 'groovy') return 'Groovy';
    if (speed === -1) return 'Reverse';
    return `${speed}x`;
  };

  // Determine which play state to use - active clip or animation
  const isCurrentlyPlaying = activeClipId ? isPlaying : playing;

  // Only show controls if there's content to control
  if (!hasContent) {
    return null;
  }

  return (
    <div className="bg-gray-800 p-2 md:p-4 rounded-lg shadow-lg mt-2 md:mt-4 flex-shrink-0">
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={handleReset}
          className="bg-gray-700 hover:bg-gray-600 text-white p-1.5 md:p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Reset"
        >
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          onClick={togglePlayback}
          className="bg-blue-600 hover:bg-blue-500 text-white p-1.5 md:p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label={isCurrentlyPlaying ? "Pause" : "Play"}
        >
          {isCurrentlyPlaying ? (
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>

        {/* Active clip info */}
        {activeClip && (
          <div className="text-xs md:text-sm text-gray-300 ml-2 flex-1 overflow-hidden whitespace-nowrap overflow-ellipsis">
            {activeClip.name}
          </div>
        )}

        {/* Speed Control - Dropdown */}
        <div className="relative">
          <button
            onClick={() => setShowSpeedOptions(!showSpeedOptions)}
            className="bg-purple-600 hover:bg-purple-500 text-white p-1.5 md:p-2 rounded focus:outline-none focus:ring-2 focus:ring-purple-400 flex items-center"
            aria-label="Speed control"
          >
            <span className="text-xs md:text-sm">{formatSpeed(playbackSpeed)}</span>
          </button>

          {/* Speed Options */}
          {showSpeedOptions && (
            <div className="absolute right-0 bottom-full mb-1 bg-gray-700 rounded shadow-lg z-10 w-32 py-1 animate-fadeIn">
              <button
                onClick={() => handleSpeedChange(-1)}
                className={`w-full text-left px-3 py-1.5 text-sm ${playbackSpeed === -1 ? 'bg-gray-600 text-white' : 'text-gray-200 hover:bg-gray-600'}`}
              >
                Reverse
              </button>
              <button
                onClick={() => handleSpeedChange(0.25)}
                className={`w-full text-left px-3 py-1.5 text-sm ${playbackSpeed === 0.25 ? 'bg-gray-600 text-white' : 'text-gray-200 hover:bg-gray-600'}`}
              >
                0.25x
              </button>
              <button
                onClick={() => handleSpeedChange(0.5)}
                className={`w-full text-left px-3 py-1.5 text-sm ${playbackSpeed === 0.5 ? 'bg-gray-600 text-white' : 'text-gray-200 hover:bg-gray-600'}`}
              >
                0.5x
              </button>
              <button
                onClick={() => handleSpeedChange(0.75)}
                className={`w-full text-left px-3 py-1.5 text-sm ${playbackSpeed === 0.75 ? 'bg-gray-600 text-white' : 'text-gray-200 hover:bg-gray-600'}`}
              >
                0.75x
              </button>
              <button
                onClick={() => handleSpeedChange(1)}
                className={`w-full text-left px-3 py-1.5 text-sm ${playbackSpeed === 1 ? 'bg-gray-600 text-white' : 'text-gray-200 hover:bg-gray-600'}`}
              >
                1x
              </button>
              <button
                onClick={() => handleSpeedChange(2)}
                className={`w-full text-left px-3 py-1.5 text-sm ${playbackSpeed === 2 ? 'bg-gray-600 text-white' : 'text-gray-200 hover:bg-gray-600'}`}
              >
                2x
              </button>
              <button
                onClick={() => handleSpeedChange(10)}
                className={`w-full text-left px-3 py-1.5 text-sm ${playbackSpeed === 10 ? 'bg-gray-600 text-white' : 'text-gray-200 hover:bg-gray-600'}`}
              >
                10x
              </button>
              <button
                onClick={() => handleSpeedChange('groovy')}
                className={`w-full text-left px-3 py-1.5 text-sm flex items-center ${playbackSpeed === 'groovy' ? 'bg-gray-600 text-white' : 'text-gray-200 hover:bg-gray-600'}`}
              >
                <svg className="w-4 h-4 mr-1 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
                </svg>
                Groovy
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimationControls;
