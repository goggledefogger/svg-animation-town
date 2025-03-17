/**
 * Utility functions for exporting animations
 */

/**
 * Exports the SVG animation as a file for download
 * @param svgContent The SVG content to export
 * @param filename The filename to use (without extension)
 * @param format The format to export in ('svg' or 'json')
 * @param chatHistory Optional chat history to include in JSON export
 */
export const exportAnimation = (
  svgContent: string,
  filename: string,
  format: 'svg' | 'json',
  chatHistory?: any[]
): void => {
  if (!svgContent) {
    console.error('No SVG content to export');
    return;
  }

  try {
    let blob: Blob;
    let downloadFilename: string;

    if (format === 'svg') {
      // Export as SVG
      blob = new Blob([svgContent], { type: 'image/svg+xml' });
      downloadFilename = `${filename}.svg`;
    } else {
      // Export as JSON
      const jsonData = {
        svg: svgContent,
        chatHistory,
        timestamp: new Date().toISOString(),
      };
      blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
      downloadFilename = `${filename}.json`;
    }

    // More robust download approach that works better across browsers
    // Create a download link
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.style.display = 'none';
    a.href = url;
    a.download = downloadFilename;

    // For older browsers
    const isIE = typeof (window as any).navigator.msSaveBlob !== 'undefined';

    if (isIE) {
      // For IE
      (window as any).navigator.msSaveBlob(blob, downloadFilename);
    } else {
      // For other browsers
      document.body.appendChild(a);

      // Use a timeout to ensure the click works across browsers
      setTimeout(() => {
        a.click();

        // Clean up
        document.body.removeChild(a);
        setTimeout(() => {
          URL.revokeObjectURL(url);
        }, 100);
      }, 0);
    }
  } catch (error) {
    console.error('Error during export:', error);
  }
};

/**
 * Checks if SVG contains animations that can be properly exported
 * @param svgContent The SVG content to check
 * @returns true if the SVG can be exported with animations
 */
export const canExportAsSvg = (svgContent: string): boolean => {
  if (!svgContent) return false;

  // Check if SVG has SMIL animations or CSS animations/keyframes
  const hasSMILAnimations = /<animate|<animateTransform|<animateMotion/.test(svgContent);
  const hasCSSAnimations = /<style[^>]*>[\s\S]*?@keyframes|animation:/.test(svgContent);

  // SVG with SMIL animations can be exported directly
  // SVG with CSS animations typically works in browsers but may not work in all SVG viewers
  return hasSMILAnimations || hasCSSAnimations;
};
