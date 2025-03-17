import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAnimation, useSvgRef } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import EmptyState from './EmptyState';

const AnimationCanvas: React.FC = () => {
  const { svgContent } = useAnimation();
  const { currentStoryboard, activeClipId, getActiveClip } = useMovie();
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

  // Determine which SVG content to use - prefer active clip, fall back to animation context
  const displaySvgContent = activeClipSvgContent || svgContent;

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

  // Log when active clip changes
  useEffect(() => {
    if (activeClipId) {
      const activeClip = getActiveClip();
      console.log('Active clip changed:', activeClip?.name);
    }
  }, [activeClipId, getActiveClip]);

  // Update SVG content and handle references
  useEffect(() => {
    // Check if we have SVG content to display
    if (displaySvgContent && svgContainerRef.current) {
      console.log('Updating SVG display with content length:', displaySvgContent.length);

      // Clear previous content and set the new SVG content
      svgContainerRef.current.innerHTML = displaySvgContent;

      // Find the SVG element in the container
      const svgElement = svgContainerRef.current.querySelector('svg');
      if (svgElement) {
        setupSvgElement(svgElement as SVGSVGElement);
        // SVG was found and setup, hide the empty state
        setShowEmptyState(false);
      } else {
        console.warn('No SVG element found in container after setting content');
        // No SVG element found, show the empty state if no message has been sent
        setShowEmptyState(!hasMessageBeenSent);
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
  }, [displaySvgContent, setupSvgElement, hasMessageBeenSent, isLoading]);

  // Monitor API calls to show loading animation
  useEffect(() => {
    // Function to listen for API calls starting
    const handleApiCallStart = () => {
      console.log('API call started - showing loading animation');
      setIsLoading(true);
      setHasMessageBeenSent(true);
      setShowEmptyState(false);
    };

    // Function to listen for API calls completing
    const handleApiCallEnd = () => {
      console.log('API call ended - hiding loading animation');
      setIsLoading(false);
    };

    // Add event listeners for custom API events
    window.addEventListener('api-call-start', handleApiCallStart);
    window.addEventListener('api-call-end', handleApiCallEnd);

    return () => {
      // Remove event listeners on cleanup
      window.removeEventListener('api-call-start', handleApiCallStart);
      window.removeEventListener('api-call-end', handleApiCallEnd);
    };
  }, []);

  // Adjust SVG to container size when window resizes
  useEffect(() => {
    const handleResize = () => {
      if (containerRef.current && svgContainerRef.current) {
        const svgElement = svgContainerRef.current.querySelector('svg');
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
  }, [svgContent]);

  // Clean up on unmount
  useEffect(() => {
    return () => {
      if (svgContainerRef.current) {
        svgContainerRef.current.innerHTML = '';
      }

      // Clear reference on unmount
      if (currentSvgRef.current) {
        currentSvgRef.current = null;
        setSvgRef(null);
      }
    };
  }, [setSvgRef]);

  return (
    <div
      ref={containerRef}
      className={`relative flex-1 bg-black/30 rounded-lg overflow-hidden flex items-center justify-center ${
        isLoading ? 'animate-pulse-subtle' : ''
      }`}
      style={{
        touchAction: 'pan-x pan-y',
        minHeight: '260px',
        height: '100%'
      }}
    >
      {/* Loading overlay */}
      {isLoading && (
        <div className="absolute inset-0 bg-black/20 z-10 flex items-center justify-center pointer-events-none">
          <div className="relative">
            {/* Pulsing loading indicator */}
            <svg className="w-20 h-20 animate-spin-slow" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
              <path
                d="M50,10 C40,25 20,40 15,60 C25,55 35,55 50,70 C65,55 75,55 85,60 C80,40 60,25 50,10"
                fill="none"
                stroke="#ffdf00"
                strokeWidth="2"
                strokeDasharray="240"
                strokeDashoffset="0"
                className="animate-dash-offset-300"
              />
            </svg>
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="w-4 h-4 bg-bat-yellow rounded-full animate-ping"></div>
            </div>
          </div>
        </div>
      )}

      {/* Always render both, but control visibility with CSS */}
      <div className={showEmptyState ? 'block' : 'hidden'}>
        <EmptyState />
      </div>
      <div
        ref={svgContainerRef}
        className={`absolute inset-0 flex items-center justify-center overflow-hidden ${showEmptyState ? 'hidden' : 'block'} ${
          isLoading ? 'opacity-40 transition-opacity duration-300' : 'opacity-100'
        }`}
        style={{ maxHeight: '100%', maxWidth: '100%' }}
        data-testid="svg-container"
      />
    </div>
  );
};

export default AnimationCanvas;
