import React, { useMemo } from 'react';

interface SvgThumbnailProps {
  svgContent: string;
  className?: string;
}

const SvgThumbnail: React.FC<SvgThumbnailProps> = ({ svgContent, className = '' }) => {
  // Create a safe SVG element from the content
  const sanitizedSvg = useMemo(() => {
    try {
      // Basic sanity check
      if (!svgContent || !svgContent.includes('<svg')) {
        return null;
      }

      // Create a temporary div to hold the SVG
      const div = document.createElement('div');
      div.innerHTML = svgContent.trim();

      // Get the first SVG element
      const svgElement = div.querySelector('svg');
      if (!svgElement) {
        return null;
      }

      // Extract the viewBox or create one if it doesn't exist
      let viewBox = svgElement.getAttribute('viewBox');
      if (!viewBox) {
        const width = svgElement.getAttribute('width') || '800';
        const height = svgElement.getAttribute('height') || '600';
        viewBox = `0 0 ${width} ${height}`;
      }

      const result = {
        viewBox,
        innerHTML: svgElement.innerHTML,
      };
      return result;
    } catch (error) {
      console.error('Error processing SVG content:', error);
      return null;
    }
  }, [svgContent]);

  if (!sanitizedSvg) {
    // Fallback for invalid SVG
    return (
      <svg
        className={className}
        viewBox="0 0 24 24"
        xmlns="http://www.w3.org/2000/svg"
      >
        <rect width="24" height="24" fill="#1E293B" />
        <text x="12" y="12" fontSize="4" fill="#94A3B8" textAnchor="middle" dominantBaseline="middle">
          Invalid SVG
        </text>
      </svg>
    );
  }

  return (
    <svg
      className={className}
      viewBox={sanitizedSvg.viewBox}
      xmlns="http://www.w3.org/2000/svg"
      preserveAspectRatio="xMidYMid meet"
      dangerouslySetInnerHTML={{ __html: sanitizedSvg.innerHTML }}
    />
  );
};

export default SvgThumbnail;
