/**
 * Animation utilities for consistent handling of SVG animations
 */

/**
 * Resets animation state for consistent playback
 * @param element The SVG element containing animations
 */
export function resetAnimations(element: SVGElement): void {
  if (!element) return;

  console.log('[Animation] Resetting animations - simplified method');

  try {
    // First pause all animations
    pauseAllAnimations(element);

    // For SMIL animations, reset to time 0
    try {
      // Access current time and set to 0
      const svg = element as any;
      if (typeof svg.setCurrentTime === 'function') {
        svg.setCurrentTime(0);
      }

      // Also set begin attribute to 0s on each SMIL animation element
      const smilElements = element.querySelectorAll('animate, animateTransform, animateMotion');
      smilElements.forEach(animation => {
        animation.setAttribute('begin', '0s');
        animation.removeAttribute('end');
      });
    } catch (e) {
      console.error('[Animation] Error resetting SMIL animations:', e);
    }

    // For CSS animations, restart by toggling animation property
    try {
      // Find all elements with CSS animations
      const allElements = element.querySelectorAll('*');
      allElements.forEach(el => {
        if (el instanceof SVGElement && el.style) {
          // Get computed style to check for animations
          const computedStyle = window.getComputedStyle(el);
          const hasAnimation = computedStyle.animationName && computedStyle.animationName !== 'none';

          if (hasAnimation || el.style.animation) {
            // Remember the original animation value
            const originalAnimation = el.style.animation || computedStyle.animation;

            // Toggle animation off
            el.style.animation = 'none';

            // Force reflow
            void (el as unknown as HTMLElement).offsetWidth;

            // Toggle animation back on
            if (originalAnimation) {
              el.style.animation = originalAnimation;
            } else {
              el.style.removeProperty('animation');
            }
          }
        }
      });
    } catch (e) {
      console.error('[Animation] Error resetting CSS animations:', e);
    }

    // After resetting, resume all animations
    resumeAllAnimations(element);

    console.log('[Animation] Reset completed and animations resumed');
  } catch (e) {
    console.error('[Animation] Error during animation reset:', e);
  }
}

/**
 * Gets the appropriate playback state based on context
 * @param isAnimationEditor Whether we're in animation editor mode
 * @param playing Playing state from animation context
 * @param moviePlaying Playing state from movie context
 * @returns The playback state ('running' or 'paused')
 */
export function getPlaybackState(
  isAnimationEditor: boolean,
  playing: boolean,
  moviePlaying: boolean
): 'running' | 'paused' {
  return (isAnimationEditor ? playing : moviePlaying) ? 'running' : 'paused';
}

/**
 * Enhances a prompt with duration guidance if not already present
 * @param prompt The original prompt
 * @param duration The target duration in seconds
 * @returns The enhanced prompt with duration guidance
 */
export function addDurationGuidance(prompt: string, duration: number): string {
  if (!prompt || prompt.includes('duration') || prompt.includes('seconds')) {
    return prompt;
  }

  return `${prompt}\n\nIMPORTANT: Create an animation that completes in approximately ${duration} seconds.`;
}

/**
 * Pauses all animations in an SVG element (simple implementation)
 * @param element The SVG element containing animations
 */
export function pauseAllAnimations(element: SVGElement): void {
  if (!element) return;

  try {
    // Pause SMIL animations
    (element as any).pauseAnimations();

    // Pause CSS animations
    const allElements = element.querySelectorAll('*');
    allElements.forEach(el => {
      if (el instanceof SVGElement && el.style) {
        el.style.animationPlayState = 'paused';
      }
    });

    console.log('[Animation] Paused all animations');
  } catch (e) {
    console.error('[Animation] Error pausing animations:', e);
  }
}

/**
 * Resumes all animations in an SVG element (simple implementation)
 * @param element The SVG element containing animations
 */
export function resumeAllAnimations(element: SVGElement): void {
  if (!element) return;

  try {
    // Resume SMIL animations
    (element as any).unpauseAnimations();

    // Resume CSS animations
    const allElements = element.querySelectorAll('*');
    allElements.forEach(el => {
      if (el instanceof SVGElement && el.style) {
        el.style.animationPlayState = 'running';
      }
    });

    console.log('[Animation] Resumed all animations');
  } catch (e) {
    console.error('[Animation] Error resuming animations:', e);
  }
}

/**
 * Toggles animation playback state without resetting the animation
 * This function is specifically designed to pause/resume animations in place
 * @param element The SVG element containing animations
 * @param playState The desired playback state ('running' or 'paused')
 */
