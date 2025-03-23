import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAnimation, useSvgRef } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import { MovieClip } from '../contexts/MovieContext';
import EmptyState from './EmptyState';
import { MovieStorageApi } from '../services/api';

interface AnimationCanvasProps {
  svgContent?: string;
  style?: React.CSSProperties;
}

// Custom hook to manage animation loading state
const useAnimationLoader = (setSvgContent: (content: string) => void, createPlaceholderSvg: (message: string) => string) => {
  const [isLoading, setIsLoading] = useState(false);
  const loadingTimeoutRef = useRef<number | null>(null);
  // Add a flag to track if we're waiting for a server API call
  const isServerApiCallPendingRef = useRef(false);
  // Add tracking of previously loaded animations
  const loadedAnimationsRef = useRef<Set<string>>(new Set());
  // Track animations that are currently being loaded to prevent duplicate loading
  const loadingInProgressRef = useRef<Record<string, boolean>>({});

  // Start loading animation - only show for server API calls
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

  // End loading with delay
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

  // Track loaded animations to avoid showing loading for previously loaded content
  const trackLoadedAnimation = useCallback((animationId: string | null) => {
    if (animationId) {
      // Mark as loaded and no longer in progress
      loadedAnimationsRef.current.add(animationId);
      delete loadingInProgressRef.current[animationId];
      console.log(`[Loading] Tracked loaded animation: ${animationId}. Total cached: ${loadedAnimationsRef.current.size}`);
    }
  }, []);

  // Track animations that are currently being loaded
  const markLoadingInProgress = useCallback((animationId: string | null) => {
    if (animationId) {
      loadingInProgressRef.current[animationId] = true;
      console.log(`[Loading] Marked animation loading in progress: ${animationId}`);
    }
  }, []);

  // Check if an animation has been loaded before
  const hasBeenLoaded = useCallback((animationId: string | null) => {
    if (!animationId) return false;

    // Check if the animation has been loaded or is currently being loaded
    const hasLoaded = loadedAnimationsRef.current.has(animationId);
    const isLoading = animationId in loadingInProgressRef.current;

    console.log(`[Loading] Animation ${animationId} has ${hasLoaded ? 'been loaded before' : 'not been loaded before'}, isLoading: ${isLoading}`);

    // Return true if either it's been loaded or is currently loading to prevent duplicate loads
    return hasLoaded || isLoading;
  }, []);

  return {
    isLoading,
    startLoading,
    endLoading,
    trackLoadedAnimation,
    markLoadingInProgress,
    hasBeenLoaded
  };
};

