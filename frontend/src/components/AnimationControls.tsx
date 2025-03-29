import React, { useState, useEffect, useRef } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import { useViewerPreferences } from '../contexts/ViewerPreferencesContext';
import { useNavigate, useLocation } from 'react-router-dom';
import BackgroundPicker from './BackgroundPicker';

interface AnimationControlsProps {
  isPlaying?: boolean;
  onPlayPause?: () => void;
  currentTime?: number;
  duration?: number;
  onSeek?: (newPosition: number) => void;
  onDurationChange?: (newDuration: number) => void;
  hasContent?: boolean;
  isEditingFromMovie?: boolean;
}

const AnimationControls: React.FC<AnimationControlsProps> = ({
  isPlaying: propIsPlaying,
  onPlayPause,
  currentTime,
  duration,
  onSeek,
  onDurationChange,
  hasContent: propHasContent,
  isEditingFromMovie = false
}) => {
  const { playing, pauseAnimations, resumeAnimations, resetAnimations, svgContent, playbackSpeed, setPlaybackSpeed } = useAnimation();
  const { activeClipId, getActiveClip, isPlaying: movieIsPlaying, setIsPlaying, setCurrentPlaybackPosition } = useMovie();
  const { currentBackground } = useViewerPreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const backgroundButtonRef = useRef<HTMLDivElement>(null);

  // Get the active clip
  const activeClip = activeClipId ? getActiveClip() : null;

  // Determine effective playback state - props take precedence over context
  const effectiveIsPlaying = propIsPlaying !== undefined ? propIsPlaying : movieIsPlaying || playing;

  // Determine if we should show controls based on either svgContent or activeClip
  const hasContent = svgContent || activeClip?.svgContent;

  // Check if we're in the animation editor (path '/')
  const isAnimationEditor = location.pathname === '/';

  // Keep animation context and movie context playback in sync
  useEffect(() => {
    // Skip if we're controlled by props
    if (propIsPlaying !== undefined || onPlayPause) return;

    // When active clip is playing/paused, sync with animation context
    if (activeClipId) {
      if (movieIsPlaying && !playing) {
        resumeAnimations();
      } else if (!movieIsPlaying && playing) {
        pauseAnimations();
      }
    }
  }, [movieIsPlaying, playing, activeClipId, resumeAnimations, pauseAnimations, propIsPlaying, onPlayPause]);

  // Toggle play/pause - use props if provided, otherwise use context
  const togglePlayback = () => {
    if (onPlayPause) {
      // Use prop handler if provided
      onPlayPause();
    } else if (activeClipId) {
      // Using movie playback controls
      setIsPlaying(!movieIsPlaying);
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
    if (onSeek) {
      // Use prop handler if provided
      onSeek(0);
    } else {
      resetAnimations();

      // Also reset clip position if we have an active clip
      if (activeClipId) {
        setCurrentPlaybackPosition(0);
      }
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
    <div className="flex items-center justify-between bg-gray-800 bg-opacity-90 rounded-md p-1 sm:p-1.5 md:p-2 shadow-lg backdrop-blur-sm w-full max-w-full overflow-hidden">
      <div className="flex items-center space-x-1 sm:space-x-2">
        <button
          className="text-white hover:text-bat-yellow p-1 rounded focus:outline-none"
          onClick={togglePlayback}
          aria-label={effectiveIsPlaying ? 'Pause' : 'Play'}
        >
          {effectiveIsPlaying ? (
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
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
          <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>

        {/* Replace background toggle button with color picker button */}
        <div className="relative inline-block" ref={backgroundButtonRef}>
          <button
            className="text-white hover:text-bat-yellow p-1 rounded focus:outline-none relative"
            onClick={() => setShowBackgroundPicker(!showBackgroundPicker)}
            aria-label="Change background"
            title="Change background"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 21a4 4 0 01-4-4V5a2 2 0 012-2h4a2 2 0 012 2v12a4 4 0 01-4 4zm0 0h12a2 2 0 002-2v-4a2 2 0 00-2-2h-2.343M11 7.343l1.657-1.657a2 2 0 012.828 0l2.829 2.829a2 2 0 010 2.828l-8.486 8.485M7 17h.01" />
            </svg>
            {/* Color indicator dot */}
            <div
              className="absolute bottom-0 right-0 w-2 h-2 sm:w-2.5 sm:h-2.5 rounded-full border border-gray-600"
              style={
                currentBackground.type === 'solid'
                  ? { backgroundColor: currentBackground.value }
                  : { background: currentBackground.value }
              }
            />
          </button>

          <BackgroundPicker
            isOpen={showBackgroundPicker}
            onClose={() => setShowBackgroundPicker(false)}
            containerRef={backgroundButtonRef}
          />
        </div>
      </div>

      <div className="flex items-center space-x-1">
        {/* Only show return button in the animation editor when editing from movie */}
        {isAnimationEditor && isEditingFromMovie && (
          <button
            onClick={() => navigateToMovieEditor()}
            className="hidden sm:block text-white bg-blue-600 hover:bg-blue-500 rounded-md px-2 sm:px-3 py-1 text-xs sm:text-sm whitespace-nowrap"
          >
            Return to Movie Editor
          </button>
        )}

        <div className="relative">
          <button
            className="text-white hover:text-bat-yellow p-1 rounded focus:outline-none"
            onClick={() => setShowSpeedOptions(!showSpeedOptions)}
            aria-label="Playback Speed"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>

          {showSpeedOptions && (
            <div className="absolute right-0 bottom-full mb-2 w-24 sm:w-28 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50">
              <div className="py-1">
                <button
                  className={`w-full text-left px-2 sm:px-3 py-1 sm:py-1.5 text-xs ${playbackSpeed === 0.5 ? 'text-bat-yellow' : 'text-white'} hover:bg-gray-800`}
                  onClick={() => handleSpeedChange(0.5)}
                >
                  0.5x
                </button>
                <button
                  className={`w-full text-left px-2 sm:px-3 py-1 sm:py-1.5 text-xs ${playbackSpeed === 1 ? 'text-bat-yellow' : 'text-white'} hover:bg-gray-800`}
                  onClick={() => handleSpeedChange(1)}
                >
                  1x
                </button>
                <button
                  className={`w-full text-left px-2 sm:px-3 py-1 sm:py-1.5 text-xs ${playbackSpeed === 2 ? 'text-bat-yellow' : 'text-white'} hover:bg-gray-800`}
                  onClick={() => handleSpeedChange(2)}
                >
                  2x
                </button>
                <button
                  className={`w-full text-left px-2 sm:px-3 py-1 sm:py-1.5 text-xs ${playbackSpeed === 'groovy' ? 'text-bat-yellow' : 'text-white'} hover:bg-gray-800`}
                  onClick={() => handleSpeedChange('groovy')}
                >
                  🕺 Groovy
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default AnimationControls;
