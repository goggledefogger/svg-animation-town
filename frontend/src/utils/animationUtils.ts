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