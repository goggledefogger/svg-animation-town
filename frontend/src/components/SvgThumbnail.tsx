import React, { useEffect, useRef } from 'react';

interface SvgThumbnailProps {
  svgContent: string;
  width?: string;
  height?: string;
  className?: string;
  border?: boolean;
  duration?: number;
}

const SvgThumbnail: React.FC<SvgThumbnailProps> = ({
  svgContent,
  width = '100%',
  height = '100%',
  className = '',
  border = false,
  duration = 5
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

    // Ensure animations always play in thumbnails with consistent duration
    const smilElements = newSvg.querySelectorAll('animate, animateTransform, animateMotion');
    smilElements.forEach(element => {
      // Ensure SMIL animations start from the beginning
      if (element.hasAttribute('begin')) {
        element.setAttribute('begin', '0s');
      }
      // Make sure animations aren't paused
      element.removeAttribute('end');
      // Set duration to match clip duration
      element.setAttribute('dur', `${duration}s`);
    });

    // Ensure CSS animations are running with consistent duration
    const cssElements = newSvg.querySelectorAll('[style*="animation"]');
    cssElements.forEach(element => {
      if (element instanceof SVGElement && element.style) {
        element.style.animationPlayState = 'running';
        element.style.animationDuration = `${duration}s`;
      }
    });

    // Add debug logging
    console.log('[ThumbnailDebug] Animation elements in thumbnail:', {
      totalAnimations: smilElements.length + cssElements.length,
      smilAnimations: smilElements.length,
      cssAnimations: cssElements.length,
      hasCssKeyframes: newSvg.querySelector('style')?.textContent?.includes('@keyframes') || false,
      appliedDuration: duration
    });

    // Check animation playback state right after creation
    console.log('[ThumbnailDebug] Animation initial state:', {
      newlyCreated: true,
      automaticPlayback: true, // Thumbnails always play animations
      animationResetOnMount: true, // Always resets animations
      appliedDuration: `${duration}s`, 
      timestamp: new Date().toISOString()
    });

    // Clear and append the new SVG
    containerRef.current.innerHTML = '';
    containerRef.current.appendChild(newSvg);
  }, [svgContent, duration]);

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
