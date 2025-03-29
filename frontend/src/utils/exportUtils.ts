/**
 * Utility functions for exporting animations
 */

// Update import for BackgroundOption
import { BackgroundOption } from '../contexts/ViewerPreferencesContext';

/**
 * Exports the SVG animation as a file for download
 * @param svgContent The SVG content to export
 * @param filename The filename to use (without extension)
 * @param format The format to export in ('svg' or 'json')
 * @param chatHistory Optional chat history to include in JSON export
 * @param background Optional background option for the export
 * @param includeBackground Whether to include the background color in the SVG export
 */
export const exportAnimation = (
  svgContent: string,
  filename: string,
  format: 'svg' | 'json' = 'svg',
  chatHistory?: any[],
  background?: BackgroundOption,
  includeBackground: boolean = true
): void => {
  if (!svgContent) {
    console.error('No SVG content to export');
    return;
  }

  let contentToExport = svgContent;
  let downloadUrl = '';

  // Handle SVG export
  if (format === 'svg') {
    // If background is specified AND includeBackground is true, make sure the SVG has a background element
    if (background && includeBackground) {
      let backgroundStyle: string;

      if (background.type === 'solid') {
        backgroundStyle = background.value;
      } else {
        // For gradients, we need to ensure they work in standalone SVG
        // Convert CSS gradient to SVG gradient
        const gradientId = `export-gradient-${Date.now()}`;
        const isLinear = background.value.includes('linear-gradient');

        // Create SVG gradient definition
        let gradientDef = '';

        if (isLinear) {
          // Extract colors from linear gradient
          const colors = background.gradientColors || ['#333', '#666'];

          // Create gradient definition based on direction
          let x1 = '0%', y1 = '0%', x2 = '100%', y2 = '0%'; // default: to-right

          if (background.gradientDirection === 'to-bottom') {
            x1 = '0%'; y1 = '0%'; x2 = '0%'; y2 = '100%';
          } else if (background.gradientDirection === 'diagonal') {
            x1 = '0%'; y1 = '0%'; x2 = '100%'; y2 = '100%';
          }

          gradientDef = `
            <linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">
              ${colors.map((color, index) =>
                `<stop offset="${index * 100 / (colors.length - 1)}%" stop-color="${color}" />`
              ).join('')}
            </linearGradient>
          `;
        } else {
          // Radial gradient (simpler fallback)
          gradientDef = `
            <radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">
              <stop offset="0%" stop-color="${background.gradientColors?.[0] || '#333'}" />
              <stop offset="100%" stop-color="${background.gradientColors?.[1] || '#666'}" />
            </radialGradient>
          `;
        }

        // Add the gradient definition to the SVG
        contentToExport = contentToExport.replace(
          /(<svg[^>]*>)/,
          `$1\n  <defs>${gradientDef}</defs>`
        );

        backgroundStyle = `url(#${gradientId})`;
      }

      // Check if there's a background rect element
      if (!/<rect[^>]*width=['"]100%['"][^>]*height=['"]100%['"][^>]*fill/.test(contentToExport)) {
        // If no background rect found, add one as the first element after the opening svg tag and any defs
        const insertAfter = contentToExport.includes('<defs>')
          ? /<\/defs>/
          : /(<svg[^>]*>)/;

        contentToExport = contentToExport.replace(
          insertAfter,
          `$&\n  <rect width="100%" height="100%" fill="${backgroundStyle}" />`
        );
      } else {
        // If there is a background rect, update its fill color
        contentToExport = contentToExport.replace(
          /(<rect[^>]*width=['"]100%['"][^>]*height=['"]100%['"][^>]*fill=['"])([^'"]+)(['"][^>]*>)/,
          `$1${backgroundStyle}$3`
        );
      }
    }

    // Create a Blob from the SVG content
    const blob = new Blob([contentToExport], { type: 'image/svg+xml' });
    downloadUrl = URL.createObjectURL(blob);
  } else if (format === 'json') {
    // Create a JSON object with SVG content
    const jsonData = {
      svgContent: svgContent,
      chatHistory,
      timestamp: new Date().toISOString(),
    };

    // Create a Blob from the JSON
    const blob = new Blob([JSON.stringify(jsonData, null, 2)], { type: 'application/json' });
    downloadUrl = URL.createObjectURL(blob);
  }

  // Create a download link and trigger it
  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = format === 'svg'
    ? `${filename}.svg`
    : `${filename}.json`;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // Clean up the URL object
  URL.revokeObjectURL(downloadUrl);
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
