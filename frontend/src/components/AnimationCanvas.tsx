import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAnimation, useSvgRef } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import { MovieClip, Storyboard } from '../contexts/MovieContext';
import EmptyState from './EmptyState';
import { AnimationApi, MovieStorageApi } from '../services/api';
import useAnimationLoader, { AnimationRegistryHelpers } from '../hooks/useAnimationLoader';

// Add type for API response
interface MovieResponse {
  success: boolean;
  movie?: Storyboard;
}

interface AnimationResponse {
  id: string;
  svg: string;
  timestamp?: string;
  chatHistory?: any[];
}

interface AnimationCanvasProps {
  svgContent?: string;
  style?: React.CSSProperties;
  isAnimationEditor?: boolean;
}

const AnimationCanvas: React.FC<AnimationCanvasProps> = ({
  svgContent: propSvgContent,
  style,
  isAnimationEditor = false
}) => {
  const { svgContent: contextSvgContent, setSvgContent } = useAnimation();
  const { currentStoryboard, activeClipId, getActiveClip, updateClip, setCurrentStoryboard } = useMovie();
  const setSvgRef = useSvgRef();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const currentSvgRef = useRef<SVGSVGElement | null>(null);

  // Add render counter to track excessive renders
  const renderCountRef = useRef(0);
  // Use a state variable to track whether we're showing the empty state or the SVG
  const [showEmptyState, setShowEmptyState] = useState(!isAnimationEditor);
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

  // Initialize animation loader hooks
  const {
    isLoading,
    startLoading,
    endLoading,
    trackLoadedAnimation,
    markLoadingInProgress,
    hasBeenLoaded,
    clearLoadingCache,
    getCachedContent
  } = useAnimationLoader(setSvgContent, createPlaceholderSvg);

  // Add a reference to track if clip change is pending
  const clipChangePendingRef = useRef(false);

  // Get the current active clip's SVG content
  const activeClipSvgContent = activeClipId ? getActiveClip()?.svgContent : null;
  const lastValidContentRef = useRef<string>('');

  // Create a function to check if we should display empty state
  const displayEmptyState = useMemo(() => {
    // Only show empty state if there's no SVG content and no active clip
    const noActiveClip = !activeClipId || !getActiveClip();
    const noSvgContent = !propSvgContent && !contextSvgContent && !activeClipSvgContent;

    // If we have SVG content from any source, do not show empty state
    if (propSvgContent || contextSvgContent || activeClipSvgContent) {
      return false;
    }

    return noActiveClip && noSvgContent;
  }, [activeClipId, getActiveClip, propSvgContent, contextSvgContent, activeClipSvgContent]);

  // Determine the SVG content to display based on priority:
  // 1. Props (highest priority)
  // 2. Context (medium priority)
  // 3. Active clip SVG content (lowest priority)
  const displaySvgContent = useMemo(() => {
    // Check if we're displaying placeholder content
    if (showEmptyState && displayEmptyState) {
      return null;
    }

    // Priority 1: Content from props overrides everything
    if (propSvgContent) {
      return propSvgContent;
    }

    // Priority 2: Content from context (second priority)
    if (contextSvgContent) {
      return contextSvgContent;
    }

    // Priority 3: Content from the active clip (lowest priority)
    if (activeClipSvgContent) {
      return activeClipSvgContent;
    }

    // No content available
    return null;
  }, [propSvgContent, contextSvgContent, activeClipSvgContent, showEmptyState, displayEmptyState]);

  // Helper function to get the SVG container
  const getSvgContainer = useCallback(() => {
    return svgContainerRef.current;
  }, [svgContainerRef]);

  // Add support for forcing a refresh of the animation content
  const handleForceRefresh = useCallback(() => {
    console.log(`[Refresh] Animation refresh requested at ${new Date().toISOString()}`);

    // Get the active clip
    const activeClip = getActiveClip();
    if (!activeClip) {
      console.log(`[Refresh] No active clip to refresh`);
      return;
    }

    console.log(`[Refresh] Processing refresh for clip ${activeClip.id}`);

    // If we already have valid SVG content, use it instead of reloading
    if (activeClip.svgContent && activeClip.svgContent.length > 100) {
      console.log(`[Refresh] Using existing SVG content: ${activeClip.svgContent.length} bytes`);
      setSvgContent(activeClip.svgContent);
      setShowEmptyState(false);
      return;
    }

    // If we have an animation ID but no content, fetch it
    if (activeClip.animationId) {
      console.log(`[Refresh] Fetching animation from server for clip ${activeClip.id}`);

      // Clear the cache entry to force a fresh load
      clearLoadingCache(activeClip.animationId || '');

      // Show loading state
      setSvgContent(createPlaceholderSvg('Loading animation content...'));
      startLoading(true);
      markLoadingInProgress(activeClip.animationId || '');

      // Fetch animation directly using the API
      MovieStorageApi.getClipAnimation(activeClip.animationId)
        .then(animation => {
          if (animation && animation.svg) {
            console.log(`[Refresh] Successfully loaded animation: ${activeClip.animationId}, ${animation.svg.length} bytes`);
            setSvgContent(animation.svg);
            setShowEmptyState(false);
            updateClip(activeClip.id, { svgContent: animation.svg });

            // Store in global cache with content
            trackLoadedAnimation(activeClip.animationId || '', animation.svg);

            endLoading();
          } else {
            console.warn(`[Refresh] Animation loaded but SVG content is missing: ${activeClip.animationId}`);
            setSvgContent(createPlaceholderSvg('Animation content is unavailable. Try again.'));

            // Track the failed attempt
            trackLoadedAnimation(activeClip.animationId || '');

            endLoading();
          }
        })
        .catch(error => {
          console.error(`[Refresh] Error loading animation ${activeClip.animationId}: ${error.message}`);
          setSvgContent(createPlaceholderSvg(`Failed to load animation: ${error.message}`));

          // Track the failed attempt
          trackLoadedAnimation(activeClip.animationId || '');

          endLoading();
        });
      } else {
      console.log(`[Refresh] No animation ID available for clip ${activeClip.id}`);
      setSvgContent(createPlaceholderSvg('No animation ID available for this clip'));
    }
  }, [getActiveClip, updateClip, setSvgContent, clearLoadingCache, startLoading,
      markLoadingInProgress, trackLoadedAnimation, endLoading, createPlaceholderSvg]);

  // Main effect to update SVG content when clip changes
  useEffect(() => {
    // Increment the render counter
    renderCountRef.current += 1;

    // Skip excessive rerenders when clicking quickly through clips
    if (renderCountRef.current % 5 === 0) {
      console.log(`[AnimationCanvas] useEffect calls per activeClipId: ${renderCountRef.current}`);
    }

    // Get the active clip for this render cycle
    const activeClip = getActiveClip();

    // If no active clip is available, show a placeholder only in movie editor context
    if (!activeClip) {
      console.log('[AnimationCanvas] No active clip available');

      // Don't show the "Select a clip" placeholder in the animation editor
      if (!isAnimationEditor) {
        setSvgContent(createPlaceholderSvg('Select a clip to view animation'));
      }
      return;
    }

    // Skip unnecessary processing - just log every 3rd render for the same clip
    if (renderCountRef.current % 3 === 0) {
      console.log(`[AnimationCanvas] Processing clip: ${activeClip.id}, has SVG: ${!!activeClip.svgContent}, has animationId: ${!!activeClip.animationId}`);
    }

    // If we have SVG content in the clip, use it and avoid server call
    if (activeClip.svgContent && activeClip.svgContent.length > 100) {
      setSvgContent(activeClip.svgContent);
      setShowEmptyState(false);

      // Also add to cache so other components can use it
      if (activeClip.animationId) {
        trackLoadedAnimation(activeClip.animationId || '', activeClip.svgContent);
      }

      return; // Explicit return to avoid further processing
    }

    // If no SVG content but we have an animationId, check cache first then try server
    if (activeClip.animationId) {
      const animationId = activeClip.animationId;

      // First check our global cache for the content
      const cachedContent = getCachedContent(animationId);
      if (cachedContent) {
        setSvgContent(cachedContent);
        setShowEmptyState(false);
        updateClip(activeClip.id, { svgContent: cachedContent });
        return;
      }

      // Check if we've already loaded or attempted to load this animation recently
      if (hasBeenLoaded(animationId)) {
        const animationFromRegistry = AnimationRegistryHelpers.getAnimation(animationId);
        if (animationFromRegistry.status === 'available' && animationFromRegistry.svg) {
          console.log(`[AnimationCanvas] Using previously loaded animation from registry: ${animationId}`);
          setSvgContent(animationFromRegistry.svg);
          setShowEmptyState(false);
          updateClip(activeClip.id, { svgContent: animationFromRegistry.svg });
        } else if (animationFromRegistry.status === 'failed') {
          console.log(`[AnimationCanvas] Previously failed to load animation: ${animationId}`);
          setSvgContent(createPlaceholderSvg('Failed to load animation. Try the refresh button.'));
        }
        return; // Skip loading if we've already tried recently
      }

      console.log(`[AnimationCanvas] Need to load animation from server: ${animationId}`);

      // Show loading indicator
      setSvgContent(createPlaceholderSvg('Loading animation content...'));
    startLoading(true);
      markLoadingInProgress(animationId);

      MovieStorageApi.getClipAnimation(animationId)
        .then((response: AnimationResponse | null) => {
          if (!response) {
            console.warn(`[AnimationCanvas] Received null response for animation ${animationId}`);
            return;
          }

          if (response.svg) {
            console.log(`[AnimationCanvas] Successfully loaded animation ${animationId}: ${response.svg.length} bytes`);
            setSvgContent(response.svg);
            setShowEmptyState(false);
            updateClip(activeClip.id, { svgContent: response.svg });

            // Track in the global cache so other components can use it too
            trackLoadedAnimation(animationId || '', response.svg);
          } else {
            console.warn(`[AnimationCanvas] Animation loaded but SVG content is missing: ${animationId}`);
            setSvgContent(createPlaceholderSvg('Animation content unavailable. Try the refresh button.'));

            // Track the failed load attempt in cache to prevent repeated failures
            trackLoadedAnimation(animationId || '');
          }
          endLoading();
        })
        .catch(error => {
          console.error(`[AnimationCanvas] Error loading animation ${animationId}: ${error.message}`);
          setSvgContent(createPlaceholderSvg(`Failed to load animation: ${error.message}`));

          // Track the failed load attempt
          trackLoadedAnimation(animationId || '');

          endLoading();
        });
    } else {
      // No animation ID available
      console.log(`[AnimationCanvas] No animation ID available for clip ${activeClip.id}`);
      setSvgContent(createPlaceholderSvg('No animation ID available for this clip'));
    }
  }, [activeClipId, getActiveClip, updateClip, setSvgContent, createPlaceholderSvg, startLoading, endLoading,
     markLoadingInProgress, trackLoadedAnimation, getCachedContent, hasBeenLoaded]);

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

  // Update SVG content and handle references - reduce frequency of updates
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
        if (clipChangePendingRef.current && activeClipId !== lastValidContentRef.current) {
          return;
        }

        // When rapidly clicking through clips, increase debounce time to prevent excessive updates
        const isRapidClicking = renderCountRef.current > 3 && renderCountRef.current % 3 === 0;
        const delay = isRapidClicking ? 300 : (window.innerWidth < 768 ? 100 : 10);

        debouncedUpdateRef.current = window.setTimeout(() => {
          if (svgContainerRef.current) {
            // Only update if the content has actually changed
            if (svgContainerRef.current.innerHTML !== displaySvgContent) {
            svgContainerRef.current.innerHTML = displaySvgContent;

            // Find the SVG element in the container
            const svgElement = svgContainerRef.current.querySelector('svg');
            if (svgElement) {
              setupSvgElement(svgElement as SVGSVGElement);
              setShowEmptyState(false);
            } else {
              // No SVG element found, show the empty state if no message has been sent
              setShowEmptyState(!hasMessageBeenSent);
              }
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
  }, [displaySvgContent, setupSvgElement, hasMessageBeenSent, isLoading, activeClipId]);

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
      const { type, endpoint, animationId, success = true } = eventData;

      // Only handle loading state for animation-related API calls
      const isAnimationCall =
        endpoint?.includes('/animations/') ||
        endpoint?.includes('/clips/') ||
        type?.includes('animation');

      if (isAnimationCall) {
        console.log('[Loading] Animation API call ended, hiding loading animation');
        if (animationId) {
          trackLoadedAnimation(animationId || '');
        }
        endLoading();

        // If the API call was successful, make sure we hide the empty state
        if (success && displaySvgContent) {
          setShowEmptyState(false);
        }
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
            // Get the original viewBox values
            const viewBox = svgElement.getAttribute('viewBox');
            if (viewBox) {
              const [, , vbWidth, vbHeight] = viewBox.split(' ').map(parseFloat);

              // Calculate aspect ratios
              const svgRatio = vbWidth / vbHeight;
              const containerRatio = containerWidth / containerHeight;

              // Different behavior based on whether we're in the animation editor or movie editor
              if (isAnimationEditor) {
                // In Animation Editor - allow more height usage
                svgElement.setAttribute('width', '100%');
                svgElement.setAttribute('height', '100%');
                svgElement.style.maxWidth = '100%';
                // Don't constrain max-height to allow vertical filling
                svgElement.style.maxHeight = 'none';
              } else {
                // In Movie Editor - ensure it fits completely in the container
                if (containerRatio > svgRatio) {
                  // Container is wider than SVG - fit to height
                  const height = containerHeight;
                  const width = height * svgRatio;
                  svgElement.setAttribute('width', `${width}px`);
                  svgElement.setAttribute('height', `${height}px`);
                } else {
                  // Container is taller than SVG - fit to width
                  const width = containerWidth;
                  const height = width / svgRatio;
                  svgElement.setAttribute('width', `${width}px`);
                  svgElement.setAttribute('height', `${height}px`);
                }

                // Ensure SVG doesn't overflow container
                svgElement.style.maxWidth = '100%';
                svgElement.style.maxHeight = '100%';
              }
            } else {
              // If no viewBox, set a default one and use preserveAspectRatio
              svgElement.setAttribute('viewBox', '0 0 800 600');
              svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            }

            // Common styling for both modes
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');
            svgElement.style.display = 'block';
            svgElement.style.margin = '0 auto';
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
  }, [displaySvgContent, getSvgContainer, isAnimationEditor]);

  // Handle prefetching animation when a clip is selected
  const prefetchClipAnimation = useCallback((clipId: string) => {
    if (!clipId) {
      console.log('[Prefetch] No clip ID provided');
      return;
    }

    // Get the clip by ID
    const clip = getActiveClip ?
      (activeClipId === clipId ? getActiveClip() : null) :
      null;

    if (!clip) {
      console.log(`[Prefetch] Unable to find clip data for ID: ${clipId}`);
      return;
    }

    if (!clip.animationId) {
      console.log(`[Prefetch] No animation ID available for clip ${clipId}`);
      return;
    }

    const animationId = clip.animationId;  // Create a non-null local variable
    console.log(`[Prefetch] Starting prefetch for clip ${clip.id} with animationId ${animationId}`);

    // Check if already in registry
    const registryResult = AnimationRegistryHelpers.getAnimation(animationId);
    if (registryResult.status === 'available') {
      console.log(`[Prefetch] Animation ${animationId} already available in registry`);
      return;
    }

    if (registryResult.status === 'loading') {
      console.log(`[Prefetch] Animation ${animationId} already loading`);
      return;
    }

    if (registryResult.status === 'failed') {
      console.log(`[Prefetch] Animation ${animationId} previously failed, trying again`);
    }

    // Actually load the animation
    AnimationRegistryHelpers.markLoading(animationId);

    MovieStorageApi.getClipAnimation(animationId)
      .then((response: AnimationResponse | null) => {
        if (!response) {
          console.warn(`[Prefetch] Received null response for animation ${animationId}`);
          AnimationRegistryHelpers.markFailed(animationId);
          return;
        }

        if (response.svg) {
          // Store in registry
          AnimationRegistryHelpers.storeAnimation(
            animationId,
            response.svg,
            {
              timestamp: response.timestamp,
              chatHistory: response.chatHistory
            }
          );

          // Also update the clip with content
          if (updateClip) {
            updateClip(clip.id, { svgContent: response.svg });
          }

          console.log(`[Prefetch] Successfully loaded animation ${animationId}`);
        } else {
          console.warn(`[Prefetch] Received invalid response for animation ${animationId}`);
          AnimationRegistryHelpers.markFailed(animationId);
        }
      })
      .catch(error => {
        console.error(`[Prefetch] Failed to load animation ${animationId}:`, error);
        AnimationRegistryHelpers.markFailed(animationId);
      });
  }, [getActiveClip, activeClipId, updateClip]);

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
    const handleVisibilityChange = async () => {
      if (document.visibilityState === 'visible') {
        console.log(`[Visibility] Page became visible at ${new Date().toISOString()}`);

        // First check if there's a movie to load - ONLY if we're not in the animation editor
        if (currentStoryboard?.id && !isAnimationEditor) {
          try {
            console.log('[Visibility] Checking movie state from server');
            const response = await MovieStorageApi.getMovie(currentStoryboard.id) as MovieResponse;

            if (response?.success && response.movie) {
              // Update storyboard state if needed
              setCurrentStoryboard(prev => {
                if (JSON.stringify(prev.clips) !== JSON.stringify(response.movie?.clips)) {
                  console.log('[Visibility] Found updated movie state, updating storyboard');
                  // Ensure we always return a valid Storyboard
                  return response.movie as Storyboard;
                }
                return prev;
              });

              // If we have clips but no active content, try to restore the active clip
              const activeClip = getActiveClip();
              if (activeClip && (!svgContainerRef.current?.innerHTML || svgContainerRef.current.innerHTML.length < 100)) {
                if (activeClip.svgContent && activeClip.svgContent.length > 100) {
                  console.log(`[Visibility] Restoring SVG content for clip ${activeClip.id}`);
                  setSvgContent(activeClip.svgContent);
                  setShowEmptyState(false);
                  return;
                } else if (activeClip.animationId) {
                  // Try to load from registry first
                  const registryResult = AnimationRegistryHelpers.getAnimation(activeClip.animationId);
                  if (registryResult.status === 'available' && registryResult.svg) {
                    console.log(`[Visibility] Using registry content for clip ${activeClip.id}`);
                    setSvgContent(registryResult.svg);
                    setShowEmptyState(false);
                    updateClip(activeClip.id, { svgContent: registryResult.svg });
                    return;
                  }

                  // If not in registry and not loading, try to load it
                  if (registryResult.status !== 'loading' && !isLoading) {
                    console.log(`[Visibility] Need to load content for clip ${activeClip.id}`);
                    handleForceRefresh();
                  }
                }
              }
              return;
            }
          } catch (error) {
            console.error('[Visibility] Error checking movie status:', error);
          }
        }

        // Only proceed with empty state handling if we couldn't restore from server
        const activeClip = getActiveClip();
        if (!activeClip) {
          console.log('[Visibility] No active clip to restore');
          return;
        }

        console.log(`[Visibility] Checking active clip ${activeClip.id} for restoration`);
        // Case 1: We have SVG content but container is empty (most common mobile issue)
        if (activeClip.svgContent && activeClip.svgContent.length > 100) {
          const container = getSvgContainer();
          const containerIsEmpty = !container || !container.innerHTML || container.innerHTML.length < 100;

          if (containerIsEmpty) {
            console.log(`[Visibility] Restoring SVG content for clip ${activeClip.id} - container was empty`);
            setSvgContent(activeClip.svgContent);
            setShowEmptyState(false);
            return;
          }
        }

        // Case 2: We have animationId but no SVG content - check registry first
        if (activeClip.animationId && (!activeClip.svgContent || activeClip.svgContent.length < 100)) {
          // First check if it's available in the registry
          const registryResult = AnimationRegistryHelpers.getAnimation(activeClip.animationId);

          if (registryResult.status === 'available' && registryResult.svg) {
            console.log(`[Visibility] Using registry content for clip ${activeClip.id}`);
            setSvgContent(registryResult.svg);
            setShowEmptyState(false);
            updateClip(activeClip.id, { svgContent: registryResult.svg });
            return;
          }

          // If not available and not already loading, try to load it
          if (registryResult.status !== 'loading' && !isLoading) {
            console.log(`[Visibility] Need to load content for clip ${activeClip.id}`);
            handleForceRefresh();
          }
        }
      }
    };

    // Add visibility change listener
    document.addEventListener('visibilitychange', handleVisibilityChange);

    // Also run once when component mounts to handle case where content wasn't properly
    // loaded during initial render (common with quick navigation)
    setTimeout(() => {
      const activeClip = getActiveClip();
      const svgContainer = getSvgContainer();

      if (activeClip && svgContainer && (!svgContainer.innerHTML || svgContainer.innerHTML.length < 100)) {
        console.log('[Mount Check] Running visibility check on mount');
        handleVisibilityChange();
      }
    }, 500);

    // Clean up
    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
    };
  }, [getActiveClip, setSvgContent, updateClip, handleForceRefresh, getSvgContainer, isLoading, currentStoryboard, setCurrentStoryboard]);

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
          setShowEmptyState(false);
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
            // Get the original viewBox values
            const viewBox = svgElement.getAttribute('viewBox');
            if (viewBox) {
              const [, , vbWidth, vbHeight] = viewBox.split(' ').map(parseFloat);

              // Calculate aspect ratios
              const svgRatio = vbWidth / vbHeight;
              const containerRatio = containerWidth / containerHeight;

              // Ensure the SVG fits within the container while maintaining aspect ratio
              if (containerRatio > svgRatio) {
                // Container is wider than SVG - fit to height
                const height = containerHeight;
                const width = height * svgRatio;
                svgElement.setAttribute('width', `${width}px`);
                svgElement.setAttribute('height', `${height}px`);
              } else {
                // Container is taller than SVG - fit to width
                const width = containerWidth;
                const height = width / svgRatio;
                svgElement.setAttribute('width', `${width}px`);
                svgElement.setAttribute('height', `${height}px`);
              }
            } else {
              // If no viewBox, set a default one and use preserveAspectRatio
              svgElement.setAttribute('viewBox', '0 0 800 600');
              svgElement.setAttribute('width', '100%');
              svgElement.setAttribute('height', '100%');
            }

            // Ensure preserveAspectRatio is set correctly
            svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

            // Ensure proper centering
            svgElement.style.display = 'block';
            svgElement.style.margin = '0 auto';
            svgElement.style.maxWidth = '100%';
            svgElement.style.maxHeight = '100%';
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

  // Add a listener for network disconnections to prevent loading spinning forever
  useEffect(() => {
    const handleOffline = () => {
      console.log('[Network] Browser is offline, canceling any in-progress animation loads');
      endLoading();

      // If we have an active clip, try to display placeholder content
      const activeClip = getActiveClip();
      if (activeClip && activeClip.animationId) {
        setSvgContent(createPlaceholderSvg('Network connection lost. Animation cannot be loaded.'));

        // Mark animations as failed in registry
        AnimationRegistryHelpers.markFailed(activeClip.animationId);
      }
    };

    window.addEventListener('offline', handleOffline);

    return () => {
      window.removeEventListener('offline', handleOffline);
    };
  }, [endLoading, getActiveClip, setSvgContent, createPlaceholderSvg]);

  // Monitor for animation loading timeout and cancel if it takes too long
  useEffect(() => {
    // Flag to track if we're in the middle of a load operation
    let loadTimeoutId: number | null = null;

    // Set up timeout when loading starts
    if (isLoading) {
      console.log('[Loading] Setting up animation load timeout (15s)');

      loadTimeoutId = window.setTimeout(() => {
        console.log('[Loading] Animation load timeout reached, canceling');

        // End loading state
        endLoading();

        // Show error message
        const activeClip = getActiveClip();
        if (activeClip && activeClip.animationId) {
          setSvgContent(createPlaceholderSvg('Animation load timed out. Try refreshing.'));

          // Mark as failed in registry
          AnimationRegistryHelpers.markFailed(activeClip.animationId);
        }
      }, 15000); // 15 second timeout
    }

    // Clear timeout when loading ends
    return () => {
      if (loadTimeoutId) {
        clearTimeout(loadTimeoutId);
      }
    };
  }, [isLoading, endLoading, getActiveClip, setSvgContent, createPlaceholderSvg]);

  // Main render function with improved responsive sizing
  return (
    <div
      ref={containerRef}
      className="w-full h-full flex items-center justify-center bg-gotham-black/30 rounded-lg relative overflow-hidden"
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
