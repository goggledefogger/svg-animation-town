import { useState, useRef, useCallback } from 'react';

// Define a more comprehensive animation registry that can store all types of animation data
interface AnimationRegistry {
  // Core animation data
  animations: Map<string, string>;           // Animation SVG content by ID
  loadingStatus: Set<string>;                // Animation IDs currently loading
  failedLoads: Set<string>;                  // Animation IDs that failed to load

  // Metadata for animations
  metadata: Map<string, {                    // Metadata by animation ID
    name?: string;
    timestamp?: string;
    chatHistory?: any[];
    provider?: 'openai' | 'claude' | 'gemini';
  }>;

  // Tracking for API requests
  pendingRequests: Map<string, Promise<any>>; // In-progress API requests by request ID

  // List cache
  listCache: {                               // Cache for animation listings
    timestamp: number;                       // When the list was last fetched
    animations: any[];                       // The cached animation list
  } | null;
}

// Create a single global registry that will be shared across the entire application
export const GLOBAL_ANIMATION_REGISTRY: AnimationRegistry = {
  animations: new Map<string, string>(),
  loadingStatus: new Set<string>(),
  failedLoads: new Set<string>(),
  metadata: new Map(),
  pendingRequests: new Map(),
  listCache: null
};

// Add helper functions to the registry
export const AnimationRegistryHelpers = {
  /**
   * Store animation content with metadata
   */
  storeAnimation: (
    animationId: string,
    svgContent: string,
    metadata?: {
      name?: string;
      timestamp?: string;
      chatHistory?: any[];
      provider?: 'openai' | 'claude' | 'gemini';
    }
  ) => {
    if (!animationId || !svgContent || svgContent.length < 100) {
      console.log(`[ANIMATION_REGISTRY] Invalid animation data for ID ${animationId}, not storing`);
      return;
    }

    // Check if this animation ID is already stored
    const existingAnimation = GLOBAL_ANIMATION_REGISTRY.animations.get(animationId);
    if (existingAnimation) {
      console.log(`[ANIMATION_REGISTRY] Animation ${animationId} already exists in registry (${existingAnimation.length} bytes)`);

      // Only update if we have better data
      if (svgContent.length > existingAnimation.length) {
        console.log(`[ANIMATION_REGISTRY] Updating with better SVG data (${svgContent.length} vs ${existingAnimation.length} bytes)`);
        GLOBAL_ANIMATION_REGISTRY.animations.set(animationId, svgContent);
      }

      // Always update metadata if provided
      if (metadata) {
        GLOBAL_ANIMATION_REGISTRY.metadata.set(animationId, {
          ...GLOBAL_ANIMATION_REGISTRY.metadata.get(animationId),
          ...metadata
        });
        console.log(`[ANIMATION_REGISTRY] Updated metadata for animation ${animationId}`);
      }

      return;
    }

    // Store the SVG content for new animation
    GLOBAL_ANIMATION_REGISTRY.animations.set(animationId, svgContent);

    // Store metadata if provided
    if (metadata) {
      GLOBAL_ANIMATION_REGISTRY.metadata.set(animationId, {
        ...GLOBAL_ANIMATION_REGISTRY.metadata.get(animationId),
        ...metadata
      });
    }

    // Clear loading and failure status
    GLOBAL_ANIMATION_REGISTRY.loadingStatus.delete(animationId);
    GLOBAL_ANIMATION_REGISTRY.failedLoads.delete(animationId);
  },

  /**
   * Get animation content if available
   */
  getAnimation: (animationId: string): {
    svg: string | null;
    metadata: any | null;
    status: 'available' | 'loading' | 'failed' | 'not_found';
  } => {
    if (!animationId) {
      return { svg: null, metadata: null, status: 'not_found' };
    }

    // Check if loading
    if (GLOBAL_ANIMATION_REGISTRY.loadingStatus.has(animationId)) {
      console.log(`[ANIMATION_REGISTRY_ACCESS] Animation ${animationId} status: loading`);
      return { svg: null, metadata: null, status: 'loading' };
    }

    // Check if failed
    if (GLOBAL_ANIMATION_REGISTRY.failedLoads.has(animationId)) {
      console.log(`[ANIMATION_REGISTRY_ACCESS] Animation ${animationId} status: failed`);
      return { svg: null, metadata: null, status: 'failed' };
    }

    // Check if we have content
    const svg = GLOBAL_ANIMATION_REGISTRY.animations.get(animationId) || null;
    const metadata = GLOBAL_ANIMATION_REGISTRY.metadata.get(animationId) || null;

    if (svg && svg.length > 100) {
      console.log(`[ANIMATION_REGISTRY_ACCESS] Animation ${animationId} status: available (${svg.length} bytes)`);
      return { svg, metadata, status: 'available' };
    }

    console.log(`[ANIMATION_REGISTRY_ACCESS] Animation ${animationId} status: not_found`);
    return { svg: null, metadata: null, status: 'not_found' };
  },

  /**
   * Mark an animation as loading
   */
  markLoading: (animationId: string) => {
    if (!animationId) return;
    if (!GLOBAL_ANIMATION_REGISTRY.loadingStatus.has(animationId)) {
      GLOBAL_ANIMATION_REGISTRY.loadingStatus.add(animationId);
    }
  },

  /**
   * Mark an animation as failed
   */
  markFailed: (animationId: string) => {
    if (!animationId) return;

    // If we're marking as failed, ensure it's not in loading state anymore
    GLOBAL_ANIMATION_REGISTRY.loadingStatus.delete(animationId);

    // Only add to failed set if we don't have valid content
    if (!GLOBAL_ANIMATION_REGISTRY.animations.has(animationId)) {
      GLOBAL_ANIMATION_REGISTRY.failedLoads.add(animationId);
      console.log(`[ANIMATION_REGISTRY] Marked animation ${animationId} as failed`);
    }
  },

  /**
   * Track a loaded animation, with or without content
   */
  trackLoadedAnimation: (animationId: string, svgContent?: string, metadata?: any) => {
    if (!animationId) return;

    // If content is provided and valid, store it
    if (svgContent && typeof svgContent === 'string' && svgContent.length > 100) {
      // Store animation content
      GLOBAL_ANIMATION_REGISTRY.animations.set(animationId, svgContent);

      // Store metadata if provided
      if (metadata) {
        GLOBAL_ANIMATION_REGISTRY.metadata.set(animationId, {
          ...GLOBAL_ANIMATION_REGISTRY.metadata.get(animationId),
          ...metadata
        });
      }

      // Remove from failed and loading sets
      GLOBAL_ANIMATION_REGISTRY.failedLoads.delete(animationId);
      GLOBAL_ANIMATION_REGISTRY.loadingStatus.delete(animationId);
    } else {
      // If no valid content, mark as failed unless we already have content
      if (!GLOBAL_ANIMATION_REGISTRY.animations.has(animationId)) {
        console.log(`[ANIMATION_REGISTRY] No valid content provided for ${animationId}, marking as failed`);
        GLOBAL_ANIMATION_REGISTRY.failedLoads.add(animationId);
      }

      // Always remove from loading status when tracking is complete
      GLOBAL_ANIMATION_REGISTRY.loadingStatus.delete(animationId);
    }
  },

  /**
   * Clear registry entries for an animation
   */
  clearAnimation: (animationId?: string) => {
    if (animationId) {
      GLOBAL_ANIMATION_REGISTRY.animations.delete(animationId);
      GLOBAL_ANIMATION_REGISTRY.metadata.delete(animationId);
      GLOBAL_ANIMATION_REGISTRY.loadingStatus.delete(animationId);
      GLOBAL_ANIMATION_REGISTRY.failedLoads.delete(animationId);

      // Clear any pending requests related to this animation
      [...GLOBAL_ANIMATION_REGISTRY.pendingRequests.keys()]
        .filter(key => key.includes(animationId))
        .forEach(key => GLOBAL_ANIMATION_REGISTRY.pendingRequests.delete(key));
    } else {
      // Clear everything
      GLOBAL_ANIMATION_REGISTRY.animations.clear();
      GLOBAL_ANIMATION_REGISTRY.metadata.clear();
      GLOBAL_ANIMATION_REGISTRY.loadingStatus.clear();
      GLOBAL_ANIMATION_REGISTRY.failedLoads.clear();
      GLOBAL_ANIMATION_REGISTRY.pendingRequests.clear();
      GLOBAL_ANIMATION_REGISTRY.listCache = null;
    }
  },

  /**
   * Track a pending API request to prevent duplicates
   */
  trackRequest: <T>(requestId: string, promise: Promise<T>): Promise<T> => {
    if (GLOBAL_ANIMATION_REGISTRY.pendingRequests.has(requestId)) {
      console.log(`[ANIMATION_REGISTRY] Reusing existing request: ${requestId}`);
      return GLOBAL_ANIMATION_REGISTRY.pendingRequests.get(requestId) as Promise<T>;
    }

    // Track new request
    GLOBAL_ANIMATION_REGISTRY.pendingRequests.set(requestId, promise);

    // Remove from tracking when complete
    promise.finally(() => {
      GLOBAL_ANIMATION_REGISTRY.pendingRequests.delete(requestId);
    });

    return promise;
  },

  /**
   * Cache animation list results
   */
  storeAnimationList: (animations: any[]) => {
    GLOBAL_ANIMATION_REGISTRY.listCache = {
      timestamp: Date.now(),
      animations
    };
  },

  /**
   * Get cached animation list if available and not expired
   */
  getAnimationList: (maxAgeMs = 5000): any[] | null => {
    const cache = GLOBAL_ANIMATION_REGISTRY.listCache;
    if (cache) {
      const age = Date.now() - cache.timestamp;
      if (age < maxAgeMs) {
        return cache.animations;
      }
    }
    return null;
  }
};

