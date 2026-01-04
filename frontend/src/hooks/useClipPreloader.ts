import { useEffect, useCallback, useRef } from 'react';
import { MovieClip } from '../contexts/MovieContext';
import { MovieStorageApi } from '../services/api';

interface UseClipPreloaderProps {
  clips: MovieClip[];
  currentClipIndex: number;
  isPlaying: boolean;
  isLooping?: boolean;
  updateClip: (clipId: string, updates: Partial<MovieClip>) => void;
}

/**
 * Hook to preload the next clip's SVG content during playback
 * to prevent flashing "Loading..." states between clips.
 */
export const useClipPreloader = ({
  clips,
  currentClipIndex,
  isPlaying,
  isLooping = false,
  updateClip,
}: UseClipPreloaderProps) => {

  // Track redundant requests
  const pendingRequestsRef = useRef<Set<string>>(new Set());

  const preloadClip = useCallback(async (clipIndex: number) => {
    if (!clips || clipIndex < 0 || clipIndex >= clips.length) return;
    const clip = clips[clipIndex];

    // If already has content, skip
    if (clip.svgContent && clip.svgContent.length > 100) return;

    // If no animation ID, can't load
    if (!clip.animationId) return;

    // Avoid duplicate requests
    if (pendingRequestsRef.current.has(clip.id)) return;

    try {
      pendingRequestsRef.current.add(clip.id);
      // console.log(`[Preloader] Preloading clip ${clipIndex} (${clip.id})`);
      const animation = await MovieStorageApi.getClipAnimation(clip.animationId);
      if (animation && animation.svg) {
        // console.log(`[Preloader] Loaded SVG for ${clip.id}, updating clip. Size: ${animation.svg.length}`);
        updateClip(clip.id, { svgContent: animation.svg });
      }
    } catch (e) {
      console.warn(`[Preloader] Failed to preload clip ${clip.id}`, e);
    } finally {
      pendingRequestsRef.current.delete(clip.id);
    }
  }, [clips, updateClip]);

  useEffect(() => {
    // Only preload if we are playing or about to play
    if (!isPlaying && currentClipIndex === 0) {
        // Optional: preload first few clips on mount if paused?
        // For now, adhere to playback logic to behave like existing code
    }

    // Determine next clip index
    const nextIndex = (currentClipIndex + 1) % clips.length;

    // Only preload if looping is enabled or it's not the last clip
    // Logic:
    // If isLooping=true: always preload next index (mod length)
    // If isLooping=false: preload next index ONLY if current < length - 1
    const shouldPreload = isLooping || currentClipIndex < clips.length - 1;

    if (shouldPreload) {
      preloadClip(nextIndex);
      // Aggressively preload 2 steps ahead to handle short clips
      if (clips.length > 2) {
        const nextNextIndex = (currentClipIndex + 2) % clips.length;
        if (isLooping || currentClipIndex < clips.length - 2) {
            preloadClip(nextNextIndex);
        }
      }
    }
  }, [currentClipIndex, isPlaying, isLooping, clips.length, preloadClip]);
};
