import { ApiResponse, ApiError } from '../types/api';

const API_URL = import.meta.env.VITE_API_URL || 'http://localhost:3001/api';

/**
 * Dispatch API call events for loading animations
 */
function dispatchApiCallEvent(isStarting: boolean) {
  const eventName = isStarting ? 'api-call-start' : 'api-call-end';
  window.dispatchEvent(new CustomEvent(eventName));
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

    // Dispatch API call start event
    dispatchApiCallEvent(true);

    const response = await fetch(`${API_URL}${endpoint}`, {
      headers: {
        'Content-Type': 'application/json',
      },
      ...options,
    });

    const data = await response.json();
    console.log('API response:', data);

    // Dispatch API call end event
    dispatchApiCallEvent(false);

    if (!response.ok) {
      throw new Error(data.message || 'Something went wrong');
    }

    return data;
  } catch (error: any) {
    // Ensure API call end event is dispatched even on error
    dispatchApiCallEvent(false);

    console.error('API Error:', error);
    throw new Error(`API Error: ${error.message}`);
  }
}

/**
 * Animation API endpoints for working with SVG animations
 */
export const AnimationApi = {
  /**
   * Generate a new SVG animation based on user prompt
   */
  generate: async (
    prompt: string,
    provider: 'openai' | 'claude' = 'openai'
  ): Promise<{ svg: string; message: string }> => {
    console.log('Generating animation with prompt:', prompt);
    console.log('Using AI provider:', provider);

    try {
      const data = await fetchApi<any>(
        '/animation/generate',
        {
          method: 'POST',
          body: JSON.stringify({ prompt, provider }),
        }
      );

      console.log('Received animation data from generate endpoint');

      // Handle both new SVG-based responses and legacy element-based responses
      if (data.svg) {
        return {
          svg: data.svg,
          message: data.message || 'Animation created successfully!'
        };
      } else if (data.elements && Array.isArray(data.elements)) {
        console.warn('Received legacy element-based response. Using fallback error SVG.');
        return {
          svg: createFallbackSvg('Legacy element response received. Please update backend.'),
          message: data.message || 'Animation created successfully (legacy format).'
        };
      } else {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format: missing SVG and elements');
      }
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
    currentSvg: string,
    provider: 'openai' | 'claude' = 'openai'
  ): Promise<{ svg: string; message: string }> => {
    console.log('Updating animation with prompt:', prompt);
    console.log('Using AI provider:', provider);

    try {
      const data = await fetchApi<any>(
        '/animation/update',
        {
          method: 'POST',
          body: JSON.stringify({ prompt, currentSvg, provider }),
        }
      );

      console.log('Received animation data from update endpoint');

      // Handle both new SVG-based responses and legacy element-based responses
      if (data.svg) {
        return {
          svg: data.svg,
          message: data.message || 'Animation updated successfully!'
        };
      } else if (data.elements && Array.isArray(data.elements)) {
        console.warn('Received legacy element-based response. Using fallback error SVG.');
        return {
          svg: createFallbackSvg('Legacy element response received. Please update backend.'),
          message: data.message || 'Animation updated successfully (legacy format).'
        };
      } else {
        console.error('Invalid response format:', data);
        throw new Error('Invalid response format: missing SVG and elements');
      }
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
  ): Promise<{ svg: string; message: string }> => {
    console.log('Fetching preset:', name);

    try {
      const data = await fetchApi<any>(
        `/animation/presets/${name}`
      );

      console.log('Received preset data:', data);

      // Handle both SVG-based and element-based preset responses
      if (data.preset && data.preset.svg) {
        return {
          svg: data.preset.svg,
          message: data.preset.message || `Preset "${name}" loaded successfully!`
        };
      } else if (data.preset && data.preset.elements && Array.isArray(data.preset.elements)) {
        console.warn('Received legacy element-based preset. Using fallback error SVG.');
        return {
          svg: createFallbackSvg(`Legacy preset "${name}" received. Please update backend.`),
          message: data.preset.message || `Preset "${name}" loaded (legacy format).`
        };
      } else {
        console.error('Invalid preset data format:', data);
        throw new Error('Invalid preset data format');
      }
    } catch (error) {
      console.error('Error fetching preset:', error);
      throw error;
    }
  }
};

/**
 * Create a fallback SVG for when we receive legacy responses
 */
function createFallbackSvg(message: string): string {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <rect width="800" height="600" fill="#1a1a2e" />
    <circle cx="400" cy="250" r="60" fill="#ffdf00" />
    <text x="400" y="400" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
      SVG Conversion Required
    </text>
    <text x="400" y="440" font-family="Arial" font-size="16" fill="#cccccc" text-anchor="middle" width="600">
      ${message}
    </text>
    <style>
      @keyframes pulse {
        0% { r: 60; }
        50% { r: 70; }
        100% { r: 60; }
      }
      circle {
        animation: pulse 2s ease-in-out infinite;
      }
    </style>
  </svg>`;
}
