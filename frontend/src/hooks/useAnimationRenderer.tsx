import React from 'react';
import { SVGElement, Animation } from '../contexts/AnimationContext';

/**
 * Custom hook for rendering SVG animation elements
 */
export const useAnimationRenderer = () => {
  // Function to compute animation styles based on the current time
  const computeAnimationStyles = (element: SVGElement, currentTime: number) => {
    const { animations } = element;
    if (!animations || animations.length === 0) {
      return {};
    }

    // Apply animations to the element attributes
    const animatedAttributes: Record<string, string | number> = {};

    animations.forEach(animation => {
      if (currentTime >= animation.delay &&
          (animation.iterationCount === 'infinite' ||
           currentTime < animation.delay + animation.duration * (animation.iterationCount as number))) {

        // Calculate the effective time within the animation duration
        const effectiveTime = (currentTime - animation.delay) % animation.duration;

        // Find the keyframes that surround the current time
        const normalizedTime = effectiveTime / animation.duration; // 0 to 1

        // Find the keyframes that surround the current normalized time
        let startFrame = animation.keyframes[0];
        let endFrame = animation.keyframes[animation.keyframes.length - 1];

        for (let i = 0; i < animation.keyframes.length - 1; i++) {
          if (
            normalizedTime >= animation.keyframes[i].offset &&
            normalizedTime <= animation.keyframes[i + 1].offset
          ) {
            startFrame = animation.keyframes[i];
            endFrame = animation.keyframes[i + 1];
            break;
          }
        }

        // Interpolate between the start and end frames
        const segmentDuration = endFrame.offset - startFrame.offset;
        const segmentProgress = segmentDuration === 0
          ? 0
          : (normalizedTime - startFrame.offset) / segmentDuration;

        // Apply the interpolated value to the target property
        const startValue = startFrame.value;
        const endValue = endFrame.value;

        // Handle numeric values
        if (typeof startValue === 'number' && typeof endValue === 'number') {
          animatedAttributes[animation.targetProperty] =
            startValue + (endValue - startValue) * segmentProgress;
        }
        // Handle string values (like colors or paths)
        else {
          // For simplicity, just transition from start to end
          // In a full implementation, this would parse and interpolate values
          animatedAttributes[animation.targetProperty] =
            segmentProgress < 0.5 ? startValue : endValue;
        }
      }
    });

    return animatedAttributes;
  };

  // Function to render an SVG element based on its type
  const renderElement = (element: SVGElement, currentTime: number) => {
    const animationStyles = computeAnimationStyles(element, currentTime);
    const combinedProps = { ...element.attributes, ...animationStyles };

    switch (element.type) {
      case 'circle':
        return <circle key={element.id} {...combinedProps} />;
      case 'rect':
        return <rect key={element.id} {...combinedProps} />;
      case 'path':
        return <path key={element.id} {...combinedProps} />;
      case 'text':
        return <text key={element.id} {...combinedProps}>{combinedProps.content || ''}</text>;
      case 'line':
        return <line key={element.id} {...combinedProps} />;
      case 'group':
        return <g key={element.id} {...combinedProps} />;
      default:
        return null;
    }
  };

  return {
    renderElement
  };
};
