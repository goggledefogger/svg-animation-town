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
    // Reduce logging - only log in development or for non-GET requests
    const isGet = !options.method || options.method === 'GET';
    const shouldLogRequest = !isGet || import.meta.env.DEV;

    if (shouldLogRequest) {
      // Simplified logging - only log POST and other non-GET operations
      if (!isGet) console.log(`API ${options.method || 'GET'} request to: ${endpoint}`);
    }

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
      // Only log responses when there are errors
      if (!response.ok) {
        console.log('API error response:', data);
      }
    } else {
      const text = await response.text();
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
        `API error: ${response.status} ${response.statusText}`;

      // Create a custom error object with status code
      const error = new Error(errorMessage) as Error & { status?: number };
      error.status = response.status;
      throw error;
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
  ): Promise<{ svg: string; message: string; animationId?: string }> => {
    // Only log provider choice, not the prompt
    console.log(`Generating animation using ${provider}`);

    try {
      // Set a longer timeout for mobile devices that may have slow connections
      const fetchOptions = {
        method: 'POST',
        body: JSON.stringify({ prompt, provider }),
      };

      // Get timeout value from env or use 5 minutes as default
      const timeoutMs = parseInt(import.meta.env.VITE_REQUEST_TIMEOUT_MS || '300000', 10);

      // Use an AbortController to allow cancellation if it takes too long
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`Request timeout of ${timeoutMs/1000} seconds reached, aborting generation`);
        controller.abort();
      }, timeoutMs);

      // Add the signal to the options
      const optionsWithSignal = {
        ...fetchOptions,
        signal: controller.signal
      };

      try {
        // Call the API with timeout protection
        const data = await fetchApi<any>(
          '/animation/generate',
          optionsWithSignal
        );

        // Clear the timeout if the request completed
        clearTimeout(timeoutId);

        // Handle both new SVG-based responses and legacy element-based responses
        if (data.svg) {
          if (typeof data.svg !== 'string' || !data.svg.includes('<svg')) {
            console.error('Invalid SVG content received');
            throw new CustomApiError('Invalid SVG content received from server');
          }

          // Only log when animation ID is missing
          if (!data.animationId) {
            console.warn('API generate endpoint did not return an animation ID');
          }

          return {
            svg: data.svg,
            message: data.message || 'Animation created successfully!',
            animationId: data.animationId // Include the animation ID if provided by backend
          };
        } else if (data.elements && Array.isArray(data.elements)) {
          console.error('Received legacy element-based response that will not work with the new version');
          throw new CustomApiError('Received legacy element-based response that is not compatible with the current version');
        } else {
          console.error('Invalid response format from animation API:', data);
          throw new CustomApiError('Invalid response format: missing SVG content', 500, data);
        }
      } catch (fetchError) {
        // Clear the timeout if there was an error
        clearTimeout(timeoutId);

        // Handle AbortController errors specifically
        if (fetchError instanceof DOMException && fetchError.name === 'AbortError') {
          console.error('Animation generation request aborted', fetchError);

          // Check if controller.signal.reason exists (added in newer browsers)
          let abortReason = 'Unknown reason';
          try {
            // @ts-ignore - reason property might not exist in older browsers
            if (controller.signal.reason) {
              // @ts-ignore
              abortReason = controller.signal.reason.message || 'Timeout reached';
            }
          } catch (e) {
            // Ignore errors from accessing possibly nonexistent properties
          }

          throw new CustomApiError(`Animation generation aborted: ${abortReason}. This might be due to a timeout after ${timeoutMs/1000} seconds or a server connectivity issue.`, 408);
        }

        // Rethrow the original error
        throw fetchError;
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

/**
 * Animation Storage API endpoints for working with saved animations
 */
export const AnimationStorageApi = {
  /**
   * Save an animation to the server
   */
  saveAnimation: async (
    name: string,
    svgContent: string,
    chatHistory?: any[]
  ): Promise<{ id: string }> => {
    console.log(`Saving animation with name: ${name}`);

    try {
      const data = await fetchApi<any>(
        '/animation/save',
        {
          method: 'POST',
          body: JSON.stringify({
            name,
            svg: svgContent,
            chatHistory
          }),
        }
      );

      if (data.success && data.id) {
        return { id: data.id };
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error saving animation:', error);
      throw error;
    }
  },

  /**
   * List all saved animations
   */
  listAnimations: async (): Promise<any[]> => {
    try {
      const data = await fetchApi<any>('/animation/list');

      if (data.success && Array.isArray(data.animations)) {
        return data.animations;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error listing animations:', error);
      throw error;
    }
  },

  /**
   * Get an animation by ID
   */
  getAnimation: async (id: string): Promise<any> => {
    try {
      const data = await fetchApi<any>(`/animation/${id}`);

      if (data.success && data.animation) {
        return data.animation;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error(`Error getting animation ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete an animation by ID
   */
  deleteAnimation: async (id: string): Promise<boolean> => {
    try {
      const data = await fetchApi<any>(
        `/animation/${id}`,
        { method: 'DELETE' }
      );

      return data.success === true;
    } catch (error) {
      console.error(`Error deleting animation ${id}:`, error);
      throw error;
    }
  }
};

/**
 * Movie Storage API endpoints for working with saved movies/storyboards
 */
export const MovieStorageApi = {
  /**
   * Save a movie/storyboard to the server
   */
  saveMovie: async (storyboard: any): Promise<{ id: string }> => {
    try {
      // Create a deep copy to prevent mutation issues
      const storyboardCopy = JSON.parse(JSON.stringify(storyboard));

      // Ensure clips array is preserved and properly formatted
      if (!storyboardCopy.clips) {
        storyboardCopy.clips = [];
      }

      const data = await fetchApi<any>(
        '/movie/save',
        {
          method: 'POST',
          body: JSON.stringify(storyboardCopy),
        }
      );

      if (data.success && data.id) {
        return { id: data.id };
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error saving storyboard:', error);
      throw error;
    }
  },

  /**
   * List all saved movies/storyboards
   */
  listMovies: async (): Promise<any[]> => {
    try {
      const data = await fetchApi<any>('/movie/list');

      if (data.success && Array.isArray(data.movies)) {
        return data.movies;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error listing storyboards:', error);
      throw error;
    }
  },

  /**
   * Get a movie/storyboard by ID
   */
  getMovie: async (id: string): Promise<any> => {
    try {
      const data = await fetchApi<any>(`/movie/${id}`);

      if (data.success && data.movie) {
        return data.movie;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error(`Error fetching movie with ID ${id}:`, error);
      throw error;
    }
  },

  /**
   * Delete a movie/storyboard
   */
  deleteMovie: async (id: string): Promise<boolean> => {
    try {
      const data = await fetchApi<any>(
        `/movie/${id}`,
        {
          method: 'DELETE',
        }
      );

      return data.success === true;
    } catch (error) {
      console.error(`Error deleting movie with ID ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get animation content for a clip by animation ID
   */
  getClipAnimation: async (animationId: string): Promise<any> => {
    try {
      const data = await fetchApi<any>(`/animation/${animationId}`);

      if (data.success && data.animation) {
        return data.animation;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error(`Error fetching animation with ID ${animationId}:`, error);
      throw error;
    }
  }
};
