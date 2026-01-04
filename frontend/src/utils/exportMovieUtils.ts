/**
 * Utility functions for exporting movie animations
 */

import { Storyboard, MovieClip } from '../contexts/MovieContext';
import { BackgroundOption } from '../contexts/ViewerPreferencesContext';

/**
 * Exports a complete movie as an SVG with sequenced animations
 * @param storyboard The storyboard with clips to export
 * @param filename The filename to use (without extension)
 * @param options Export options including background and subtitle settings
 */
export const exportMovieAsSvg = (
  storyboard: Storyboard,
  filename: string,
  options: {
    includePrompts: boolean,
    includeMoviePrompt?: boolean, // New option for movie-level description
    background?: BackgroundOption,
    includeBackground?: boolean
  }
): void => {
  if (!storyboard || !storyboard.clips || storyboard.clips.length === 0) {
    console.error('No clips to export');
    return;
  }

  const orderedClips = [...storyboard.clips].sort((a, b) => a.order - b.order);

  // Initialize SVG document with standard viewport
  let svgContent = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">\n`;
  svgContent += `  <!-- Movie: ${storyboard.name} -->\n`;
  svgContent += `  <!-- Total clips: ${orderedClips.length} -->\n\n`;

  // Add defs section for gradients and other definitions
  svgContent += `  <defs>\n`;

  // Add background gradient if needed
  if (options.background && options.includeBackground !== false) {
    const background = options.background;
    if (background.type === 'gradient') {
      const gradientId = `movie-background-gradient`;
      const isLinear = background.value.includes('linear-gradient');

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

        svgContent += `    <linearGradient id="${gradientId}" x1="${x1}" y1="${y1}" x2="${x2}" y2="${y2}">\n`;
        colors.forEach((color, index) => {
          svgContent += `      <stop offset="${index * 100 / (colors.length - 1)}%" stop-color="${color}" />\n`;
        });
        svgContent += `    </linearGradient>\n`;
      } else {
        // Radial gradient
        svgContent += `    <radialGradient id="${gradientId}" cx="50%" cy="50%" r="50%" fx="50%" fy="50%">\n`;
        svgContent += `      <stop offset="0%" stop-color="${background.gradientColors?.[0] || '#333'}" />\n`;
        svgContent += `      <stop offset="100%" stop-color="${background.gradientColors?.[1] || '#666'}" />\n`;
        svgContent += `    </radialGradient>\n`;
      }
    }
  }

  // Add styles for subtitles and overlays
  if (options.includePrompts || options.includeMoviePrompt) {
    svgContent += `    <style>
      .subtitle-background {
        fill: rgba(0, 0, 0, 0.4);
        rx: 8;
        ry: 8;
      }
      .subtitle-text {
        font-family: Arial, sans-serif;
        font-size: 14px;
        fill: white;
        text-anchor: middle;
        text-shadow: 0px 0px 2px rgba(0, 0, 0, 0.8);
      }
      .overlay-background {
        fill: rgba(0, 0, 0, 0.4);
        rx: 8;
        ry: 8;
      }
      .overlay-text {
        font-family: Arial, sans-serif;
        font-size: 14px;
        fill: white;
        text-anchor: start;
        text-shadow: 0px 0px 2px rgba(0, 0, 0, 0.8);
      }
    </style>\n`;
  }

  svgContent += `  </defs>\n\n`;

  // Add background
  if (options.background && options.includeBackground !== false) {
    const background = options.background;
    const fillValue = background.type === 'solid'
      ? background.value
      : `url(#movie-background-gradient)`;

    svgContent += `  <rect width="100%" height="100%" fill="${fillValue}" />\n\n`;
  }

  // Create animation timing controller
  svgContent += `  <!-- Animation timeline controller -->\n`;

  // Calculate total duration
  const totalDuration = orderedClips.reduce((sum, clip) => sum + (clip.duration || 5), 0);

  svgContent += `  <rect id="timeline-tracker" width="1" height="1" opacity="0">
    <animate id="main-timeline" attributeName="x" from="0" to="1" dur="${totalDuration}s" fill="freeze" />
  </rect>\n\n`;



  // Process each clip and add to SVG with timing
  let cumulativeTime = 0;

  orderedClips.forEach((clip, index) => {
    const clipId = `clip-${index}`;
    const duration = clip.duration || 5; // Default to 5 seconds if not specified

    // Extract the SVG content from the clip, removing the outer svg tag
    const clipContent = processClipSvg(clip, clipId);

    // Calculate begin time
    const beginTime = cumulativeTime;
    const endTime = beginTime + duration;

    // Create a group for this clip with visibility timing
    svgContent += `  <!-- Clip ${index + 1}: ${clip.name} (Duration: ${duration}s, Time: ${beginTime}s - ${endTime}s) -->\n`;
    svgContent += `  <g id="${clipId}" opacity="0">\n`;

    // Add visibility animation - fade in at start time, fade out at end time
    svgContent += `    <animate attributeName="opacity" from="0" to="1" begin="main-timeline.begin+${beginTime}s" dur="0.5s" fill="freeze" />\n`;
    svgContent += `    <animate attributeName="opacity" from="1" to="0" begin="main-timeline.begin+${endTime - 0.5}s" dur="0.5s" fill="freeze" />\n`;

    // Add initial setting to ensure it's not visible (needed for some browsers)
    svgContent += `    <set attributeName="display" to="none" />\n`;
    svgContent += `    <set attributeName="display" to="inline" begin="main-timeline.begin+${beginTime}s" end="main-timeline.begin+${endTime}s" />\n`;

    // Add the clip content
    svgContent += clipContent;

    // Close the clip group
    svgContent += `  </g>\n\n`;

    // Add Clip Caption (Subtitle) - Bottom Centered
    if (options.includePrompts && clip.prompt) {
      const promptText = clip.prompt.replace(/"/g, '&quot;');
      const lines = formatPromptIntoLines(promptText, 80, 3);

      svgContent += `  <!-- Subtitle for clip ${index + 1} -->\n`;
      svgContent += `  <g id="subtitle-${clipId}" opacity="0">\n`;

      // Add subtitle animations to match clip timing
      svgContent += `    <animate attributeName="opacity" from="0" to="1" begin="main-timeline.begin+${beginTime + 0.5}s" dur="0.5s" fill="freeze" />\n`;
      svgContent += `    <animate attributeName="opacity" from="1" to="0" begin="main-timeline.begin+${endTime - 0.5}s" dur="0.5s" fill="freeze" />\n`;
      svgContent += `    <set attributeName="display" to="none" />\n`;
      svgContent += `    <set attributeName="display" to="inline" begin="main-timeline.begin+${beginTime}s" end="main-timeline.begin+${endTime}s" />\n`;

      // Bottom subtitle layout
      const lineHeight = 18;
      const bgHeight = 24 + (lineHeight * (lines.length - 1));

      svgContent += `    <rect class="subtitle-background" x="150" y="${550 - bgHeight}" width="500" height="${bgHeight}" />\n`;

      lines.forEach((line, lineIndex) => {
        const yPosition = 550 - bgHeight + 16 + (lineIndex * lineHeight);
        svgContent += `    <text class="subtitle-text" x="400" y="${yPosition}">${line}</text>\n`;
      });

      svgContent += `  </g>\n\n`;
    }

    // Update cumulative time
    cumulativeTime += duration;
  });

  // Render Movie Prompt Overlay (Top-Left) - visible for entire duration with cycling text
  if (options.includeMoviePrompt && storyboard.description) {
    const promptText = storyboard.description.replace(/"/g, '&quot;');
    const allLines = formatPromptIntoLines(promptText, 70); // 70 chars max per line, unlimited lines

    // Pagination settings
    const linesPerPage = 3;
    const pageDuration = 5; // seconds per page
    const totalPages = Math.ceil(allLines.length / linesPerPage);

    svgContent += `  <!-- Movie Prompt Overlay (Paged: ${totalPages} pages, ${pageDuration}s each) -->\n`;

    // Render each page group
    for (let pageIndex = 0; pageIndex < totalPages; pageIndex++) {
      const pageId = `movie-prompt-page-${pageIndex}`;
      const pageLines = allLines.slice(pageIndex * linesPerPage, (pageIndex + 1) * linesPerPage);

      // Calculate start times for this page (cycling)
      const beginTimes: string[] = [];
      for (let t = 0; t < totalDuration; t += pageDuration) {
        // Current cycle index
        const cycleIndex = Math.floor(t / pageDuration) % totalPages;
        if (cycleIndex === pageIndex) {
          beginTimes.push(`main-timeline.begin+${t}s`);
        }
      }
      const beginAttribute = beginTimes.join(';');

      svgContent += `  <g id="${pageId}" display="none">\n`;
      // Visibility animation
      svgContent += `    <set attributeName="display" to="inline" begin="${beginAttribute}" dur="${pageDuration}s" />\n`;

      // Layout calculation for this page
      const lineHeight = 18;
      const padding = 12;
      const bgHeight = (padding * 2) + (lineHeight * (pageLines.length - 1)) + 6;

      const rectX = 20;
      const rectY = 20;
      const textX = 32; // x + padding
      const firstTextY = 20 + padding + 5;
      const boxWidth = 500;

      svgContent += `    <rect class="overlay-background" x="${rectX}" y="${rectY}" width="${boxWidth}" height="${bgHeight}" />\n`;

      pageLines.forEach((line, lineIndex) => {
        const yPosition = firstTextY + (lineIndex * lineHeight);
        svgContent += `    <text class="overlay-text" x="${textX}" y="${yPosition}">${line}</text>\n`;
      });

      svgContent += `  </g>\n`;
    }
  }

  // Add a replay button
  svgContent += `  <!-- Replay button -->\n`;
  svgContent += `  <g id="replay-button" opacity="0" cursor="pointer" onclick="document.getElementById('main-timeline').beginElement()">
    <animate attributeName="opacity" from="0" to="1" begin="main-timeline.end" dur="0.5s" fill="freeze" />
    <circle cx="400" cy="300" r="50" fill="#ffdf00" />
    <path d="M385,275 L385,325 L425,300 Z" fill="#121212" />
    <text x="400" y="370" font-family="Arial" font-size="16" fill="white" text-anchor="middle">Click to replay</text>
  </g>\n`;

  // Close the SVG tag
  svgContent += `</svg>`;

  // Create a Blob from the SVG content
  const blob = new Blob([svgContent], { type: 'image/svg+xml' });
  const downloadUrl = URL.createObjectURL(blob);

  // Create a download link and trigger it
  const downloadLink = document.createElement('a');
  downloadLink.href = downloadUrl;
  downloadLink.download = `${filename}_movie.svg`;

  document.body.appendChild(downloadLink);
  downloadLink.click();
  document.body.removeChild(downloadLink);

  // Clean up the URL object
  URL.revokeObjectURL(downloadUrl);
};

/**
 * Process an individual clip's SVG content to be included in the movie
 * @param clip The movie clip to process
 * @param clipId Unique ID for the clip in the movie
 * @returns Processed SVG content for the clip
 */
function processClipSvg(clip: MovieClip, clipId: string): string {
  if (!clip.svgContent) {
    return `    <!-- Missing SVG content for clip: ${clip.name} -->\n`;
  }

  try {
    // Parse the SVG to extract content
    const parser = new DOMParser();
    const svgDoc = parser.parseFromString(clip.svgContent, 'image/svg+xml');
    const svgElement = svgDoc.querySelector('svg');

    if (!svgElement) {
      return `    <!-- Invalid SVG content for clip: ${clip.name} -->\n`;
    }

    // Prefix all IDs in the SVG to avoid conflicts
    prefixIds(svgElement, clipId);

    // Extract all elements from the SVG (except defs, which we'll handle specially)
    let processedContent = '';

    // Handle any defs elements separately and merge them
    const defs = svgElement.querySelector('defs');
    if (defs) {
      // Add indentation to each line
      const defsContent = defs.innerHTML
        .trim()
        .split('\n')
        .map(line => `    ${line}`)
        .join('\n');

      processedContent += defsContent + '\n';
    }

    // Get all top-level elements except defs
    const topLevelElements = Array.from(svgElement.children).filter(el => el.tagName.toLowerCase() !== 'defs');

    // Add each element with proper indentation
    topLevelElements.forEach(element => {
      const elementText = element.outerHTML
        .trim()
        .split('\n')
        .map(line => `    ${line}`)
        .join('\n');

      processedContent += elementText + '\n';
    });

    return processedContent;
  } catch (e) {
    console.error(`Error processing SVG for clip ${clip.name}:`, e);
    return `    <!-- Error processing SVG content for clip: ${clip.name} -->\n`;
  }
}

/**
 * Prefix all IDs in an SVG element to avoid conflicts when combining multiple SVGs
 * @param element The SVG element to process
 * @param prefix The prefix to add to all IDs
 */
function prefixIds(element: Element, prefix: string): void {
  // First collect all IDs to create a mapping
  const idMap = new Map<string, string>();

  // Find all elements with IDs
  const elementsWithIds = element.querySelectorAll('[id]');
  elementsWithIds.forEach(el => {
    const originalId = el.getAttribute('id')!;
    const newId = `${prefix}-${originalId}`;
    idMap.set(originalId, newId);
    el.setAttribute('id', newId);
  });

  // Now update all references to these IDs
  // Look for href, url(), animations, etc.

  // Update href attributes
  const elementsWithHref = element.querySelectorAll('[href^="#"]');
  elementsWithHref.forEach(el => {
    const href = el.getAttribute('href')!;
    const originalId = href.substring(1);
    const newId = idMap.get(originalId);
    if (newId) {
      el.setAttribute('href', `#${newId}`);
    }
  });

  // Update url() references in styles and attributes
  const allElements = element.querySelectorAll('*');
  allElements.forEach(el => {
    // Update style attribute
    const style = el.getAttribute('style');
    if (style && style.includes('url(#')) {
      let newStyle = style;
      idMap.forEach((newId, originalId) => {
        const pattern = new RegExp(`url\\(#${originalId}\\)`, 'g');
        newStyle = newStyle.replace(pattern, `url(#${newId})`);
      });
      el.setAttribute('style', newStyle);
    }

    // Update fill, stroke, clip-path, mask attributes
    ['fill', 'stroke', 'clip-path', 'mask', 'filter'].forEach(attr => {
      const value = el.getAttribute(attr);
      if (value && value.includes('url(#')) {
        let newValue = value;
        idMap.forEach((newId, originalId) => {
          const pattern = new RegExp(`url\\(#${originalId}\\)`, 'g');
          newValue = newValue.replace(pattern, `url(#${newId})`);
        });
        el.setAttribute(attr, newValue);
      }
    });

    // Update begin, end attributes in animations (for SMIL)
    if (el.tagName.toLowerCase().includes('animate')) {
      ['begin', 'end'].forEach(attr => {
        const value = el.getAttribute(attr);
        if (value && value.includes('.')) {
          let newValue = value;
          idMap.forEach((newId, originalId) => {
            // Replace patterns like "originalId.begin" or "originalId.end+2s"
            const pattern = new RegExp(`${originalId}\\.`, 'g');
            newValue = newValue.replace(pattern, `${newId}.`);
          });
          el.setAttribute(attr, newValue);
        }
      });
    }
  });
}

/**
 * Format a prompt text into multiple lines for better presentation
 * @param text The prompt text to format
 * @param maxLines Optional maximum number of lines (defaults to unlimited)
 * @returns Array of text lines
 */
function formatPromptIntoLines(text: string, maxLength: number, maxLines?: number): string[] {
  if (!text) return [];
  if (text.length <= maxLength) return [text];

  const lines: string[] = [];
  let currentLine = '';

  // Split by spaces and distribute across lines
  const words = text.split(' ');

  words.forEach(word => {
    if (currentLine.length + word.length + 1 <= maxLength) {
      currentLine += (currentLine ? ' ' : '') + word;
    } else {
      lines.push(currentLine);
      currentLine = word;
    }
  });

  if (currentLine) {
    lines.push(currentLine);
  }

  // Limit to max lines if specified
  if (maxLines && lines.length > maxLines) {
    lines.splice(maxLines);
    const lastLine = lines[maxLines - 1];
    if (lastLine.length > maxLength - 3) {
      lines[maxLines - 1] = lastLine.substring(0, maxLength - 3) + '...';
    } else {
      lines[maxLines - 1] = lastLine + '...';
    }
  }

  return lines;
}
