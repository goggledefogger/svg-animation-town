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
      
      // Track content source changes to help debug
      if (content.length > 0 && content !== lastValidContentRef.current) {
        console.log(`[SOURCE TRACKING] SVG content source changed to: ${source} (${content.length} bytes) at ${new Date().toISOString()}`);
      }
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
      console.log(`[DEPS TRACKING] Dependencies changed at ${new Date().toISOString()}:
        activeClipId: ${lastDepsRef.current.activeClipId} -> ${activeClipId}
        svgContentLength: ${lastDepsRef.current.svgContentLength} -> ${displaySvgLength}
      `);
      
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
        // Set loading state before updating to prevent flashes
        setIsLoading(true);
        
        // We'll use a timeout to ensure we're not setting state too rapidly
        // This prevents React from batching multiple state updates that could cause flicker
        setTimeout(() => {
          // Mark that we're actively updating this clip to prevent stale renders
          clipChangePendingRef.current = true;
          
          setSvgContent(activeClip.svgContent);
          
          // Delay removing loading state to allow the DOM to update first
          setTimeout(() => {
            setIsLoading(false);
            // Clear the clip change pending flag once we've settled
            clipChangePendingRef.current = false;
          }, 50);
        }, 10);
      }
    } else if (activeClip.animationId) {
      // If no SVG content but we have an animation ID, fetch it from server
      setIsLoading(true);
      clipChangePendingRef.current = true;

      // Fetch the animation using the ID
      MovieStorageApi.getClipAnimation(activeClip.animationId)
        .then(animation => {
          if (animation && animation.svg) {
            // Prevent setting the same content again
            if (displaySvgContent !== animation.svg) {
              setSvgContent(animation.svg);
            }

            // Optionally update the clip in the storyboard with the SVG content
            updateClip(activeClip.id, { svgContent: animation.svg });
          } else {
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
          // Add slight delay before removing loading state to prevent flickering
          setTimeout(() => {
            setIsLoading(false);
            clipChangePendingRef.current = false;
          }, 50);
        });
    } else {
      // Neither SVG content nor animation ID available
      setSvgContent(createPlaceholderSvg('No animation content available'));
    }
  }, [activeClipId, getActiveClip, updateClip, propSvgContent, contextSvgContent, displaySvgContent, setSvgContent]);

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

    // Add max-width to ensure SVG doesn't overflow on mobile
    svgElement.style.maxWidth = '100%';
    svgElement.style.boxSizing = 'border-box';

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

  // Debounce SVG updates to prevent rapid re-renders
  const debouncedUpdateRef = useRef<number | null>(null);
  
  // Add a flag to track when we're in the middle of a clip change
  const clipChangePendingRef = useRef<boolean>(false);
  
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
          console.log(`[RENDER TRACKING] SVG content update at ${new Date().toISOString()} - content length: ${displaySvgContent.length}`);

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
          console.log(`[RENDER TRACKING] Skipped rendering old content during clip change from ${lastDepsRef.current.activeClipId} to ${activeClipId}`);
          return;
        }
        
        console.log(`[RENDER TRACKING] SVG content update at ${new Date().toISOString()} - content length: ${displaySvgContent.length}`);
        
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
      
      console.log(`[EVENT LISTENER] Received clip-changed event at ${new Date().toISOString()} for clip ${customEvent.detail.clipId}`);
      
      // Set flag that we're in the middle of a clip change
      clipChangePendingRef.current = true;
      
      // If the clip already has SVG content, we'll get that through the normal React props
      // But if it has an animationId and no content, we might need to prefetch the animation
      if (customEvent.detail.hasAnimationId && !customEvent.detail.svgContentAvailable) {
        const clip = getActiveClip();
        if (clip && clip.animationId && !clip.svgContent) {
          console.log(`[EVENT LISTENER] Will prefetch animation for clip ${clip.id} with animationId ${clip.animationId}`);
          // This will trigger the normal effect that handles active clip changes
        }
      }
      
      // Clear the pending flag after a short delay to allow state to settle
      setTimeout(() => {
        clipChangePendingRef.current = false;
      }, 300);
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
      // Clear any pending update
      if (debouncedUpdateRef.current) {
        window.clearTimeout(debouncedUpdateRef.current);
      }

      // Check if we already have content but it's not showing
      if (displaySvgContent && svgContainerRef.current) {
        // Debounce the update
        debouncedUpdateRef.current = window.setTimeout(() => {
          if (svgContainerRef.current) {
            svgContainerRef.current.innerHTML = displaySvgContent;

            // Find and setup the SVG element
            const svgElement = svgContainerRef.current.querySelector('svg');
            if (svgElement) {
              setupSvgElement(svgElement as SVGSVGElement);
              setShowEmptyState(false);
            }
          }
          debouncedUpdateRef.current = null;
        }, 50);
      }
    };

    // Register the event listener
    window.addEventListener('force-refresh-animation', handleForceRefresh);

    // Clean up
    return () => {
      window.removeEventListener('force-refresh-animation', handleForceRefresh);
      // Clear any pending updates on cleanup
      if (debouncedUpdateRef.current) {
        window.clearTimeout(debouncedUpdateRef.current);
      }
    };
  }, [displaySvgContent, setupSvgElement]);

  // Main render function
  return (
    <div
      ref={containerRef}
      className="w-full h-full max-w-full overflow-hidden flex items-center justify-center"
      style={{...style}}
    >
      <div
        className={`absolute inset-0 transition-opacity duration-300 ${showEmptyState ? 'opacity-100' : 'opacity-0 pointer-events-none'}`}
      >
        <EmptyState loading={isLoading} />
      </div>

      <div
        ref={svgContainerRef}
        data-testid="svg-container"
        className={`w-full h-full max-w-full flex items-center justify-center overflow-hidden transition-opacity duration-300 ${showEmptyState ? 'opacity-0' : 'opacity-100'}`}
        style={{
          position: 'relative',
          maxWidth: '100vw',
          boxSizing: 'border-box'
        }}
      />
    </div>
  );
};

export default AnimationCanvas;
