/**
 * Utility to sanitize SVG content to prevent XSS attacks.
 * This is a manual implementation used because external sanitization libraries
 * cannot be added to the project at this time.
 */

/**
 * Sanitizes an SVG string by removing potentially malicious elements and attributes.
 * Focuses on removing <script> tags and 'on*' event handler attributes.
 *
 * @param svgContent The raw SVG string to sanitize
 * @returns A sanitized SVG string
 */
export const sanitizeSvg = (svgContent: string | null): string => {
  if (!svgContent) return '';

  try {
    const parser = new DOMParser();
    const doc = parser.parseFromString(svgContent, 'image/svg+xml');

    // Check for parsing errors
    const parserError = doc.querySelector('parsererror');
    if (parserError) {
      console.warn('[Security] SVG parsing error during sanitization, falling back to basic string replacement');
      return basicSanitize(svgContent);
    }

    // Recursively clean the DOM
    sanitizeElement(doc.documentElement);

    // Serialize back to string
    const serializer = new XMLSerializer();
    return serializer.serializeToString(doc);
  } catch (error) {
    console.error('[Security] Error during SVG sanitization:', error);
    return basicSanitize(svgContent);
  }
};

/**
 * Recursively removes dangerous elements and attributes from a DOM node.
 */
const sanitizeElement = (element: Element): void => {
  // 1. Remove the element if it's a script tag
  if (element.tagName.toLowerCase() === 'script') {
    element.parentNode?.removeChild(element);
    return;
  }

  // 2. Remove all event handler attributes (on*) and other dangerous ones
  const attributes = Array.from(element.attributes);
  for (const attr of attributes) {
    const attrName = attr.name.toLowerCase();

    // Remove inline event handlers
    if (attrName.startsWith('on')) {
      element.removeAttribute(attr.name);
      continue;
    }

    // Remove javascript: pseudo-protocol in href, xlink:href, etc.
    const attrValue = attr.value.toLowerCase().trim();
    if (attrValue.startsWith('javascript:') || attrValue.includes('javascript:')) {
      element.removeAttribute(attr.name);
      continue;
    }

    // Remove data: URLs that might contain scripts (except for simple image/ ones if needed,
    // but for security we'll be strict here)
    if (attrValue.startsWith('data:') && !attrValue.startsWith('data:image/')) {
       element.removeAttribute(attr.name);
       continue;
    }
  }

  // 3. Process children
  const children = Array.from(element.children);
  for (const child of children) {
    sanitizeElement(child);
  }
};

/**
 * Basic string-based fallback sanitization if DOMParser fails.
 */
const basicSanitize = (content: string): string => {
  return content
    .replace(/<script\b[^>]*>([\s\S]*?)<\/script>/gim, "")
    .replace(/on\w+\s*=\s*"[^"]*"/gim, "")
    .replace(/on\w+\s*=\s*'[^']*'/gim, "")
    .replace(/on\w+\s*=\s*[^\s>]+/gim, "")
    .replace(/javascript:/gim, "no-javascript:");
};
