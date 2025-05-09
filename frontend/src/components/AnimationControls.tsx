import React, { useState, useEffect, useRef } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import { useViewerPreferences } from '../contexts/ViewerPreferencesContext';
import { useNavigate, useLocation } from 'react-router-dom';
import BackgroundPicker from './BackgroundPicker';
import ReactDOM from 'react-dom';
import { resetAnimations, controlAnimations } from '../utils/animationUtils';

// Declare a module augmentation to add our custom property to Window
declare global {
  interface Window {
    preventAnimationReset?: boolean;
    _isPlaybackStateChanging?: boolean;
  }
}

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
  const { playing, pauseAnimations, resumeAnimations, svgContent, playbackSpeed, setPlaybackSpeed, svgRef } = useAnimation();
  const { activeClipId, getActiveClip, isPlaying: movieIsPlaying, setIsPlaying, setCurrentPlaybackPosition } = useMovie();
  const { currentBackground } = useViewerPreferences();
  const navigate = useNavigate();
  const location = useLocation();
  const [showSpeedOptions, setShowSpeedOptions] = useState(false);
  const [showBackgroundPicker, setShowBackgroundPicker] = useState(false);
  const backgroundButtonRef = useRef<HTMLDivElement>(null);
  const speedButtonRef = useRef<HTMLDivElement>(null);
  const speedMenuRef = useRef<HTMLDivElement>(null);
  const [speedMenuPosition, setSpeedMenuPosition] = useState({
    top: 0,
    left: 0,
    placement: 'top' as 'top' | 'bottom'
  });

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
        console.log('[AnimationControls] Pausing animation');

        // Set flag to prevent content refresh during pause operation
        window._isPlaybackStateChanging = true;

        // Use the unified controller to pause animations
        if (svgRef) {
          controlAnimations(svgRef, {
            playState: 'paused',
            shouldReset: false,
            playbackSpeed,
            initialSetup: false
          });
        }

        // Update state
        pauseAnimations();

        // Clear the flag after a short delay
        setTimeout(() => {
          window._isPlaybackStateChanging = false;
        }, 100);
      } else {
        console.log('[AnimationControls] Resuming animation');

        // Set flag to prevent content refresh during resume operation
        window._isPlaybackStateChanging = true;

        // Use the unified controller to resume animations
        if (svgRef) {
          controlAnimations(svgRef, {
            playState: 'running',
            shouldReset: false,
            playbackSpeed,
            initialSetup: false
          });
        }

        // Update state
        resumeAnimations();

        // Clear the flag after a short delay
        setTimeout(() => {
          window._isPlaybackStateChanging = false;
        }, 100);
      }
    }
  };

  // Reset animation
  const handleReset = () => {
    if (onSeek) {
      // Use prop handler if provided
      onSeek(0);
    } else {
      if (svgRef) {
        // Use the unified controller to reset animations
        controlAnimations(svgRef, {
          playState: 'running',
          shouldReset: true,
          playbackSpeed,
          initialSetup: true
        });

        // Force animations to start playing after reset
        if (!playing) {
          resumeAnimations();
        }
      } else {
        console.warn('[AnimationControls] Cannot reset animations - no SVG element reference');
      }

      // Also reset clip position if we have an active clip
      if (activeClipId) {
        setCurrentPlaybackPosition(0);
      }
    }
  };

  // Change playback speed
  const handleSpeedChange = (speed: number | 'groovy') => {
    // Set flag to prevent content refresh during speed change operation
    window._isPlaybackStateChanging = true;

    // Changing playback speed should be seamless without interrupting the animation
    // Just update the speed without affecting the current position
    setPlaybackSpeed(speed);

    // Directly apply the speed change to the SVG
    if (svgRef) {
      console.log(`[AnimationControls] Applying speed change to ${speed}`);
      controlAnimations(svgRef, {
        playState: playing ? 'running' : 'paused',
        shouldReset: false,
        playbackSpeed: speed,
        initialSetup: true // Force initialization to apply speed change
      });
    }

    // Clear the flag after a short delay
    setTimeout(() => {
      window._isPlaybackStateChanging = false;
    }, 100);

    setShowSpeedOptions(false);
  };

  // Navigate to movie editor
  const navigateToMovieEditor = () => {
    navigate('/movie-editor');
  };

  // Calculate position for speed options popup
  useEffect(() => {
    if (!showSpeedOptions || !speedButtonRef.current) return;

    const updateSpeedMenuPosition = () => {
      const buttonRect = speedButtonRef.current?.getBoundingClientRect();
      if (!buttonRect) return;

      // Approximate height of the menu
      const menuHeight = 210; // Increased from 180 to account for new 0.25x option
      const menuWidth = 112; // Width of the menu (w-28)
      const windowHeight = window.innerHeight;

      // Determine if it should appear above or below
      const placementPosition = buttonRect.top > menuHeight ? 'top' : 'bottom';

      // Calculate position based on placement
      let top: number;
      if (placementPosition === 'top') {
        top = buttonRect.top - menuHeight - 8; // Place above with margin
      } else {
        top = buttonRect.bottom + 8; // Place below with margin
      }

      // Ensure the menu stays within the viewport
      if (top < 10) top = 10;
      if (top + menuHeight > windowHeight - 10) {
        top = windowHeight - menuHeight - 10;
      }

      // Calculate horizontal position (centered on the button)
      let left = buttonRect.left + buttonRect.width / 2 - menuWidth / 2;

      // Make sure it doesn't go off-screen
      if (left < 10) left = 10;
      if (left + menuWidth > window.innerWidth - 10) {
        left = window.innerWidth - menuWidth - 10;
      }

      setSpeedMenuPosition({
        top,
        left,
        placement: placementPosition
      });
    };

    updateSpeedMenuPosition();
    window.addEventListener('resize', updateSpeedMenuPosition);
    window.addEventListener('scroll', updateSpeedMenuPosition, true);

    return () => {
      window.removeEventListener('resize', updateSpeedMenuPosition);
      window.removeEventListener('scroll', updateSpeedMenuPosition, true);
    };
  }, [showSpeedOptions]);

  // Handle click outside to close the speed menu
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        showSpeedOptions &&
        speedMenuRef.current &&
        !speedMenuRef.current.contains(event.target as Node) &&
        speedButtonRef.current &&
        !speedButtonRef.current.contains(event.target as Node)
      ) {
        setShowSpeedOptions(false);
      }
    };

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [showSpeedOptions]);

  // If no content, don't show controls
  if (!hasContent) return null;

  // Create speed options menu
  const speedOptionsMenu = showSpeedOptions && (
    ReactDOM.createPortal(
      <div
        ref={speedMenuRef}
        className="fixed w-28 bg-gray-900 border border-gray-700 rounded-md shadow-lg z-50"
        style={{
          top: `${speedMenuPosition.top}px`,
          left: `${speedMenuPosition.left}px`,
        }}
      >
        <div className="py-1">
          <button
            className={`w-full text-left px-2 sm:px-3 py-1 sm:py-1.5 text-xs ${playbackSpeed === 0.25 ? 'text-bat-yellow' : 'text-white'} hover:bg-gray-800`}
            onClick={() => handleSpeedChange(0.25)}
          >
            0.25x
          </button>
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
            className={`w-full text-left px-2 sm:px-3 py-1 sm:py-1.5 text-xs ${playbackSpeed === 5 ? 'text-bat-yellow' : 'text-white'} hover:bg-gray-800`}
            onClick={() => handleSpeedChange(5)}
          >
            5x
          </button>
          <button
            className={`w-full text-left px-2 sm:px-3 py-1 sm:py-1.5 text-xs ${playbackSpeed === 10 ? 'text-bat-yellow' : 'text-white'} hover:bg-gray-800`}
            onClick={() => handleSpeedChange(10)}
          >
            10x
          </button>
          <button
            className={`w-full text-left px-2 sm:px-3 py-1 sm:py-1.5 text-xs ${playbackSpeed === 'groovy' ? 'text-bat-yellow' : 'text-white'} hover:bg-gray-800`}
            onClick={() => handleSpeedChange('groovy')}
          >
            🕺 Groovy
          </button>
        </div>
      </div>,
      document.body
    )
  );

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

        <div className="relative" ref={speedButtonRef}>
          <button
            className="text-white hover:text-bat-yellow p-1 rounded focus:outline-none"
            onClick={() => setShowSpeedOptions(!showSpeedOptions)}
            aria-label="Playback Speed"
          >
            <svg className="w-4 h-4 sm:w-5 sm:h-5 md:w-6 md:h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 10V3L4 14h7v7l9-11h-7z" />
            </svg>
          </button>

          {speedOptionsMenu}
        </div>
      </div>
    </div>
  );
};

export default AnimationControls;
