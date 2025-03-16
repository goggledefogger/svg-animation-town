import React, { useEffect, useRef, useState, useCallback } from 'react';
import { useAnimation, useSvgRef } from '../contexts/AnimationContext';
import EmptyState from './EmptyState';

const AnimationCanvas: React.FC = () => {
  const { svgContent } = useAnimation();
  const setSvgRef = useSvgRef();
  const containerRef = useRef<HTMLDivElement>(null);
  const svgContainerRef = useRef<HTMLDivElement>(null);
  const currentSvgRef = useRef<SVGSVGElement | null>(null);

  // Use a state variable to track whether we're showing the empty state or the SVG
  const [showEmptyState, setShowEmptyState] = useState(true);

  // Memoize the function to handle SVG element setup to avoid recreating it on every render
  const setupSvgElement = useCallback((svgElement: SVGSVGElement) => {
    console.log('Setting up SVG element');

    // Only update reference if it's a different element
    if (svgElement !== currentSvgRef.current) {
      currentSvgRef.current = svgElement;
      setSvgRef(svgElement);
    }

    // Get container dimensions
    const containerWidth = containerRef.current?.clientWidth || 800;
    const containerHeight = containerRef.current?.clientHeight || 600;

    console.log(`Container dimensions: ${containerWidth}x${containerHeight}`);

    // Update SVG dimensions to fit container while maintaining aspect ratio
    svgElement.setAttribute('width', `${containerWidth}`);
    svgElement.setAttribute('height', `${containerHeight}`);
  }, [setSvgRef]);

  // Update SVG content and handle references
  useEffect(() => {
    console.log('SVG content effect running with content:', svgContent ? 'present' : 'none');

    // Check if we have SVG content to display
    if (svgContent && svgContainerRef.current) {
      console.log('Setting SVG content to container');

      // Clear previous content and set the new SVG content
      svgContainerRef.current.innerHTML = svgContent;

      // Find the SVG element in the container
      const svgElement = svgContainerRef.current.querySelector('svg');
      if (svgElement) {
        console.log('Found SVG element in container');
        setupSvgElement(svgElement as SVGSVGElement);
        // SVG was found and setup, hide the empty state
        setShowEmptyState(false);
      } else {
        console.warn('No SVG element found in container after setting content');
        // No SVG element found, show the empty state
        setShowEmptyState(true);
      }
    } else {
      // No SVG content, show the empty state
      setShowEmptyState(true);

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
  }, [svgContent, setupSvgElement]);

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

  // Log when SVG content changes
  useEffect(() => {
    if (svgContent) {
      console.log('AnimationCanvas - SVG content updated');
    } else {
      console.log('AnimationCanvas - No SVG content');
    }
  }, [svgContent]);

  return (
    <div
      ref={containerRef}
      className="relative flex-1 bg-black/30 rounded-lg overflow-visible flex items-center justify-center"
      style={{ touchAction: 'pan-x pan-y', minHeight: '300px' }}
    >
      {/* Always render both, but control visibility with CSS */}
      <div className={showEmptyState ? 'block' : 'hidden'}>
        <EmptyState />
      </div>
      <div
        ref={svgContainerRef}
        className={`absolute inset-0 flex items-center justify-center ${showEmptyState ? 'hidden' : 'block'}`}
        style={{ maxHeight: '100%', maxWidth: '100%' }}
        data-testid="svg-container"
      />
    </div>
  );
};

export default AnimationCanvas;
