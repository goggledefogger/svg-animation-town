import React, { useState, useEffect } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import { useNavigate, useLocation } from 'react-router-dom';

const AnimationControls: React.FC = () => {
  const { playing, pauseAnimations, resumeAnimations, resetAnimations, svgContent, playbackSpeed, setPlaybackSpeed } = useAnimation();
  const { activeClipId, getActiveClip, isPlaying, setIsPlaying, setCurrentPlaybackPosition } = useMovie();
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const navigate = useNavigate();
  const location = useLocation();

  // Get the active clip
  const activeClip = activeClipId ? getActiveClip() : null;

  // Determine if we should show controls based on either svgContent or activeClip
  const hasContent = svgContent || activeClip?.svgContent;
  
  // Check if we're in the animation editor (path '/')
  const isAnimationEditor = location.pathname === '/';

  // Keep animation context and movie context playback in sync
  useEffect(() => {
    // When active clip is playing/paused, sync with animation context
    if (activeClipId) {
      if (isPlaying && !playing) {
        resumeAnimations();
      } else if (!isPlaying && playing) {
        pauseAnimations();
      }
    }
  }, [isPlaying, playing, activeClipId, resumeAnimations, pauseAnimations]);

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

    // Also reset clip position if we have an active clip
    if (activeClipId) {
      setCurrentPlaybackPosition(0);
    }
  };

  // Change playback speed
  const handleSpeedChange = (speed: number | 'groovy') => {
    setPlaybackSpeed(speed);
    setShowSpeedOptions(false);
  };

  // Navigate to movie editor
  const navigateToMovieEditor = () => {
    navigate('/movie-editor');
  };

  // If no content, don't show controls
  if (!hasContent) return null;

  return (
    <div className="flex items-center justify-between mt-2 bg-gray-800 rounded-md p-2">
      <div className="flex items-center space-x-2">
        <button
          className="text-white hover:text-bat-yellow p-1 rounded focus:outline-none"
          onClick={togglePlayback}
          aria-label={playing || isPlaying ? 'Pause' : 'Play'}
        >
          {playing || isPlaying ? (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>

        <button
          className="text-white hover:text-bat-yellow p-1 rounded focus:outline-none"
          onClick={handleReset}
          aria-label="Reset"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
      </div>

      <div className="flex items-center">
        {/* Only show return button in the animation editor */}
        {isAnimationEditor && (
          <button
            onClick={() => navigateToMovieEditor()}
            className="text-white bg-blue-600 hover:bg-blue-500 rounded-md px-3 py-1 text-sm"
          >
            Return to Movie Editor
          </button>
        )}
        
        <div className="relative ml-2">
          <button
            className="text-white hover:text-bat-yellow p-1 rounded focus:outline-none"
            onClick={() => setShowSpeedOptions(!showSpeedOptions)}
            aria-label="Playback Speed"
          >
            <span className="text-xs font-mono px-1">
              {playbackSpeed === 'groovy' ? '🕺' : `${playbackSpeed}x`}
            </span>
          </button>

          {showSpeedOptions && (
            <div className="absolute right-0 bottom-full bg-gray-700 rounded shadow-lg p-2 z-10">
              <div className="flex flex-col space-y-1 min-w-[80px]">
                {[0.25, 0.5, 0.75, 1, 1.5, 2, 10, 'groovy'].map((speed) => (
                  <button
                    key={speed.toString()}
                    className={`px-3 py-1.5 text-xs rounded text-center ${
                      speed === playbackSpeed ? 'bg-bat-yellow text-black' : 'hover:bg-gray-600 text-white'
                    }`}
                    onClick={() => handleSpeedChange(speed as number | 'groovy')}
                  >
                    {speed === 'groovy' ? '🕺 Groovy' : `${speed}x`}
                  </button>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimationControls;
