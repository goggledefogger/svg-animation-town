import { useRef, useEffect } from 'react';
import { useAnimation } from '../contexts/AnimationContext';

/**
 * Custom hook for handling animation playback
 */
export const useAnimationPlayback = () => {
  const {
    currentTime,
    setCurrentTime,
    playing,
    setPlaying,
    duration
  } = useAnimation();

  const requestRef = useRef<number>();
  const previousTimeRef = useRef<number>();

  // Animation loop
  const animate = (time: number) => {
    if (previousTimeRef.current === undefined) {
      previousTimeRef.current = time;
    }

    const deltaTime = time - previousTimeRef.current;
    previousTimeRef.current = time;

    if (playing) {
      const newTime = currentTime + deltaTime;
      setCurrentTime(newTime >= duration ? 0 : newTime);
    }

    requestRef.current = requestAnimationFrame(animate);
  };

  // Set up and clean up animation frame
  useEffect(() => {
    requestRef.current = requestAnimationFrame(animate);
    return () => {
      if (requestRef.current) {
        cancelAnimationFrame(requestRef.current);
      }
    };
  }, [playing, duration, currentTime]);

  return {
    currentTime,
    setCurrentTime,
    playing,
    setPlaying,
    duration
  };
};
