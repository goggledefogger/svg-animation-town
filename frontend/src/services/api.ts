import { SVGElement } from '../contexts/AnimationContext';
import { ApiResponse, ApiError } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Converts hyphenated-style property names to camelCase for React compatibility
 */
function convertToCamelCase(obj: Record<string, any>): Record<string, any> {
  const result: Record<string, any> = {};

  for (const [key, value] of Object.entries(obj)) {
    // Convert hyphenated property to camelCase (e.g., 'stroke-width' to 'strokeWidth')
    const camelKey = key.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
    result[camelKey] = value;
  }

  return result;
}

/**
 * Generic fetch wrapper with error handling
 */
async function fetchApi<T>(
  endpoint: string,
  options: RequestInit = {}
): Promise<T> {
  try {
    console.log(`Making API request to: ${API_URL}${endpoint}`);
    console.log('Request options:', options);

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    const data = await response.json();
    console.log('API response:', data);

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
 * Process elements received from the API to make them compatible with React
 */
function processElements(elements: any[]): SVGElement[] {
  return elements.map(element => {
    // Make a copy of the element to avoid modifying the original
    const processedElement: SVGElement = {
      ...element,
      // Convert attribute keys to camelCase for React compatibility
      attributes: convertToCamelCase(element.attributes || {}),
      // Ensure animations is an array
      animations: element.animations || []
    };

    return processedElement;
  });
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
    console.log('Generating animation with prompt:', prompt);

    try {
      const data = await fetchApi<ApiResponse>('/animation/generate', {
        method: 'POST',
        body: JSON.stringify({ prompt, currentElements }),
      });

      console.log('Received animation data from generate endpoint:', data);

      // Validate the response data
      if (!data.elements || !Array.isArray(data.elements)) {
        console.error('Invalid response: elements is not an array', data);
        throw new Error('Invalid response format: missing elements array');
      }

      console.log('Element count in response:', data.elements.length);

      // Process elements for React compatibility
      const processedElements = processElements(data.elements);
      console.log('Processed elements:', processedElements);

      return {
        elements: processedElements,
        message: data.message,
      };
    } catch (error) {
      console.error('Error generating animation:', error);
      throw error;
    }
  },

  /**
   * Update existing animation based on user prompt
   */
  update: async (
    prompt: string,
    currentElements: SVGElement[]
  ): Promise<{ elements: SVGElement[]; message: string }> => {
    console.log('Updating animation with prompt:', prompt);
    console.log('Current elements:', currentElements);

    try {
      const data = await fetchApi<ApiResponse>('/animation/update', {
        method: 'POST',
        body: JSON.stringify({ prompt, currentElements }),
      });

      console.log('Received updated animation data from update endpoint:', data);

      // Validate the response data
      if (!data.elements || !Array.isArray(data.elements)) {
        console.error('Invalid response: elements is not an array', data);
        throw new Error('Invalid response format: missing elements array');
      }

      console.log('Element count in response:', data.elements.length);

      // Process elements for React compatibility
      const processedElements = processElements(data.elements);
      console.log('Processed elements:', processedElements);

      return {
        elements: processedElements,
        message: data.message,
      };
    } catch (error) {
      console.error('Error updating animation:', error);
      throw error;
    }
  },

  /**
   * Fetch a preset animation
   */
  getPreset: async (
    name: string
  ): Promise<{ elements: SVGElement[]; message: string }> => {
    console.log('Fetching preset:', name);

    try {
      const data = await fetchApi<{ success: boolean; preset: any }>(`/animation/presets/${name}`);

      console.log('Received preset data:', data);

      if (!data.preset || !data.preset.elements || !Array.isArray(data.preset.elements)) {
        console.error('Invalid preset data:', data);
        throw new Error('Invalid preset data format');
      }

      // Process elements for React compatibility
      const processedElements = processElements(data.preset.elements);
      console.log('Processed preset elements:', processedElements);

      return {
        elements: processedElements,
        message: data.preset.message,
      };
    } catch (error) {
      console.error('Error fetching preset:', error);
      throw error;
    }
  }
};
