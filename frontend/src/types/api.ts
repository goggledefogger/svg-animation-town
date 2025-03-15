import { SVGElement } from '../contexts/AnimationContext';

/**
 * Standard API response format
 */
export interface ApiResponse {
  success: boolean;
  elements: SVGElement[];
  message: string;
}

/**
 * Error response format
 */
export interface ApiError {
  success: false;
  message: string;
  error?: string;
}
