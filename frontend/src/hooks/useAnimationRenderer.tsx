import React from 'react';
import { SVGElement, Animation } from '../contexts/AnimationContext';

/**
 * Custom hook for rendering SVG animation elements
 */
export const useAnimationRenderer = () => {
  // Function to compute animation styles based on the current time
  const computeAnimationStyles = (element: SVGElement, currentTime: number) => {
    // Debug log to see the element and its animations
    console.log(`Computing styles for element: ${element.id}, type: ${element.type}`);
    console.log('Element attributes:', element.attributes);

    const { animations } = element;
    if (!animations || animations.length === 0) {
      console.log('No animations found for element', element.id);
      return {};
    }

    // Apply animations to the element attributes
    const animatedAttributes: Record<string, string | number> = {};

    animations.forEach(animation => {
      console.log(`Processing animation: ${animation.id}, target property: ${animation.targetProperty}`);
      console.log('Animation keyframes:', animation.keyframes);

      if (currentTime >= animation.delay &&
          (animation.iterationCount === 'infinite' ||
           currentTime < animation.delay + animation.duration * (animation.iterationCount as number))) {

        // Calculate the effective time within the animation duration
        const effectiveTime = (currentTime - animation.delay) % animation.duration;

        // Find the keyframes that surround the current time
        const normalizedTime = effectiveTime / animation.duration; // 0 to 1
        console.log('Normalized time:', normalizedTime);

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

        console.log('Interpolating between frames:',
          {start: startFrame, end: endFrame});

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

        console.log(`Applied value for ${animation.targetProperty}:`,
          animatedAttributes[animation.targetProperty]);
      }
    });

    console.log('Final animated attributes:', animatedAttributes);
    return animatedAttributes;
  };

  // Ensure all attribute values are in the correct format for SVG
  const formatAttributeValues = (props: Record<string, any>): Record<string, any> => {
    const result: Record<string, any> = {};

    for (const [key, value] of Object.entries(props)) {
      if (typeof value === 'number' || typeof value === 'string') {
        result[key] = value;
      } else if (value !== null && value !== undefined) {
        // Convert other types to string
        result[key] = String(value);
      }
    }

    return result;
  };

  // Add default attributes if they're missing
  const addDefaultAttributes = (type: string, props: Record<string, any>): Record<string, any> => {
    const defaults: Record<string, Record<string, any>> = {
      circle: { cx: 400, cy: 300, r: 50, fill: '#ffdf00' },
      rect: { x: 0, y: 0, width: 100, height: 100, fill: '#ffdf00' },
      path: { d: 'M 0 0 L 100 100', fill: '#ffdf00', stroke: 'none' },
      text: { x: 400, y: 300, fontSize: 20, fill: '#ffdf00', textAnchor: 'middle' },
      line: { x1: 0, y1: 0, x2: 100, y2: 100, stroke: '#ffdf00', strokeWidth: 2 },
      group: {}
    };

    const defaultProps = defaults[type as keyof typeof defaults] || {};
    return { ...defaultProps, ...props };
  };

  // Function to render an SVG element based on its type
  const renderElement = (element: SVGElement, currentTime: number) => {
    console.log(`Rendering element: ${element.id} (${element.type}) at time ${currentTime}`);

    try {
      const animationStyles = computeAnimationStyles(element, currentTime);
      const combinedProps = { ...element.attributes, ...animationStyles };

      // Add any missing required attributes and format values
      const formattedProps = formatAttributeValues(
        addDefaultAttributes(element.type, combinedProps)
      );

      console.log('Final formatted props for rendering:', formattedProps);

      // Handle special case for text content
      if (element.type === 'text') {
        const textContent = formattedProps.content || formattedProps.text || '';
        delete formattedProps.content; // Remove content from props
        delete formattedProps.text; // Remove text from props

        return <text key={element.id} {...formattedProps}>{textContent}</text>;
      }

      switch (element.type) {
        case 'circle':
          return <circle key={element.id} {...formattedProps} />;
        case 'rect':
          return <rect key={element.id} {...formattedProps} />;
        case 'path':
          return <path key={element.id} {...formattedProps} />;
        case 'line':
          return <line key={element.id} {...formattedProps} />;
        case 'group':
          return <g key={element.id} {...formattedProps} />;
        default:
          console.warn('Unknown element type:', element.type);
          return null;
      }
    } catch (error) {
      console.error(`Error rendering element ${element.id}:`, error);
      return null;
    }
  };

  return {
    renderElement
  };
};
