/**
 * Generate a unique ID for elements and animations
 */
export const generateId = (): string => {
  return Math.random().toString(36).substr(2, 9);
};

/**
 * Format milliseconds to a readable time string (mm:ss.ms)
 */
export const formatTime = (ms: number): string => {
  const minutes = Math.floor(ms / 60000);
  const seconds = Math.floor((ms % 60000) / 1000);
  const milliseconds = Math.floor((ms % 1000) / 10);

  return `${minutes.toString().padStart(2, '0')}:${seconds.toString().padStart(2, '0')}.${milliseconds.toString().padStart(2, '0')}`;
};

/**
 * Interpolate a value at a specific point in time based on keyframes
 */
export const interpolateValue = (
  keyframes: Array<{ offset: number; value: string | number }>,
  time: number,
  duration: number
): string | number => {
  // Calculate the current normalized time (0 to 1)
  const normalizedTime = Math.max(0, Math.min(1, time / duration));

  // Find the keyframes before and after the current time
  let startFrame = keyframes[0];
  let endFrame = keyframes[keyframes.length - 1];

  for (let i = 0; i < keyframes.length - 1; i++) {
    if (normalizedTime >= keyframes[i].offset && normalizedTime <= keyframes[i + 1].offset) {
      startFrame = keyframes[i];
      endFrame = keyframes[i + 1];
      break;
    }
  }

  // If we're at the exact offset of a keyframe, return its value
  if (normalizedTime === startFrame.offset) {
    return startFrame.value;
  }

  // Calculate how far we are between the two keyframes (0 to 1)
  const frameDuration = endFrame.offset - startFrame.offset;
  const progressInFrame = frameDuration === 0 ? 0 : (normalizedTime - startFrame.offset) / frameDuration;

  // Interpolate between the values
  if (typeof startFrame.value === 'number' && typeof endFrame.value === 'number') {
    return startFrame.value + (endFrame.value - startFrame.value) * progressInFrame;
  }

  // For non-numeric values (like colors or transforms), we just use the start or end value
  return progressInFrame < 0.5 ? startFrame.value : endFrame.value;
};
