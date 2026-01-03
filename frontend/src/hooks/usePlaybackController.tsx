import { useEffect } from 'react';
import { useMovie } from '../contexts/MovieContext';

/**
 * Hook for managing animation playback
 */
export function usePlaybackController() {
  const {
    activeClipId,
    isPlaying,
    currentPlaybackPosition,
    getActiveClip,
    setCurrentPlaybackPosition
  } = useMovie();

  // Playback timer for clips - refined for better performance and sync
  useEffect(() => {
    if (!isPlaying || !activeClipId) return;

    const activeClip = getActiveClip();
    if (!activeClip) return;
    const clipDuration = activeClip.duration || 5;

    let lastTimestamp: number | null = null;
    let animationFrameId: number;

    // Animation loop to update playback position
    const updatePlayback = (timestamp: number) => {
      if (lastTimestamp === null) {
        lastTimestamp = timestamp;
      }

      // Calculate time elapsed since last frame
      const elapsed = (timestamp - lastTimestamp) / 1000; // convert to seconds
      lastTimestamp = timestamp;

      // Update position using functional update to avoid dependency on currentPlaybackPosition
      setCurrentPlaybackPosition((prev: number) => {
        const next = prev + elapsed;
        return next >= clipDuration ? 0 : next;
      });

      // Continue the animation loop
      animationFrameId = requestAnimationFrame(updatePlayback);
    };

    // Start the animation loop
    animationFrameId = requestAnimationFrame(updatePlayback);

    // Clean up when component unmounts or dependencies change
    return () => {
      cancelAnimationFrame(animationFrameId);
    };
  }, [isPlaying, activeClipId, getActiveClip, setCurrentPlaybackPosition]);

  return {
    // No additional methods needed as playback is handled by the effect
  };
}
