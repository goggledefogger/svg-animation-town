import React from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { useAnimationPlayback } from '../hooks/useAnimationPlayback';

const AnimationControls: React.FC = () => {
  const { duration } = useAnimation();
  const { currentTime, setCurrentTime, playing, setPlaying } = useAnimationPlayback();

  // Format time as MM:SS.ms
  const formatTime = (ms: number) => {
    const totalSeconds = ms / 1000;
    const minutes = Math.floor(totalSeconds / 60);
    const seconds = Math.floor(totalSeconds % 60);
    const milliseconds = Math.floor((totalSeconds - Math.floor(totalSeconds)) * 100);

    return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
  };

  // Handle timeline scrubbing
  const handleTimelineChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setCurrentTime(parseFloat(e.target.value));
  };

  // Toggle play/pause
  const togglePlayback = () => {
    setPlaying(!playing);
  };

  // Reset to beginning
  const resetPlayback = () => {
    setCurrentTime(0);
    if (playing) setPlaying(false);
  };

  return (
    <div className="bg-gray-800 p-4 rounded-lg shadow-lg">
      <div className="flex items-center justify-between mb-2">
        <div className="text-white font-mono">{formatTime(currentTime)}</div>
        <div className="flex space-x-2">
          <button
            onClick={resetPlayback}
            className="bg-gray-700 hover:bg-gray-600 text-white p-2 rounded"
            aria-label="Reset"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" />
            </svg>
          </button>
          <button
            onClick={togglePlayback}
            className="bg-blue-600 hover:bg-blue-500 text-white p-2 rounded"
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
        <div className="text-white font-mono">{formatTime(duration)}</div>
      </div>
      <div className="relative">
        <input
          type="range"
          min="0"
          max={duration}
          value={currentTime}
          onChange={handleTimelineChange}
          className="w-full h-2 bg-gray-700 rounded-lg appearance-none cursor-pointer"
        />
        <div
          className="absolute top-0 left-0 h-2 bg-blue-500 rounded-lg pointer-events-none"
          style={{ width: `${(currentTime / duration) * 100}%` }}
        />
      </div>
    </div>
  );
};

export default AnimationControls;
