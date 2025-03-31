import React, { useEffect, useRef } from 'react';
import { resetAnimations } from '../utils/animationUtils';

interface SvgThumbnailProps {
  svgContent: string;
  width?: string;
  height?: string;
  className?: string;
  border?: boolean;
}

const SvgThumbnail: React.FC<SvgThumbnailProps> = ({
  svgContent,
  width = '100%',
  height = '100%',
  className = '',
  border = false
}) => {
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || !svgContent) return;

    // Parse the SVG content to extract and modify
    const div = document.createElement('div');
    div.innerHTML = svgContent;
    const svgElement = div.querySelector('svg');
    if (!svgElement) {
      return;
    }

    // Ensure SVG has a viewBox attribute
    let viewBox = svgElement.getAttribute('viewBox');
    if (!viewBox) {
      const width = svgElement.getAttribute('width') || '800';
      const height = svgElement.getAttribute('height') || '600';
      viewBox = `0 0 ${width} ${height}`;
    }

    // Create a new SVG element with the extracted properties
    const newSvg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
    newSvg.setAttribute('viewBox', viewBox);
    newSvg.setAttribute('width', '100%');
    newSvg.setAttribute('height', '100%');
    newSvg.setAttribute('preserveAspectRatio', 'xMidYMid meet');
    newSvg.innerHTML = svgElement.innerHTML;

    // Reset animations and ensure they always play in thumbnails
    resetAnimations(newSvg);
    
    // Ensure CSS animations are always running in thumbnails
    const cssElements = newSvg.querySelectorAll('[style*="animation"]');
    cssElements.forEach(element => {
      if (element instanceof SVGElement && element.style) {
        element.style.animationPlayState = 'running';
      }
    });

    // Add debug logging
    console.log('[ThumbnailDebug] Animation elements in thumbnail:', {
      totalAnimations: newSvg.querySelectorAll('animate, animateTransform, animateMotion').length + cssElements.length,
      smilAnimations: newSvg.querySelectorAll('animate, animateTransform, animateMotion').length,
      cssAnimations: cssElements.length,
      hasCssKeyframes: newSvg.querySelector('style')?.textContent?.includes('@keyframes') || false
    });

    // Check animation playback state right after creation
    console.log('[ThumbnailDebug] Animation initial state:', {
      newlyCreated: true,
      automaticPlayback: true, // Thumbnails always play animations
      animationResetOnMount: true, // Always resets animations
      timestamp: new Date().toISOString()
    });

    // Clear and append the new SVG
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(newSvg);
  }, [svgContent]);

  const borderClass = border ? 'border border-gray-700 rounded-md overflow-hidden' : '';
  const combinedClass = `svg-thumbnail ${borderClass} ${className}`;

  return (
    <div
      ref={containerRef}
      className={combinedClass}
      style={{ width, height }}
    />
  );
};

export default SvgThumbnail;
