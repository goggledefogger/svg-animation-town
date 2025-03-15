/**
 * Types for the SVG animation system
 */

// SVG element types supported by the application
export type SVGElementType =
  | 'circle'
  | 'rect'
  | 'ellipse'
  | 'line'
  | 'path'
  | 'polygon'
  | 'polyline'
  | 'text';

// Properties that can be animated
export interface KeyframeProperties {
  [key: string]: number | string | boolean;
}

// A keyframe in an animation
export interface Keyframe {
  time: number;
  properties: KeyframeProperties;
}

// Animation definition
export interface Animation {
  keyframes: Keyframe[];
  duration?: number;
  easing?: string;
}

// SVG element definition
export interface SVGElement {
  id: string;
  type: SVGElementType;
  properties: KeyframeProperties;
  animation?: Animation;
}

// Animation project
export interface AnimationProject {
  id: string;
  name: string;
  elements: SVGElement[];
  duration: number;
  width: number;
  height: number;
  background?: string;
}
