import React, { useEffect, useRef, useState } from 'react';
import { MovieClip } from '../contexts/MovieContext';

interface ProgressBarProps {
  clips: MovieClip[];
  currentClipIndex: number;
  isPlaying: boolean;
}

const ProgressBar: React.FC<ProgressBarProps> = ({ clips, currentClipIndex, isPlaying }) => {
  const [progress, setProgress] = useState(0);
  const rafRef = useRef<number | null>(null);
  const startTimeRef = useRef<number | null>(null);
  const pausedTimeRef = useRef<number>(0); // Track how much of the clip was played before pause

  // Reset progress when clip changes
  useEffect(() => {
    setProgress(0);
    startTimeRef.current = null;
    pausedTimeRef.current = 0;
  }, [currentClipIndex]);

  // Handle Play/Pause
  useEffect(() => {
    if (isPlaying) {
      // Resume or Start
      if (startTimeRef.current === null) {
        // First play of this clip
        startTimeRef.current = Date.now();
      } else {
        // Resuming: adjust start time to account for pause duration
        // effectively: newStartTime = now - (amount_already_played)
        // amount_already_played was stored in pausedTimeRef when we paused?
        // Actually simpler:
        // We need to know "ideal start time" such that (now - ideal_start) = pausedTimeRef
        // Wait, standard way:
        // 1. Start: startTime = Date.now()
        // 2. Pause: pausedProgress = (Date.now() - startTime)
        // 3. Resume: startTime = Date.now() - pausedProgress
        startTimeRef.current = Date.now() - pausedTimeRef.current;
      }

      const animate = () => {
        if (!startTimeRef.current) return;

        const now = Date.now();
        const elapsed = now - startTimeRef.current;
        const duration = (clips[currentClipIndex]?.duration || 5) * 1000;

        let newProgress = (elapsed / duration) * 100;
        if (newProgress > 100) newProgress = 100;

        setProgress(newProgress);

        if (newProgress < 100) {
          rafRef.current = requestAnimationFrame(animate);
        }
      };

      rafRef.current = requestAnimationFrame(animate);
    } else {
      // Pausing
      if (rafRef.current) {
        cancelAnimationFrame(rafRef.current);
      }
      // Calculate how much we played so far to resume correctly
      if (startTimeRef.current) {
        pausedTimeRef.current = Date.now() - startTimeRef.current;
      }
    }

    return () => {
      if (rafRef.current) cancelAnimationFrame(rafRef.current);
    };
  }, [isPlaying, currentClipIndex, clips]);

  return (
    <div className="w-full flex gap-1 h-1">
      {clips.map((clip, idx) => (
        <div key={clip.id} className="h-full flex-1 bg-gray-700/50 rounded-full overflow-hidden">
          <div
            className={`h-full bg-bat-yellow transition-all duration-75 ease-linear ${
              idx < currentClipIndex ? 'w-full' :
              idx === currentClipIndex ? '' : 'w-0'
            }`}
            style={{
              width: idx < currentClipIndex ? '100%' : (idx === currentClipIndex ? `${progress}%` : '0%'),
            }}
          />
        </div>
      ))}
    </div>
  );
};

export default ProgressBar;
