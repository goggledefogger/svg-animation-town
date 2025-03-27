import React, { useEffect, useRef } from 'react';

interface SvgContainerProps {
  svgContent: string | null;
  className?: string;
  containerClassName?: string;
  isAnimationEditor?: boolean;
}

/**
 * A container component that ensures SVGs are properly sized and contained
 * within their parent container while maintaining aspect ratio.
 */
const SvgContainer: React.FC<SvgContainerProps> = ({
  svgContent,
  className = '',
  containerClassName = '',
  isAnimationEditor = false,
}) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const svgRef = useRef<HTMLDivElement>(null);

  // Effect to handle the SVG insertion and sizing
  useEffect(() => {
    if (!svgContent || !svgRef.current) return;

    // Create a container for the SVG content
    const tempDiv = document.createElement('div');
    tempDiv.innerHTML = svgContent.trim();

    // Get the SVG element
    const svgElement = tempDiv.querySelector('svg');
    if (!svgElement) return;

    // Clean previous content
    svgRef.current.innerHTML = '';

    // Get or create viewBox to ensure proper scaling
    if (!svgElement.getAttribute('viewBox')) {
      const width = svgElement.getAttribute('width') || '800';
      const height = svgElement.getAttribute('height') || '600';
      svgElement.setAttribute('viewBox', `0 0 ${width} ${height}`);
    }

    // Set SVG to scale properly within container
    svgElement.setAttribute('preserveAspectRatio', isAnimationEditor ? 'xMidYMid meet' : 'xMidYMid meet');
    svgElement.setAttribute('width', '100%');
    svgElement.setAttribute('height', '100%');

    // Set CSS styles to ensure proper containment
    svgElement.style.display = 'block';

    // In Animation Editor, allow SVG to use full container height
    if (isAnimationEditor) {
      svgElement.style.maxWidth = '100%';
      svgElement.style.height = '100%';
      svgElement.style.objectFit = 'contain';
    } else {
      // In Movie Editor, ensure proper containment within fixed bounds
      svgElement.style.maxWidth = '100%';
      svgElement.style.maxHeight = '100%';
      svgElement.style.objectFit = 'contain';
    }

    // Append to the DOM
    svgRef.current.appendChild(svgElement);
  }, [svgContent, isAnimationEditor]);

  return (
    <div
      ref={containerRef}
      className={`w-full h-full overflow-hidden flex items-center justify-center ${containerClassName}`}
    >
      <div
        ref={svgRef}
        className={`w-full h-full flex items-center justify-center ${className}`}
        data-testid="svg-container"
      />
    </div>
  );
};

export default SvgContainer;
