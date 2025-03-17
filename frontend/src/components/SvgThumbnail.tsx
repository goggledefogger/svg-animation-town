import React, { useRef, useEffect } from 'react';

interface SvgThumbnailProps {
  svgContent: string;
  className?: string;
}

const SvgThumbnail: React.FC<SvgThumbnailProps> = ({ svgContent, className = '' }) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !svgContent) return;

    // Clear existing content and add the new SVG
    containerRef.current.innerHTML = svgContent;

    // Find and modify the SVG element
    const svgElement = containerRef.current.querySelector('svg');
    if (svgElement) {
      // Set proper attributes for rendering
      svgElement.setAttribute('width', '100%');
      svgElement.setAttribute('height', '100%');
      svgElement.setAttribute('preserveAspectRatio', 'xMidYMid meet');

      // Ensure SVG has a viewBox
      if (!svgElement.getAttribute('viewBox')) {
        svgElement.setAttribute('viewBox', '0 0 800 600');
      }
    }
  }, [svgContent]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full flex items-center justify-center ${className}`}
    />
  );
};

export default SvgThumbnail;
