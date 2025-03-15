import { SVGElement } from '../contexts/AnimationContext';
import { ApiResponse, ApiError } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    const data = await response.json();

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error: any) {
    console.error('API Error:', error);
    throw new Error(`API Error: ${error.message}`);
  }
}

/**
 * Animation API endpoints
 */
export const AnimationApi = {
  /**
   * Generate animation based on user prompt
   */
  generate: async (
    prompt: string,
    currentElements: SVGElement[] = []
  ): Promise<{ elements: SVGElement[]; message: string }> => {
    const data = await fetchApi<ApiResponse>('/animation/generate', {
      method: 'POST',
      body: JSON.stringify({ prompt, currentElements }),
    });

    return {
      elements: data.elements,
      message: data.message,
    };
  },

  /**
   * Update existing animation based on user prompt
   */
  update: async (
    prompt: string,
    currentElements: SVGElement[]
  ): Promise<{ elements: SVGElement[]; message: string }> => {
    const data = await fetchApi<ApiResponse>('/animation/update', {
      method: 'POST',
      body: JSON.stringify({ prompt, currentElements }),
    });

    return {
      elements: data.elements,
      message: data.message,
    };
  },

  /**
   * Fetch a preset animation
   */
  getPreset: async (
    name: string
  ): Promise<{ elements: SVGElement[]; message: string }> => {
    const data = await fetchApi<{ success: boolean; preset: any }>(`/animation/presets/${name}`);

    return {
      elements: data.preset.elements,
      message: data.preset.message,
    };
  }
};
