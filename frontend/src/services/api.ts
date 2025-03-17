import { ApiResponse, ApiError } from '../types/api';
import { ApiError as CustomApiError } from './movie.api';

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
export async function fetchApi<T>(
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

    // Dispatch API call end event
    dispatchApiCallEvent(false);

    // Parse the response
    let data;
    const contentType = response.headers.get('content-type');
    if (contentType && contentType.includes('application/json')) {
      data = await response.json();
      console.log('API response:', data);
    } else {
      const text = await response.text();
      console.log('API text response:', text.substring(0, 200) + (text.length > 200 ? '...' : ''));
      try {
        // Try to parse it as JSON anyway
        data = JSON.parse(text);
      } catch (e) {
        // If it's not JSON, create an object with the text
        data = { text };
      }
    }

    if (!response.ok) {
      // Get a more detailed error message from the response if possible
      const errorMessage =
        data.error ||
        data.message ||
        data.text ||
        `Server returned ${response.status}: ${response.statusText}`;

      throw new CustomApiError(
        errorMessage,
        response.status,
        data
      );
    }

    return data;
  } catch (error: any) {
    // Ensure API call end event is dispatched even on error
    dispatchApiCallEvent(false);

    console.error('API Error:', error);

    // If it's already our custom API error, just rethrow
    if (error instanceof CustomApiError) {
      throw error;
    }

    // Otherwise, wrap in our custom error
    throw new CustomApiError(
      `API Error: ${error.message}`,
      error.status || 500
    );
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
    console.log('Generating animation with prompt:', prompt.substring(0, 100) + (prompt.length > 100 ? '...' : ''));
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
        if (typeof data.svg !== 'string' || !data.svg.includes('<svg')) {
          console.error('Invalid SVG content received:', typeof data.svg);
          console.error('SVG preview:', data.svg?.substring(0, 100));
          throw new CustomApiError('Invalid SVG content received from server');
        }

        return {
          svg: data.svg,
          message: data.message || 'Animation created successfully!'
        };
      } else if (data.elements && Array.isArray(data.elements)) {
        console.error('Received legacy element-based response that will not work with the new version');
        throw new CustomApiError('Received legacy element-based response that is not compatible with the current version');
      } else {
        console.error('Invalid response format from animation API:', data);
        throw new CustomApiError('Invalid response format: missing SVG content', 500, data);
      }
    } catch (error) {
      console.error('Error generating animation:', error);

      // Create a fallback error SVG to show the error message to the user
      const errorMessage = error instanceof Error ? error.message : 'Unknown error';
      const errorSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
        <rect width="800" height="600" fill="#1a1a2e" />
        <circle cx="400" cy="200" r="50" fill="#e63946" />
        <text x="400" y="320" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
          Error Generating Animation
        </text>
        <text x="400" y="360" font-family="Arial" font-size="16" fill="#cccccc" text-anchor="middle" width="700">
          ${errorMessage.replace(/</g, '&lt;').replace(/>/g, '&gt;')}
        </text>
        <text x="400" y="400" font-family="Arial" font-size="14" fill="#999999" text-anchor="middle">
          Please try again with a different prompt
        </text>
      </svg>`;

      return {
        svg: errorSvg,
        message: `Error: ${errorMessage}`
      };
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
