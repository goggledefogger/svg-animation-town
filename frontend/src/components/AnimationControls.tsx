import React from 'react';
import { useAnimation } from '../contexts/AnimationContext';

const AnimationControls: React.FC = () => {
  const { playing, pauseAnimations, resumeAnimations, resetAnimations, svgContent } = useAnimation();

  // Toggle play/pause
  const togglePlayback = () => {
    if (playing) {
      pauseAnimations();
    } else {
      resumeAnimations();
    }
  };

  // Reset animation
  const handleReset = () => {
    resetAnimations();
  };

  // Only show controls if there's SVG content
  if (!svgContent) {
    return null;
  }

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg mt-4">
      <div className="flex items-center justify-center space-x-4">
        <button
          onClick={handleReset}
          className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label="Reset"
        >
          <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
          </svg>
        </button>
        <button
          onClick={togglePlayback}
          className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded focus:outline-none focus:ring-2 focus:ring-blue-400"
          aria-label={playing ? "Pause" : "Play"}
        >
          {playing ? (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M10 9v6m4-6v6m7-3a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M14.752 11.168l-3.197-2.132A1 1 0 0010 9.87v4.263a1 1 0 001.555.832l3.197-2.132a1 1 0 000-1.664z" />
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </button>
      </div>
    </div>
  );
};

export default AnimationControls;
