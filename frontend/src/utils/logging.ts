/**
 * Logging utility to control debugging output in the application
 */

// Set this to false in production to disable debug logs
const isDebugMode = false;

/**
 * Debug logging utility that only outputs when debug mode is enabled
 * 
 * @param message The primary message to log
 * @param args Additional arguments to log
 */
export const debugLog = (message: string, ...args: any[]): void => {
  if (isDebugMode) {
    console.log(message, ...args);
  }
};

/**
 * Debug warning utility that only outputs when debug mode is enabled
 * 
 * @param message The primary message to log
 * @param args Additional arguments to log
 */
export const debugWarn = (message: string, ...args: any[]): void => {
  if (isDebugMode) {
    console.warn(message, ...args);
  }
};

/**
 * Always logs errors, regardless of debug mode
 * 
 * @param message The primary message to log
 * @param args Additional arguments to log
 */
export const logError = (message: string, ...args: any[]): void => {
  console.error(message, ...args);
}; 