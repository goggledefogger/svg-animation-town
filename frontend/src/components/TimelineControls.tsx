import React from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { formatTime } from '../utils/helpers';
import { debugLog } from '../utils/logging';

const TimelineControls: React.FC = () => {
  const {
    currentTime,
    setCurrentTime,
    playing,
    setPlaying,
    duration,
    setDuration,
    elements,
    undoAnimation,
    redoAnimation,
    canUndo,
    canRedo
  } = useAnimation();

  // Calculate progress percentage
  const progress = (currentTime / duration) * 100;

  // Handle timeline click
  const handleTimelineClick = (e: React.MouseEvent<HTMLDivElement>) => {
    const timeline = e.currentTarget;
    const rect = timeline.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const clickedProgress = x / rect.width;
    setCurrentTime(clickedProgress * duration);
  };

  // Handle undo button click
  const handleUndo = () => {
    const result = undoAnimation();
    if (result) {
      debugLog('Undid animation:', result);
    }
  };

  // Handle redo button click
  const handleRedo = () => {
    const result = redoAnimation();
    if (result) {
      debugLog('Redid animation:', result);
    }
  };

  // Empty state check
  if (elements.length === 0) {
    return null;
  }

  return (
    <div className="mt-4 bg-gotham-blue rounded-lg p-4">
      <div className="flex items-center justify-between mb-2">
        <div className="text-gray-400 text-sm">
          {formatTime(currentTime)} / {formatTime(duration)}
        </div>
        <div className="flex space-x-2">
          {/* Undo button */}
          <button
            className={`btn btn-outline text-sm px-3 py-1 ${!canUndo() ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleUndo}
            disabled={!canUndo()}
            title="Undo last animation"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M9.707 14.707a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414l4-4a1 1 0 011.414 1.414L7.414 9H15a1 1 0 110 2H7.414l2.293 2.293a1 1 0 010 1.414z" clipRule="evenodd"></path>
            </svg>
          </button>
          
          {/* Redo button */}
          <button
            className={`btn btn-outline text-sm px-3 py-1 ${!canRedo() ? 'opacity-50 cursor-not-allowed' : ''}`}
            onClick={handleRedo}
            disabled={!canRedo()}
            title="Redo animation"
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10.293 5.293a1 1 0 011.414 0l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414-1.414L12.586 11H5a1 1 0 110-2h7.586l-2.293-2.293a1 1 0 010-1.414z" clipRule="evenodd"></path>
            </svg>
          </button>
          
          <button
            className="btn btn-outline text-sm px-3 py-1"
            onClick={() => setCurrentTime(0)}
          >
            <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
              <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zm.707-10.293a1 1 0 00-1.414-1.414l-3 3a1 1 0 000 1.414l3 3a1 1 0 001.414-1.414L9.414 11H13a1 1 0 100-2H9.414l1.293-1.293z" clipRule="evenodd"></path>
            </svg>
          </button>
          <button
            className="btn btn-outline text-sm px-3 py-1"
            onClick={() => setPlaying(!playing)}
          >
            {playing ? (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M18 10a8 8 0 11-16 0 8 8 0 0116 0zM7 8a1 1 0 012 0v4a1 1 0 11-2 0V8zm5-1a1 1 0 00-1 1v4a1 1 0 102 0V8a1 1 0 00-1-1z" clipRule="evenodd"></path>
              </svg>
            ) : (
              <svg className="w-4 h-4" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z" clipRule="evenodd"></path>
              </svg>
            )}
          </button>
        </div>
      </div>

      {/* Timeline scrubber */}
      <div
        className="h-4 bg-gray-700 rounded cursor-pointer relative"
        onClick={handleTimelineClick}
      >
        <div
          className="h-full bg-bat-yellow rounded"
          style={{ width: `${progress}%` }}
        ></div>
        <div
          className="absolute top-0 h-full"
          style={{ left: `${progress}%` }}
        >
          <div className="h-4 w-1 bg-white transform -translate-x-1/2"></div>
        </div>
      </div>

      {/* Duration controls */}
      <div className="mt-2 flex items-center justify-between text-sm text-gray-400">
        <div>
          <label className="mr-2">Duration:</label>
          <select
            className="bg-gotham-dark border border-gray-700 rounded px-1 py-0.5"
            value={duration}
            onChange={(e) => setDuration(Number(e.target.value))}
          >
            <option value="5000">5 seconds</option>
            <option value="10000">10 seconds</option>
            <option value="15000">15 seconds</option>
            <option value="30000">30 seconds</option>
            <option value="60000">1 minute</option>
          </select>
        </div>
        
        <div className="text-xs text-gray-500">
          {canUndo() && "Use undo/redo to navigate between animations"}
        </div>
      </div>
    </div>
  );
};

export default TimelineControls;