export function setAnimationPlaybackState(element: SVGElement, playState: 'running' | 'paused'): void {
  if (!element) return;

  try {
    // Handle SMIL animations
    if (playState === 'running') {
      // Resume animations without resetting
      (element as any).unpauseAnimations();
    } else {
      // Pause animations in place
      (element as any).pauseAnimations();
    }

    // Handle CSS animations
    // We need to find all elements with animations from multiple sources:

    // 1. Elements with inline style animation properties
    const elementsWithInlineStyle = element.querySelectorAll('[style*="animation"]');
    elementsWithInlineStyle.forEach(el => {
      if (el instanceof SVGElement && el.style) {
        el.style.animationPlayState = playState;
      }
    });

    // 2. Elements with animations defined in stylesheet
    try {
      const allElements = element.querySelectorAll('*');
      allElements.forEach(el => {
        if (el instanceof SVGElement) {
          // Check for animations via computed style
          const computedStyle = window.getComputedStyle(el);
          if (computedStyle.animationName && computedStyle.animationName !== 'none') {
            el.style.animationPlayState = playState;
          }
        }
      });
    } catch (e) {
      console.error('[Animation] Error handling stylesheet animations:', e);
    }

    // 3. For keyframes defined in a style element, find elements by ID or class
    const styleElement = element.querySelector('style');
    if (styleElement && styleElement.textContent) {
      const styleContent = styleElement.textContent;

      // Find IDs in style blocks with animation properties
      const animatedElementIds = Array.from(styleContent.matchAll(/#([a-zA-Z0-9_-]+)[^{]*{[^}]*animation[^}]*}/g))
        .map(match => match[1]);

      // Also find class-based animations
      const animatedClassSelectors = Array.from(styleContent.matchAll(/\.([a-zA-Z0-9_-]+)[^{]*{[^}]*animation[^}]*}/g))
        .map(match => match[1]);

      // Apply to elements with IDs
      animatedElementIds.forEach(id => {
        const animatedEl = element.ownerDocument.getElementById(id);
        if (animatedEl && animatedEl instanceof SVGElement) {
          animatedEl.style.animationPlayState = playState;
        }
      });

      // Apply to elements with classes
      animatedClassSelectors.forEach(className => {
        const classElements = element.getElementsByClassName(className);
        Array.from(classElements).forEach(el => {
          if (el instanceof SVGElement) {
            el.style.animationPlayState = playState;
          }
        });
      });
    }

    console.log(`[Animation] Set playback state: ${playState} for all animations`);
  } catch (e) {
    console.error(`[Animation] Error setting playback state to ${playState}:`, e);
  }
}

/**
 * Central animation controller that provides cohesive control over all SVG animations
 * This is the single source of truth for animation playback state
 */
export interface AnimationControlOptions {
  playState?: 'running' | 'paused';
  shouldReset?: boolean;
  playbackSpeed?: number | 'groovy';
  initialSetup?: boolean;
}

/**
 * Unified controller for all SVG animations (both SMIL and CSS)
 * @param element The SVG element containing animations
 * @param options Control options including play state, reset, and speed
 */
export function controlAnimations(element: SVGElement, options: AnimationControlOptions): void {
  if (!element) return;

  const {
    playState = 'running',
    shouldReset = false,
    playbackSpeed = 1,
    initialSetup = false
  } = options;

  console.log(`[Animation] Controlling animations: ${JSON.stringify({
    playState,
    shouldReset,
    speed: playbackSpeed,
    initialSetup
  })}`);

  try {
    // 1. Reset animations if requested (resets to time 0)
    if (shouldReset) {
      // First pause to ensure consistent state during reset
      (element as any).pauseAnimations();

      // For SMIL animations, reset to time 0
      try {
        // Access current time and set to 0
        const svg = element as any;
        if (typeof svg.setCurrentTime === 'function') {
          svg.setCurrentTime(0);
        }

        // Also set begin attribute to 0s on each SMIL animation element
        const smilElements = element.querySelectorAll('animate, animateTransform, animateMotion');
        smilElements.forEach(animation => {
          animation.setAttribute('begin', '0s');
          animation.removeAttribute('end');
        });
      } catch (e) {
        console.error('[Animation] Error resetting SMIL animations:', e);
      }

      // For CSS animations, restart by toggling animation property
      try {
        // Find all elements with CSS animations
        const allElements = element.querySelectorAll('*');
        allElements.forEach(el => {
          if (el instanceof SVGElement && el.style) {
            // Get computed style to check for animations
            const computedStyle = window.getComputedStyle(el);
            const hasAnimation = computedStyle.animationName && computedStyle.animationName !== 'none';

            if (hasAnimation || el.style.animation) {
              // Remember the original animation value
              const originalAnimation = el.style.animation || computedStyle.animation;

              // Toggle animation off
              el.style.animation = 'none';

              // Force reflow
              void (el as unknown as HTMLElement).offsetWidth;

              // Toggle animation back on
              if (originalAnimation) {
                el.style.animation = originalAnimation;
              } else {
                el.style.removeProperty('animation');
              }
            }
          }
        });
      } catch (e) {
        console.error('[Animation] Error resetting CSS animations:', e);
      }
    }

    // 2. Control SMIL animations playback state
    if (playState === 'running') {
      (element as any).unpauseAnimations();
    } else {
      (element as any).pauseAnimations();
    }

    // 3. Handle CSS animations (from multiple sources)

    // 3.1 Get speed value
    const isReverse = typeof playbackSpeed === 'number' && playbackSpeed < 0;
    const speedValue = typeof playbackSpeed === 'number' ? Math.abs(playbackSpeed) : 1;

    // Get CSS animations from style element
    const styleElement = element.querySelector('style');
    if (styleElement && styleElement.textContent) {
      const styleContent = styleElement.textContent;

      // Find IDs in style blocks with animation properties
      const animatedElementIds = Array.from(styleContent.matchAll(/#([a-zA-Z0-9_-]+)[^{]*{[^}]*animation[^}]*}/g))
        .map(match => match[1]);

      // Find class-based animations
      const animatedClassSelectors = Array.from(styleContent.matchAll(/\.([a-zA-Z0-9_-]+)[^{]*{[^}]*animation[^}]*}/g))
        .map(match => match[1]);

      // Apply to elements with IDs
      animatedElementIds.forEach(id => {
        const animatedEl = element.ownerDocument.getElementById(id);
        if (animatedEl && animatedEl instanceof SVGElement) {
          // Set playback state
          animatedEl.style.animationPlayState = playState;

          // Set speed and direction if relevant
          if (playbackSpeed !== 'groovy') {
            // Set animation direction
            animatedEl.style.animationDirection = isReverse ? 'reverse' : 'normal';

            // Only adjust duration if resetting or doing initial setup
            if (shouldReset || initialSetup) {
              console.log(`[Animation Debug] Modifying animation duration because shouldReset=${shouldReset} or initialSetup=${initialSetup}`);
              animatedEl.style.animationDuration = `calc(var(--animation-duration, 1s) / ${speedValue})`;
            }
          }
        }
      });

      // Apply to elements with classes
      animatedClassSelectors.forEach(className => {
        const classElements = element.getElementsByClassName(className);
        Array.from(classElements).forEach(el => {
          if (el instanceof SVGElement) {
            // Set playback state
            el.style.animationPlayState = playState;

            // Set speed and direction if relevant
            if (playbackSpeed !== 'groovy') {
              // Set animation direction
              el.style.animationDirection = isReverse ? 'reverse' : 'normal';

              // Only adjust duration if resetting or doing initial setup
              if (shouldReset || initialSetup) {
                console.log(`[Animation Debug] Modifying animation duration because shouldReset=${shouldReset} or initialSetup=${initialSetup}`);
                el.style.animationDuration = `calc(var(--animation-duration, 1s) / ${speedValue})`;
              }
            }
          }
        });
      });
    }

    // 3.2 Handle elements with inline style animation
    const elementsWithInlineStyle = element.querySelectorAll('[style*="animation"]');
    elementsWithInlineStyle.forEach(el => {
      if (el instanceof SVGElement) {
        // Set playback state
        el.style.animationPlayState = playState;

        // Set speed and direction if relevant
        if (playbackSpeed !== 'groovy') {
          // Set animation direction
          el.style.animationDirection = isReverse ? 'reverse' : 'normal';

          // Only adjust duration if resetting or doing initial setup
          if (shouldReset || initialSetup) {
            console.log(`[Animation Debug] Modifying animation duration because shouldReset=${shouldReset} or initialSetup=${initialSetup}`);
            const currentDuration = window.getComputedStyle(el).animationDuration;
            if (currentDuration && currentDuration !== '0s') {
              const durationInS = parseFloat(currentDuration);
              const newDuration = durationInS / speedValue;
              el.style.animationDuration = `${newDuration}s`;
            }
          }
        }
      }
    });

    // 3.3 Handle all other elements with animations in stylesheet
    try {
      const allElements = element.querySelectorAll('*');
      allElements.forEach(el => {
        if (el instanceof SVGElement) {
          // Check for animations via computed style
          const computedStyle = window.getComputedStyle(el);
          if (computedStyle.animationName && computedStyle.animationName !== 'none') {
            // Set playback state
            el.style.animationPlayState = playState;

            // Set speed and direction if relevant
            if (playbackSpeed !== 'groovy') {
              // Set animation direction
              el.style.animationDirection = isReverse ? 'reverse' : 'normal';

              // Only adjust duration if resetting or doing initial setup
              if (shouldReset || initialSetup) {
                console.log(`[Animation Debug] Modifying animation duration because shouldReset=${shouldReset} or initialSetup=${initialSetup}`);
                const currentDuration = computedStyle.animationDuration;
                if (currentDuration && currentDuration !== '0s') {
                  const durationInS = parseFloat(currentDuration);
                  const newDuration = durationInS / speedValue;
                  el.style.animationDuration = `${newDuration}s`;
                }
              }
            }
          }
        }
      });
    } catch (e) {
      console.error('[Animation] Error handling stylesheet animations:', e);
    }

    console.log(`[Animation] Animation control applied with state: ${playState}`);
  } catch (e) {
    console.error('[Animation] Error controlling animations:', e);
  }
}