/**
 * Custom hook to manage animation loading state
 * Uses the global registry for caching
 */
const useAnimationLoader = (
  setSvgContent: (content: string) => void,
  createPlaceholderSvg: (message: string) => string
) => {
  const [isLoading, setIsLoading] = useState(false);
  const loadingTimeoutRef = useRef<number | null>(null);

  // Track server API call state
  const isServerApiCallPendingRef = useRef(false);

  // Start loading animation
  const startLoading = useCallback((isServerCall = false) => {
    if (isServerCall) {
      isServerApiCallPendingRef.current = true;
      setIsLoading(true);
      console.log('[Loading] Starting loading animation for server API call');
    } else {
      console.log('[Loading] Skipping loading animation for client-side operation');
    }

    // Clear any existing timeout
    if (loadingTimeoutRef.current !== null) {
      clearTimeout(loadingTimeoutRef.current);
      loadingTimeoutRef.current = null;
    }
  }, []);

  // End loading with delay to avoid flickering
  const endLoading = useCallback((delay = 800) => {
    // Clear any existing timeout
    if (loadingTimeoutRef.current !== null) {
      clearTimeout(loadingTimeoutRef.current);
    }

    // Only hide loading if it was a server call
    if (isServerApiCallPendingRef.current) {
      console.log('[Loading] Scheduling end of loading animation after server API call');

      // Set new timeout
      loadingTimeoutRef.current = window.setTimeout(() => {
        setIsLoading(false);
        isServerApiCallPendingRef.current = false;
        loadingTimeoutRef.current = null;
        console.log('[Loading] Hiding loading animation after server API call');
      }, delay);
    }
  }, []);

  // Helper for tracking when animations are loaded - wraps the registry helper
  const trackLoadedAnimation = useCallback((animationId: string, svgContent?: string) => {
    if (!animationId) return;

    if (svgContent && svgContent.length > 100) {
      // Use the registry helper to store the animation
      AnimationRegistryHelpers.storeAnimation(animationId, svgContent);
    } else {
      // Mark as failed if no valid content
      AnimationRegistryHelpers.markFailed(animationId);
    }
  }, []);

  // Mark animation as currently loading
  const markLoadingInProgress = useCallback((animationId: string) => {
    if (animationId) {
      AnimationRegistryHelpers.markLoading(animationId);
    }
  }, []);

  // Check if animation has been loaded or is loading
  const hasBeenLoaded = useCallback((animationId: string) => {
    if (!animationId) return false;

    const result = AnimationRegistryHelpers.getAnimation(animationId);

    // If the animation is available, set the SVG content
    if (result.status === 'available' && result.svg) {
      console.log(`[Loading] Using cached SVG content for ${animationId} (${result.svg.length} bytes)`);
      setSvgContent(result.svg);
      return true;
    }

    // If loading or failed, consider it "loaded" to prevent duplicate requests
    return result.status === 'loading' || result.status === 'failed';
  }, [setSvgContent]);

  // Get cached animation content if available
  const getCachedContent = useCallback((animationId: string): string | null => {
    if (!animationId) return null;

    const result = AnimationRegistryHelpers.getAnimation(animationId);
    if (result.status === 'available' && result.svg) {
      return result.svg;
    }

    return null;
  }, []);

  // Clear the loading cache (e.g., for forced refresh)
  const clearLoadingCache = useCallback((animationId?: string) => {
    AnimationRegistryHelpers.clearAnimation(animationId);
  }, []);

  return {
    isLoading,
    startLoading,
    endLoading,
    trackLoadedAnimation,
    markLoadingInProgress,
    hasBeenLoaded,
    getCachedContent,
    clearLoadingCache
  };
};

export default useAnimationLoader;
