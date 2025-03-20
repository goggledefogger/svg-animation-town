import React, { useEffect, useRef, useState, useCallback, useMemo } from 'react';
import { useAnimation, useSvgRef } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import EmptyState from './EmptyState';
import { MovieStorageApi } from '../services/api';

interface AnimationCanvasProps {
  svgContent?: string;
  style?: React.CSSProperties;
}

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

  // Use a state variable to track whether we're showing the empty state or the SVG
  const [showEmptyState, setShowEmptyState] = useState(true);
  // Track loading state from API calls
  const [isLoading, setIsLoading] = useState(false);
  // Track if a message has been sent to hide the empty state
  const [hasMessageBeenSent, setHasMessageBeenSent] = useState(false);

  // Get the current active clip's SVG content
  const activeClipSvgContent = activeClipId ? getActiveClip()?.svgContent : null;

  // Create a more stable display content value that doesn't change unnecessarily
  // We use a ref to store the last valid content to avoid losing it during re-renders
  const lastValidContentRef = useRef<string>('');

  // Determine which SVG content to use with clear priorities and fallbacks
  const displaySvgContent = useMemo(() => {
    // Priority for content source:
    // 1. Explicit prop (highest priority)
    // 2. Active clip's SVG content
    // 3. Context SVG content
    // 4. Last valid content we've seen (in case state temporarily becomes empty)

    let content = '';

    if (propSvgContent) {
      // Props take highest priority
      content = propSvgContent;
      console.log('Using SVG content from props');
    } else if (activeClipSvgContent) {
      // Then active clip
      content = activeClipSvgContent;
      console.log('Using SVG content from active clip');
    } else if (contextSvgContent) {
      // Then global context
      content = contextSvgContent;
      console.log('Using SVG content from animation context');
    } else if (lastValidContentRef.current) {
      // Fallback to last known good content if everything else is empty
      // This helps during state transitions that might temporarily clear values
      content = lastValidContentRef.current;
      console.log('Using last valid SVG content as fallback');
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

  // Effect to handle active clip changes - only run if no explicit prop was provided
  useEffect(() => {
    if (propSvgContent) return; // Skip if prop was provided

    const activeClip = getActiveClip();
    console.log('Active clip changed:', activeClip?.name);

    if (activeClip) {
      if (activeClip.svgContent) {
        // If we have SVG content, update the display directly
        console.log('Updating SVG display with content length:', activeClip.svgContent.length);
        setSvgContent(activeClip.svgContent);
      } else if (activeClip.animationId) {
        // If no SVG content but we have an animation ID, fetch it from server
        console.log('Fetching animation content for ID:', activeClip.animationId);
        setIsLoading(true);

        // Fetch the animation using the ID
        MovieStorageApi.getClipAnimation(activeClip.animationId)
          .then(animation => {
            if (animation && animation.svg) {
              console.log('Retrieved animation SVG from server');
              setSvgContent(animation.svg);

              // Optionally update the clip in the storyboard with the SVG content
              updateClip(activeClip.id, { svgContent: animation.svg });
            } else {
              console.error('No SVG content found in animation');
              // Create a placeholder SVG
              setSvgContent(createPlaceholderSvg('No animation content found'));
            }
          })
          .catch(error => {
            console.error('Error fetching animation:', error);
            // Create a placeholder SVG with error message
            setSvgContent(createPlaceholderSvg(`Error loading animation: ${error.message}`));
          })
          .finally(() => {
            setIsLoading(false);
          });
      } else {
        // Neither SVG content nor animation ID available
        console.warn('Clip has no SVG content or animation ID');
        setSvgContent(createPlaceholderSvg('No animation content available'));
      }
    } else {
      // Don't clear content if we already have context SVG content loaded from elsewhere
      // This prevents clearing content when loading animations directly
      if (!contextSvgContent) {
        console.log('No active clip and no existing content, clearing display');
        setSvgContent('');
      } else {
        console.log('No active clip but keeping existing content from context:',
                   contextSvgContent.length > 50 ? contextSvgContent.substring(0, 50) + '...' : contextSvgContent);
      }
    }
  }, [getActiveClip, setSvgContent, updateClip, propSvgContent, contextSvgContent]);

  // Helper function to create a placeholder SVG with an error message
  const createPlaceholderSvg = (message: string): string => {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <rect width="800" height="600" fill="#1a1a2e" />
      <circle cx="400" cy="200" r="50" fill="#e63946">
        <animate attributeName="r" values="50;55;50" dur="2s" repeatCount="indefinite" />
      </circle>
      <text x="400" y="320" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
        Animation Loading Issue
      </text>
      <text x="400" y="360" font-family="Arial" font-size="16" fill="#cccccc" text-anchor="middle" width="700">
        ${message.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
      </text>
    </svg>`;
  };

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

    // Get container dimensions
    const containerWidth = containerRef.current?.clientWidth || 800;
    const containerHeight = containerRef.current?.clientHeight || 600;

    // Ensure SVG is contained within the container boundaries
    // We'll set both width/height and viewBox to control boundaries
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%');

    // Preserve aspect ratio and ensure proper scaling
    svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

    // Ensure SVG has a viewBox if missing
    if (!svgElement.getAttribute('viewBox')) {
      // Get original width/height from the SVG if available
      const originalWidth = svgElement.getAttribute('width') || containerWidth.toString();
      const originalHeight = svgElement.getAttribute('height') || containerHeight.toString();

      // Parse numeric values from original dimensions
      const width = parseInt(originalWidth.toString(), 10) || containerWidth;
      const height = parseInt(originalHeight.toString(), 10) || containerHeight;

      svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }
  }, [setSvgRef]);

  // Function to handle animation updates
  const handleAnimationUpdated = (event: Event) => {
    const customEvent = event as CustomEvent;

    // Skip update if either container ref is not initialized or we have no content
    // This prevents the warning during initial page load
    if (!svgContainerRef.current || !displaySvgContent) {
      console.log('AnimationCanvas: Skipping update event - waiting for initialization');
      return;
    }

    console.log('AnimationCanvas: Received animation-updated event', customEvent.detail);

    // Only update if we have SVG content and a container
    if (displaySvgContent && svgContainerRef.current) {
      console.log('AnimationCanvas: Updating SVG content on event');

      // Set the HTML directly
      svgContainerRef.current.innerHTML = displaySvgContent;

      // Find the SVG element and set it up
      const newSvgElement = svgContainerRef.current.querySelector('svg');
      if (newSvgElement) {
        setupSvgElement(newSvgElement as SVGSVGElement);
        console.log('AnimationCanvas: Successfully updated SVG element');
      } else {
        console.warn('AnimationCanvas: No SVG element found after update');
      }
    }
  };

  // Update SVG content and handle references
  useEffect(() => {
    // Skip if we have no container to update
    if (!svgContainerRef.current) {
      console.log('AnimationCanvas: Container ref not initialized yet');
      return;
    }

    // Check if we have SVG content to display
    if (displaySvgContent) {
      // Add an edge-case log to check content length
      console.log(`AnimationCanvas: Updating SVG (length: ${displaySvgContent.length})`);

      // Always clear the container first to ensure a clean update
      // This prevents stale content from persisting
      svgContainerRef.current.innerHTML = '';

      // Force content update by directly setting innerHTML after a brief delay
      // This ensures we break any stale references
      setTimeout(() => {
        if (svgContainerRef.current) {
          svgContainerRef.current.innerHTML = displaySvgContent;

          // Find the SVG element in the container
          const svgElement = svgContainerRef.current.querySelector('svg');
          if (svgElement) {
            console.log('AnimationCanvas: Found and setting up SVG element');
            setupSvgElement(svgElement as SVGSVGElement);
            // SVG was found and setup, hide the empty state
            setShowEmptyState(false);

            // Dispatch a "confirmation" event that the SVG is now visible
            window.dispatchEvent(new CustomEvent('svg-displayed', {
              detail: { timestamp: Date.now() }
            }));
          } else {
            console.warn('AnimationCanvas: No SVG element found in container after setting content');
            // No SVG element found, show the empty state if no message has been sent
            setShowEmptyState(!hasMessageBeenSent);
          }
        }
      }, 10);
    } else {
      // No SVG content, show the empty state only if no message has been sent
      setShowEmptyState(!hasMessageBeenSent || !isLoading);
      console.log('AnimationCanvas: No content to display');

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
  }, [displaySvgContent, setupSvgElement, hasMessageBeenSent, isLoading]);

  // Monitor API calls to show loading animation
  useEffect(() => {
    // Function to listen for API calls starting
    const handleApiCallStart = () => {
      setIsLoading(true);
      setHasMessageBeenSent(true);
      setShowEmptyState(false);
    };

    // Function to listen for API calls completing
    const handleApiCallEnd = () => {
      setIsLoading(false);
    };

    // Add event listeners
    window.addEventListener('api-call-start', handleApiCallStart);
    window.addEventListener('api-call-end', handleApiCallEnd);
    window.addEventListener('animation-updated', handleAnimationUpdated);

    return () => {
      // Remove event listeners on cleanup
      window.removeEventListener('api-call-start', handleApiCallStart);
      window.removeEventListener('api-call-end', handleApiCallEnd);
      window.removeEventListener('animation-updated', handleAnimationUpdated);
    };
  }, [displaySvgContent, setupSvgElement]);

  // Adjust SVG to container size when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && displaySvgContent) {
        const svgElement = getSvgContainer()?.querySelector('svg');
        if (svgElement) {
          // Get container dimensions
          const containerWidth = containerRef.current.clientWidth;
          const containerHeight = containerRef.current.clientHeight;

          // Update SVG dimensions to fit container while maintaining aspect ratio
          svgElement.setAttribute('width', `${containerWidth}`);
          svgElement.setAttribute('height', `${containerHeight}`);
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
  }, [displaySvgContent]);

  // Monitor clip change events to ensure SVG updates even if state doesn't trigger re-renders
  useEffect(() => {
    // Function to handle clip change events
    const handleClipChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('AnimationCanvas: Received clip-changed event', customEvent.detail);

      // If the clip already has SVG content, we'll get that through the normal React props
      // But if it has an animationId and no content, we might need to prefetch the animation
      if (customEvent.detail.hasAnimationId && !customEvent.detail.svgContentAvailable) {
        const clip = getActiveClip();
        if (clip && clip.animationId && !clip.svgContent) {
          console.log('AnimationCanvas: Prefetching animation for clip', clip.name);
          // This will trigger the normal effect that handles active clip changes
          // so we don't need to do anything else here
        }
      }
    };

    // Add event listener for clip changes
    window.addEventListener('clip-changed', handleClipChanged);

    return () => {
      // Remove event listener on cleanup
      window.removeEventListener('clip-changed', handleClipChanged);
    };
  }, [getActiveClip]);

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

  // Add a last resort force update function that can be used for debugging
  useEffect(() => {
    // Function to handle force refresh requests
    const handleForceRefresh = (event: Event) => {
      const customEvent = event as CustomEvent;
      console.log('AnimationCanvas: Received force-refresh event', customEvent.detail);

      // Check if we already have content but it's not showing
      if (displaySvgContent && svgContainerRef.current) {
        // Force re-render the SVG
        console.log('AnimationCanvas: Force refreshing SVG content');
        svgContainerRef.current.innerHTML = displaySvgContent;

        // Find and setup the SVG element
        const svgElement = svgContainerRef.current.querySelector('svg');
        if (svgElement) {
          setupSvgElement(svgElement as SVGSVGElement);
          setShowEmptyState(false);
        }
      }
    };

    // Register the event listener
    window.addEventListener('force-refresh-animation', handleForceRefresh);

    // For convenience, create a global debug function for the browser console
    // This allows manual triggering from the browser's console
    (window as any).debugForceRefreshAnimation = () => {
      window.dispatchEvent(new CustomEvent('force-refresh-animation', {
        detail: { source: 'manual', timestamp: Date.now() }
      }));
    };

    return () => {
      // Clean up event listener
      window.removeEventListener('force-refresh-animation', handleForceRefresh);
      // Remove global debug function
      delete (window as any).debugForceRefreshAnimation;
    };
  }, [displaySvgContent, setupSvgElement]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-black/30 rounded-lg overflow-hidden flex items-center justify-center"
      style={{
        touchAction: 'pan-x pan-y',
        minHeight: '200px',
        height: '100%',
        width: '100%',
        ...style // Merge in any additional styles passed as props
      }}
    >
      {/* Empty state or loading indicator */}
      {showEmptyState && (
        <EmptyState
          loading={isLoading}
          showMessage={!isLoading}
          svgContent={displaySvgContent}
        />
      )}

      {/* SVG container with overflow handling */}
      <div
        ref={svgContainerRef}
        className={`w-full h-full flex items-center justify-center ${
          isLoading ? 'opacity-40 transition-opacity duration-300' : 'opacity-100'
        }`}
        data-testid="svg-container"
      />
    </div>
  );
};

export default AnimationCanvas;