const AnimationCanvas: React.FC<AnimationCanvasProps> = ({
  svgContent: propSvgContent,
  style
}) => {
  const { svgContent: contextSvgContent, setSvgContent } = useAnimation();
  const { currentStoryboard, activeClipId, getActiveClip, updateClip } = useMovie();
  const setSvgRef = useSvgRef();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const currentSvgRef = useRef<SVGSVGElement | null>(null);

  // Add render counter to track excessive renders
  const renderCountRef = useRef(0);
  // Use a state variable to track whether we're showing the empty state or the SVG
  const [showEmptyState, setShowEmptyState] = useState(true);
  // Track if a message has been sent to hide the empty state
  const [hasMessageBeenSent, setHasMessageBeenSent] = useState(false);

  // Helper function to create a placeholder SVG with an error message
  const createPlaceholderSvg = useCallback((message: string): string => {
    // Placeholder implementation
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <rect width="800" height="600" fill="#1a1a2e" />
      <text x="400" y="300" font-family="Arial" font-size="16" fill="white" text-anchor="middle">${message}</text>
    </svg>`;
  }, []);

  // Use our animation loader hook
  const {
    isLoading,
    startLoading,
    endLoading,
    trackLoadedAnimation,
    markLoadingInProgress,
    hasBeenLoaded
  } = useAnimationLoader(setSvgContent, createPlaceholderSvg);

  // Add a reference to track if clip change is pending
  const clipChangePendingRef = useRef(false);

  // Get the current active clip's SVG content
  const activeClipSvgContent = activeClipId ? getActiveClip()?.svgContent : null;

  // Create a more stable display content value that doesn't change unnecessarily
  // We use a ref to store the last valid content to avoid losing it during re-renders
  const lastValidContentRef = useRef<string>('');

  // Create a ref to track dependency changes
  const lastDepsRef = useRef({
    activeClipId: null as string | null,
    svgContentLength: 0
  });

  // Determine which SVG content to use with clear priorities and fallbacks
  const displaySvgContent = useMemo(() => {
    // Priority for content source:
    // 1. Explicit prop (highest priority)
    // 2. Active clip's SVG content
    // 3. Context SVG content
    // 4. Last valid content we've seen (in case state temporarily becomes empty)

    let content = '';
    let source = 'none';

    if (propSvgContent) {
      // Props take highest priority
      content = propSvgContent;
      source = 'props';
    } else if (activeClipSvgContent) {
      // Then active clip
      content = activeClipSvgContent;
      source = 'activeClip';
    } else if (contextSvgContent) {
      // Then global context
      content = contextSvgContent;
      source = 'context';
    } else if (lastValidContentRef.current) {
      // Fallback to last known good content if everything else is empty
      // This helps during state transitions that might temporarily clear values
      content = lastValidContentRef.current;
      source = 'lastValidCache';
    }

    // Store any non-empty content as our latest valid content
    if (content) {
      lastValidContentRef.current = content;
    }

    return content;
  }, [propSvgContent, activeClipSvgContent, contextSvgContent]);

  // Helper function to get the SVG container
  const getSvgContainer = useCallback((): HTMLDivElement | null => {
    if (!containerRef.current) return null;
    return containerRef.current.querySelector('[data-testid="svg-container"]') as HTMLDivElement;
  }, []);

  // Effect for handling active clip changes
  useEffect(() => {
    // Log dependency changes to track render triggers
    const displaySvgLength = displaySvgContent?.length || 0;
    const hasChanged = activeClipId !== lastDepsRef.current.activeClipId ||
                     displaySvgLength !== lastDepsRef.current.svgContentLength;

    if (hasChanged) {
      // Update the ref
      lastDepsRef.current = {
        activeClipId,
        svgContentLength: displaySvgLength
      };
    }

    if (propSvgContent) return; // Skip if prop was provided

    const activeClip = activeClipId ? getActiveClip() : null;

    if (!activeClip) {
      // If no active clip and we don't already have content, clear the display
      if (!contextSvgContent) {
        setSvgContent('');
      }
      return;
    }

    // Only process clip content if we've just changed to this clip or the clip is the same but content changed
    const isNewClip = activeClipId !== lastDepsRef.current.activeClipId || clipChangePendingRef.current;

    // Keep track of active clip for updates
    if (activeClip.svgContent) {
      // Avoid unnecessary state updates by checking against displaySvgContent
      // This is crucial because displaySvgContent includes the combined sources
      if (displaySvgContent !== activeClip.svgContent) {
        // Don't show loading for content we already have cached - this is a client-side operation
        console.log(`[Animation] Using cached SVG content for clip ${activeClip.id} (${activeClip.svgContent.length} bytes)`);

        // We'll use a timeout to ensure we're not setting state too rapidly
        // This prevents React from batching multiple state updates that could cause flicker
        setTimeout(() => {
          // Mark that we're actively updating this clip to prevent stale renders
          clipChangePendingRef.current = true;

          setSvgContent(activeClip.svgContent);

          // Clear the clip change pending flag once we've settled
          setTimeout(() => {
            clipChangePendingRef.current = false;
          }, 50);
        }, 10);
      }
    } else if (activeClip.animationId) {
      // If no SVG content but we have an animation ID, fetch it from server
      clipChangePendingRef.current = true;

      // Add detailed logging about this animation loading attempt
      const loadAttemptTime = new Date().toISOString();
      console.log(`[Animation Loading] Attempt at ${loadAttemptTime} for clip:`, {
        clipId: activeClip.id,
        animationId: activeClip.animationId,
        name: activeClip.name,
        createdAt: activeClip.createdAt,
        timeSinceCreated: activeClip.createdAt ?
          `${Math.round((new Date().getTime() - new Date(activeClip.createdAt).getTime()) / 1000)}s` : 'unknown',
        order: activeClip.order
      });

      // First mark this animation as loading to prevent duplicate loads
      markLoadingInProgress(activeClip.animationId);

      // Check if this animation has been loaded before (should now return true since we marked it as loading)
      const alreadyLoaded = hasBeenLoaded(activeClip.animationId);

      // Always hide empty state and mark message as sent for active clips
      setShowEmptyState(false);
      setHasMessageBeenSent(true);

      // Only show loading animation for animations never loaded before
      if (!alreadyLoaded) {
        // Show loading animation for first-time loads only
        console.log(`[Animation] Animation ${activeClip.animationId} not loaded before, showing loading animation`);
        // Let the loadAnimation function handle the loading state
      } else {
        console.log(`[Animation] Animation ${activeClip.animationId} already loaded or loading, skipping loading animation`);
        // Don't show loading animation
      }

      // Use our custom hook to load the animation
      loadAnimation(activeClip.animationId || null)
        .then(success => {
          if (success) {
            // If we successfully loaded the animation, update the clip in the storyboard
            updateClip(activeClip.id, { svgContent: contextSvgContent || '' });
          }
        })
        .finally(() => {
          // Clear the pending flag after a delay
          setTimeout(() => {
            clipChangePendingRef.current = false;
          }, 300);
        });

    } else {
      // Neither SVG content nor animation ID available
      console.log(`[RESUME_DEBUG] No content for clip - ActiveClipId: ${activeClipId}, HasAnimationId: ${Boolean(activeClip?.animationId)}, HasSvgContent: ${Boolean(activeClip?.svgContent)}, IsMobile: ${/Mobi|Android/i.test(navigator.userAgent)}, Timestamp: ${new Date().toISOString()}`);

      // Only set placeholder if we don't have an animationId - otherwise try loading content
      if (activeClip?.animationId) {
        console.log(`[RESUME_DEBUG] Animation ID exists but no content, attempting immediate load: ${activeClip.animationId}`);

        // Start loading in the background
        loadAnimation(activeClip.animationId).then(success => {
          if (success) {
            updateClip(activeClip.id, { svgContent: contextSvgContent || '' });
          }
        });

        // Show loading placeholder instead of error
        setSvgContent(createPlaceholderSvg('Loading animation content...'));
      } else {
        // No animation ID available
        setSvgContent(createPlaceholderSvg('No animation content available'));
      }
    }
  }, [activeClipId, getActiveClip, updateClip, propSvgContent, contextSvgContent, displaySvgContent, setSvgContent, hasBeenLoaded, markLoadingInProgress]);

  // Helper to load animation with caching
  const loadAnimation = useCallback(async (animationId: string | null): Promise<boolean> => {
    if (!animationId) {
      console.log('[Animation] No animation ID provided for loading');
      return false;
    }

    // Check if we've already loaded this animation before
    const alreadyLoaded = hasBeenLoaded(animationId);

    if (alreadyLoaded) {
      console.log(`[Animation] Animation ${animationId} was previously loaded or is loading, skipping duplicate load`);
      // Still make the API call but don't show loading animation
      try {
        const animation = await MovieStorageApi.getClipAnimation(animationId);
        if (animation && animation.svg) {
          console.log(`[Animation] Successfully loaded cached animation: ${animationId}`);
          setSvgContent(animation.svg);
          return true;
        }
      } catch (error) {
        console.error(`[Animation] Error loading cached animation: ${animationId}`, error);
      }
      return false;
    }

    // Mark this animation as in progress to prevent duplicate loading attempts
    markLoadingInProgress(animationId);

    // Show loading animation for new animations only
    console.log(`[Animation] Loading animation from server: ${animationId}`);
    startLoading(true);

    try {
      const animation = await MovieStorageApi.getClipAnimation(animationId);
      if (animation && animation.svg) {
        console.log(`[Animation] Successfully loaded animation: ${animationId}`);
        setSvgContent(animation.svg);

        // Track this animation as loaded for future reference
        trackLoadedAnimation(animationId);

        return true;
      } else {
        console.error(`[Animation] Failed to load animation: ${animationId} - No SVG content returned`);
        return false;
      }
    } catch (error) {
      console.error(`[Animation] Error loading animation: ${animationId}`, error);
      return false;
    } finally {
      // Hide loading animation with a small delay
      endLoading();
    }
  }, [setSvgContent, startLoading, endLoading, trackLoadedAnimation, markLoadingInProgress, hasBeenLoaded]);

  // Memoize the function to handle SVG element setup to avoid recreating it on every render
  const setupSvgElement = useCallback((svgElement: SVGSVGElement) => {
    // Only update reference if it's a different element
    if (svgElement !== currentSvgRef.current) {
      currentSvgRef.current = svgElement;

      // Force a small delay to ensure the SVG is fully loaded in the DOM
      // This helps ensure animations can be properly paused/resumed
      setTimeout(() => {
        setSvgRef(svgElement);
      }, 50);
    }

    // Get container dimensions (or use defaults if container not available)
    const containerWidth = containerRef.current?.clientWidth || 800;
    const containerHeight = containerRef.current?.clientHeight || 450;

    // Ensure SVG has a viewBox if missing
    if (!svgElement.getAttribute('viewBox')) {
      // Default to 16:9 aspect ratio if no viewBox exists
      const width = 800;
      const height = 450;
      svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    // Set width to 100% to use available space
    svgElement.setAttribute('width', '100%');

    // Calculate height based on viewBox aspect ratio
    const viewBox = svgElement.getAttribute('viewBox');
    if (viewBox) {
      const [, , vbWidth, vbHeight] = viewBox.split(' ').map(parseFloat);
      const aspectRatio = vbWidth / vbHeight;

      // Set appropriate preserveAspectRatio to ensure proper centering
      svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    }

    // Ensure SVG doesn't overflow container
    svgElement.style.maxWidth = '100%';
    svgElement.style.maxHeight = '100%';
    svgElement.style.display = 'block';
    svgElement.style.margin = '0 auto';
    svgElement.style.boxSizing = 'border-box';
  }, [setSvgRef]);

  // Debounce SVG updates to prevent rapid re-renders
  const debouncedUpdateRef = useRef<number | null>(null);

  // Function to handle animation updates with debouncing
  const handleAnimationUpdated = (event: Event) => {
    const customEvent = event as CustomEvent;

    // Skip update if either container ref is not initialized or we have no content
    if (!svgContainerRef.current || !displaySvgContent) {
      return;
    }

    // Clear any pending update
    if (debouncedUpdateRef.current) {
      window.clearTimeout(debouncedUpdateRef.current);
    }

    // Debounce the update to prevent multiple rapid re-renders
    debouncedUpdateRef.current = window.setTimeout(() => {
      if (displaySvgContent && svgContainerRef.current) {
        // Only update if different from current content
        const currentContent = svgContainerRef.current.innerHTML;
        if (currentContent !== displaySvgContent) {
          // Set the HTML directly
          svgContainerRef.current.innerHTML = displaySvgContent;
          // Find the SVG element and set it up
          const newSvgElement = svgContainerRef.current.querySelector('svg');
          if (newSvgElement) {
            setupSvgElement(newSvgElement as SVGSVGElement);
            setShowEmptyState(false);
          }
        }
      }
      debouncedUpdateRef.current = null;
    }, 150); // Increase debounce time to coalesce events better
  };

  // Update SVG content and handle references
  useEffect(() => {
    // Skip if we have no container to update
    if (!svgContainerRef.current) {
      return;
    }

    // Clear any pending update
    if (debouncedUpdateRef.current) {
      window.clearTimeout(debouncedUpdateRef.current);
      debouncedUpdateRef.current = null;
    }

    // Check if we have SVG content to display and we're not in the middle of a clip change
    if (displaySvgContent) {
      // Only update if different from current content to prevent unnecessary re-renders
      const currentContent = svgContainerRef.current.innerHTML;

      if (currentContent !== displaySvgContent) {
        // Skip rendering old content when we know we're in the middle of a clip change
        if (clipChangePendingRef.current && activeClipId !== lastDepsRef.current.activeClipId) {
          return;
        }

        // Clear container first to ensure a clean update
        svgContainerRef.current.innerHTML = '';

        // Set new content after a delay to reduce flickering
        const delay = window.innerWidth < 768 ? 100 : 10;

        debouncedUpdateRef.current = window.setTimeout(() => {
          if (svgContainerRef.current) {
            svgContainerRef.current.innerHTML = displaySvgContent;

            // Find the SVG element in the container
            const svgElement = svgContainerRef.current.querySelector('svg');
            if (svgElement) {
              setupSvgElement(svgElement as SVGSVGElement);

              // Hide empty state
              setShowEmptyState(false);

              // Dispatch a "confirmation" event that the SVG is now visible
              window.dispatchEvent(new CustomEvent('svg-displayed', {
                detail: { timestamp: Date.now() }
              }));
            } else {
              // No SVG element found, show the empty state if no message has been sent
              setShowEmptyState(!hasMessageBeenSent);
            }
          }
          debouncedUpdateRef.current = null;
        }, delay);
      } else {
        // Content is the same, just make sure empty state is hidden
        setShowEmptyState(false);
      }
    } else {
      // No SVG content, show the empty state only if no message has been sent
      setShowEmptyState(!hasMessageBeenSent || !isLoading);

      // Clear the SVG container if it exists
      if (svgContainerRef.current) {
        svgContainerRef.current.innerHTML = '';
      }

      // Clear reference when there's no content
      if (currentSvgRef.current) {
        currentSvgRef.current = null;
        setSvgRef(null);
      }
    }

    // Cleanup function to clear any pending updates
    return () => {
      if (debouncedUpdateRef.current) {
        window.clearTimeout(debouncedUpdateRef.current);
        debouncedUpdateRef.current = null;
      }
    };
  }, [displaySvgContent, setupSvgElement, hasMessageBeenSent, isLoading]);

  // Monitor API calls to show loading state appropriately
  useEffect(() => {
    const handleApiCallStart = (event: any) => {
      const eventData = event?.detail || {};
      const { type, endpoint, animationId } = eventData;

      // Only show loading for animation-related API calls
      const isAnimationCall =
        endpoint?.includes('/animations/') ||
        endpoint?.includes('/clips/') ||
        type?.includes('animation');

      if (isAnimationCall) {
        // Check if the animation has been loaded before
        const skipLoading = animationId && hasBeenLoaded(animationId);

        if (skipLoading) {
          console.log(`[Loading] Animation API call started for ${animationId}, but already loaded or loading - not showing loading animation`);
        } else if (animationId) {
          // Mark this animation as loading to prevent duplicates
          markLoadingInProgress(animationId);
          console.log('[Loading] Animation API call started, showing loading animation');
          startLoading(true);
        } else {
          console.log('[Loading] Animation API call started, showing loading animation');
          startLoading(true);
        }
        setHasMessageBeenSent(true);
        setShowEmptyState(false);
      } else {
        console.log('[Loading] Non-animation API call, not showing loading animation');
      }
    };

    const handleApiCallEnd = (event: any) => {
      const eventData = event?.detail || {};
      const { type, endpoint, animationId } = eventData;

      // Only handle loading state for animation-related API calls
      const isAnimationCall =
        endpoint?.includes('/animations/') ||
        endpoint?.includes('/clips/') ||
        type?.includes('animation');

      if (isAnimationCall) {
        console.log('[Loading] Animation API call ended, hiding loading animation');
        if (animationId) {
          trackLoadedAnimation(animationId);
        }
        endLoading();
      }
    };

    window.addEventListener('api-call-start', handleApiCallStart);
    window.addEventListener('api-call-end', handleApiCallEnd);

    return () => {
      window.removeEventListener('api-call-start', handleApiCallStart);
      window.removeEventListener('api-call-end', handleApiCallEnd);
    };
  }, [startLoading, endLoading, setHasMessageBeenSent, setShowEmptyState, hasBeenLoaded, trackLoadedAnimation, markLoadingInProgress]);

  // Only listen for animation updates
  useEffect(() => {
    // Add event listener for animation updates
    window.addEventListener('animation-updated', handleAnimationUpdated);

    return () => {
      // Remove event listener on cleanup
      window.removeEventListener('animation-updated', handleAnimationUpdated);
    };
  }, [displaySvgContent, setupSvgElement]);

  // Adjust SVG to container size when container dimensions change
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && displaySvgContent) {
        const svgElement = getSvgContainer()?.querySelector('svg');
        if (svgElement) {
          // Get container dimensions
          const containerWidth = containerRef.current.clientWidth;
          const containerHeight = containerRef.current.clientHeight;

          // Get the original viewBox values
          const viewBox = svgElement.getAttribute('viewBox');
          if (viewBox) {
            const [, , vbWidth, vbHeight] = viewBox.split(' ').map(parseFloat);

            // Calculate aspect ratios
            const svgRatio = vbWidth / vbHeight;
            const containerRatio = containerWidth / containerHeight;

            // Determine the best fit approach based on container ratio
            if (containerRatio > svgRatio) {
              // Container is wider than SVG - fit to height
              svgElement.setAttribute('height', `${containerHeight}px`);
              svgElement.setAttribute('width', `${containerHeight * svgRatio}px`);
            } else {
              // Container is taller than SVG - fit to width
              svgElement.setAttribute('width', `${containerWidth}px`);
              svgElement.setAttribute('height', `${containerWidth / svgRatio}px`);
            }

            // Ensure the SVG is centered in the container
            svgElement.style.display = 'block';
            svgElement.style.margin = '0 auto';

            // Use relative positioning for better reliability
            svgElement.style.position = 'relative';
          } else {
            // Create a default viewBox if none exists
            const defaultWidth = 800;
            const defaultHeight = 450; // 16:9 aspect ratio
            svgElement.setAttribute('viewBox', `0 0 ${defaultWidth} ${defaultHeight}`);
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // Then call handleResize again to apply proper sizing
            setTimeout(handleResize, 10);
          }
        }
      }
    };

    // Set initial size
    handleResize();

    // Add resize listener
    window.addEventListener('resize', handleResize);

    // Clean up
    return () => {
      window.removeEventListener('resize', handleResize);
    };
  }, [displaySvgContent, getSvgContainer]);

  // Handle prefetching animation when a clip is selected
  const prefetchClipAnimation = useCallback((clip: MovieClip) => {
    if (!clip || !clip.animationId) {
      console.log('[Clip Change] No animation ID available for this clip');
      return;
    }

    console.log(`[Clip Change] Will prefetch animation for clip ${clip.id} with animationId ${clip.animationId}`);

    // No need to show loading state for client-side clip changes
    // The clip change effect will handle loading if needed
    // (Only actual API calls will show loading animation)
  }, []);

  // Monitor for clip change events (only for prefetching)
  useEffect(() => {
    const handleClipChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { clipId } = customEvent.detail;

      // This handler only handles prefetching, not displaying content
      if (clipId) {
        prefetchClipAnimation(clipId);
      }
    };

    // Add event listener for clip changes
    window.addEventListener('clip-changed', handleClipChanged);

    return () => {
      window.removeEventListener('clip-changed', handleClipChanged);
    };
  }, [prefetchClipAnimation]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      const container = getSvgContainer();
      if (container) {
        container.innerHTML = '';
      }

      // Clear reference on unmount
      if (currentSvgRef.current) {
        currentSvgRef.current = null;
        setSvgRef(null);
      }
    };
  }, [setSvgRef, getSvgContainer]);

  // Add support for forcing a refresh of the animation content
  const handleForceRefresh = useCallback(() => {
    console.log(`[Refresh] Animation refresh requested at ${new Date().toISOString()}`);

    // Get the active clip
    const activeClip = getActiveClip();

    if (activeClip) {
      console.log(`[Refresh] Refreshing animation for clip ${activeClip.id}`);

      // If we have animationId but content is missing, fetch it
      if (activeClip.animationId && (!activeClip.svgContent || !displaySvgContent)) {
        console.log(`[Refresh] Fetching animation from server for clip ${activeClip.id}`);

        // Use our custom hook to load the animation
        loadAnimation(activeClip.animationId).then(success => {
          if (success) {
            // If loading was successful, update the clip with the new content
            updateClip(activeClip.id, { svgContent: contextSvgContent || '' });
          }
        });
      }
      // If we already have SVG content, just make sure it's displayed
      else if (activeClip.svgContent) {
        console.log(`[Refresh] Using existing SVG content: ${activeClip.svgContent.length} bytes`);
        setSvgContent(activeClip.svgContent);
      }
    }
  }, [displaySvgContent, getActiveClip, updateClip, setSvgContent, loadAnimation, contextSvgContent]);

  // Register event listener for legacy DOM-based refreshes
  useEffect(() => {
    window.addEventListener('force-refresh-animation', handleForceRefresh);
    return () => {
      window.removeEventListener('force-refresh-animation', handleForceRefresh);
    };
  }, [handleForceRefresh]);

  // Add an event listener to handle page visibility changes for resuming content
  useEffect(() => {
    // Handle page visibility changes to resume content
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'visible') {
        console.log(`[Visibility] Page became visible at ${new Date().toISOString()}`);

        // Check if we have an active clip that needs content restored
        const activeClip = getActiveClip();
        const isMobile = /Mobi|Android/i.test(navigator.userAgent);

        // On mobile, proactively load all animations when returning to the page
        if (isMobile && currentStoryboard?.clips?.length > 0) {
          console.log(`[Visibility] Mobile device detected, proactively loading all clip animations`);

          // Load all clips with animationId but missing SVG content
          currentStoryboard.clips.forEach(clip => {
            if (clip.animationId && (!clip.svgContent || clip.svgContent.length < 100)) {
              console.log(`[Visibility] Prefetching animation for clip ${clip.id}, animationId: ${clip.animationId}`);

              // Fetch the animation content
              MovieStorageApi.getClipAnimation(clip.animationId)
                .then(animation => {
                  if (animation && animation.svg) {
                    // Update the clip with the SVG content
                    updateClip(clip.id, { svgContent: animation.svg });
                    console.log(`[Visibility] Successfully loaded animation for clip ${clip.id}`);
                  }
                })
                .catch(err => console.error(`[Visibility] Error loading animation for clip ${clip.id}:`, err));
            }
          });
        }

        if (activeClip) {
          // If we have a clip with animation ID but missing content, fetch it
          if (activeClip.animationId && (!activeClip.svgContent || !displaySvgContent)) {
            console.log(`[Visibility] Fetching missing animation for clip ${activeClip.id}`);
            handleForceRefresh();
          }
          // If we have SVG content but empty container, restore it
          else if (activeClip.svgContent && svgContainerRef.current) {
            const containerIsEmpty = !svgContainerRef.current.innerHTML ||
                                   svgContainerRef.current.innerHTML.length < 50;

            if (containerIsEmpty) {
              console.log(`[Visibility] Restoring SVG content for clip ${activeClip.id}`);
              svgContainerRef.current.innerHTML = activeClip.svgContent;

              // Set up the SVG element
              const svgElement = svgContainerRef.current.querySelector('svg');
              if (svgElement) {
                setupSvgElement(svgElement as SVGSVGElement);
                setShowEmptyState(false);
              }
            }
          }
        }
      }
    };

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [getActiveClip, setupSvgElement, displaySvgContent, handleForceRefresh, currentStoryboard, updateClip]);

  // Add an event listener for thumbnail updates
  useEffect(() => {
    // Function to handle when thumbnails are loaded
    const handleThumbnailLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const { clipId } = customEvent.detail;

      // Only refresh for the active clip
      if (clipId && clipId === activeClipId) {
        console.log(`[Thumbnail] Refreshing display for newly loaded thumbnail: ${clipId}`);

        // Get the clip and update if we have fresh content
        const clip = getActiveClip();
        if (clip && clip.svgContent) {
          setSvgContent(clip.svgContent);
        }
      }
    };

    // Register the event listener
    window.addEventListener('thumbnail-loaded', handleThumbnailLoaded);

    // Clean up
    return () => {
      window.removeEventListener('thumbnail-loaded', handleThumbnailLoaded);
    };
  }, [activeClipId, getActiveClip, setSvgContent]);

  // Force a resize whenever the container dimensions change
  useEffect(() => {
    // Create a ResizeObserver to detect container size changes
    if (typeof ResizeObserver !== 'undefined' && containerRef.current) {
      const resizeObserver = new ResizeObserver(() => {
        // Get container dimensions
        if (containerRef.current && displaySvgContent) {
          const containerWidth = containerRef.current.clientWidth;
          const containerHeight = containerRef.current.clientHeight;

          console.log(`[Layout] Container size changed: ${containerWidth}x${containerHeight}`);

          // Trigger resize of SVG content
          const svgElement = getSvgContainer()?.querySelector('svg');
          if (svgElement) {
            // Ensure preserveAspectRatio is set
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // Force SVG to use available space
            svgElement.setAttribute('width', '100%');
            svgElement.setAttribute('height', '100%');
          }
        }
      });

      // Start observing the container
      resizeObserver.observe(containerRef.current);

      // Clean up
      return () => {
        resizeObserver.disconnect();
      };
    }

    // Fallback for browsers without ResizeObserver
    return undefined;
  }, [displaySvgContent, getSvgContainer]);

  // Main render function with improved responsive sizing
  return (
    <div
      ref={containerRef}
      className="w-full h-full max-w-full max-h-full flex items-center justify-center bg-gotham-black/30 rounded-lg relative"
      style={{
        ...style,
        minWidth: '280px',
        minHeight: '157px',
      }}
    >
      {/* Empty state or loading overlay - ensure it's visible when loading */}
      <div
        className={`absolute inset-0 flex items-center justify-center transition-opacity duration-500 ${
          showEmptyState || isLoading ? 'opacity-100 z-10' : 'opacity-0 pointer-events-none'
        }`}
      >
        <EmptyState loading={isLoading} />
      </div>

      {/* SVG container with automatic centering - fade out when loading */}
      <div
        ref={svgContainerRef}
        data-testid="svg-container"
        className={`w-full h-full overflow-hidden flex items-center justify-center transition-opacity duration-300 ${
          isLoading ? 'opacity-40' : showEmptyState ? 'opacity-0' : 'opacity-100'
        }`}
      />
    </div>
  );
};

export default AnimationCanvas;
