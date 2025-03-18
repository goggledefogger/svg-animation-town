/**
 * Utility functions for device detection
 */

/**
 * Checks if the current device is a mobile device based on user agent or screen size
 * @returns {boolean} True if the device is a mobile device
 */
export function isMobileDevice(): boolean {
  return /Android|webOS|iPhone|iPad|iPod|BlackBerry|IEMobile|Opera Mini/i.test(navigator.userAgent) ||
    (window.innerWidth <= 768);
}

/**
 * Checks if the current page load is a fresh load (not a return from another tab)
 * @returns {boolean} True if this is a fresh page load
 */
export function isFreshPageLoad(): boolean {
  const hasJustLoaded = sessionStorage.getItem('page_just_loaded');
  // Set flag to identify this as a loaded page
  sessionStorage.setItem('page_just_loaded', 'true');
  // If the flag wasn't there, this is a fresh load
  return !hasJustLoaded;
}
