import { ApiResponse, ApiError } from '../types/api';
import { ApiError as CustomApiError } from './movie.api';
import { Storyboard } from '../contexts/MovieContext';
import { GLOBAL_ANIMATION_REGISTRY, AnimationRegistryHelpers } from '../hooks/useAnimationLoader';
import { Message } from '../contexts/AnimationContext';

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
   * Generate a new SVG animation with movie context data
   * This will allow the backend to update the movie JSON file directly
   */
  generateWithMovieContext: async (
    prompt: string,
    provider: 'openai' | 'claude' = 'openai',
    movieContext: {
      storyboardId: string;
      sceneIndex: number;
      sceneCount: number;
      sceneDuration?: number;
      sceneDescription?: string;
    }
  ): Promise<{
    svg: string;
    message: string;
    animationId?: string;
    movieUpdateStatus?: {
      storyboardId: string;
      clipId: string;
      sceneIndex: number;
      completedScenes: number;
      totalScenes: number;
      inProgress: boolean;
    }
  }> => {
    try {
      // Set a longer timeout for movie generation
      const timeoutMs = parseInt(import.meta.env.VITE_REQUEST_TIMEOUT_MS || '300000', 10);

      // Use an AbortController to allow cancellation if it takes too long
      const controller = new AbortController();
      const timeoutId = setTimeout(() => {
        console.log(`Request timeout of ${timeoutMs/1000} seconds reached, aborting generation`);
        controller.abort();
      }, timeoutMs);

      try {
        // Call the API with timeout protection and movie context
        const data = await fetchApi<any>(
          '/movie/generate-scene',
          {
            method: 'POST',
            body: JSON.stringify({
              prompt,
              provider,
              movieContext
            }),
            signal: controller.signal
          }
        );

        // Clear the timeout
        clearTimeout(timeoutId);

        // Handle the response
        if (data.svg) {
          return {
            svg: data.svg,
            message: data.message || 'Animation created successfully!',
            animationId: data.animationId,
            movieUpdateStatus: data.movieUpdateStatus,
          };
        } else {
          throw new Error('Invalid response: missing SVG content');
        }
      } catch (fetchError) {
        // Clear the timeout if there was an error
        clearTimeout(timeoutId);
        throw fetchError;
      }
    } catch (error) {
      console.error('Error generating animation with movie context:', error);

      // Create a fallback error SVG
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
    console.log('Current SVG length:', currentSvg?.length || 0);

    if (!currentSvg || currentSvg.length < 10 || !currentSvg.includes('<svg')) {
      console.error('Invalid current SVG provided for update:',
                   currentSvg ? currentSvg.substring(0, 50) + '...' : 'null or empty');
      throw new Error('Cannot update animation: No valid SVG content to modify');
    }

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
        console.log('Received updated SVG length:', data.svg.length);

        // Compare input and output SVGs to detect if they're identical
        const isSvgIdentical = data.svg === currentSvg;
        if (isSvgIdentical) {
          console.warn('The received SVG is identical to the current SVG. The update may not have worked correctly.');
        } else {
          console.log('SVG content has changed - update successful');
        }

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
   * Save a movie to the server (via backend API)
   */
  saveMovie: async (storyboard: Storyboard): Promise<{id: string, movie?: Storyboard, success: boolean, message: string}> => {
    try {
      // Basic validation to ensure we're not missing required fields
      if (!storyboard.id) {
        throw new Error('Storyboard ID is required');
      }

      // Validate clip data before sending to server
      if (storyboard.clips && Array.isArray(storyboard.clips)) {
        // Log each clip and identify potential issues
        const clipIssues = storyboard.clips
          .map((clip, index) => {
            const hasAnimationId = !!clip.animationId;
            const hasSvgContent = !!clip.svgContent && clip.svgContent.length > 100;

            const issue = !hasAnimationId
              ? `Clip ${index} (id: ${clip.id}, order: ${clip.order}) missing animation ID`
              : !hasSvgContent
                ? `Clip ${index} (id: ${clip.id}, order: ${clip.order}) has animation ID ${clip.animationId} but missing SVG content`
                : null;

            if (issue) {
              console.warn(`[API] Movie validation issue: ${issue}`);
              return issue;
            }
            return null;
          })
          .filter(Boolean);

        if (clipIssues.length > 0) {
          console.warn(`[API] Found ${clipIssues.length} issues with clips before saving to server`);
        }

        // Check for gaps in clip ordering
        const orders = storyboard.clips.map(clip => clip.order).sort((a, b) => a - b);
        for (let i = 0; i < orders.length - 1; i++) {
          if (orders[i+1] - orders[i] > 1) {
            console.warn(`[API] Found gap in clip order sequence: ${orders[i]} to ${orders[i+1]}`);
          }
        }
      }

      // Convert dates to ISO strings if they're Date objects
      const preparedStoryboard = {
        ...storyboard,
        createdAt: storyboard.createdAt instanceof Date ? storyboard.createdAt.toISOString() : storyboard.createdAt,
        updatedAt: storyboard.updatedAt instanceof Date ? storyboard.updatedAt.toISOString() : storyboard.updatedAt,
        generationStatus: storyboard.generationStatus ? {
          ...storyboard.generationStatus,
          startedAt: storyboard.generationStatus.startedAt instanceof Date
            ? storyboard.generationStatus.startedAt.toISOString()
            : storyboard.generationStatus.startedAt,
          completedAt: storyboard.generationStatus.completedAt instanceof Date
            ? storyboard.generationStatus.completedAt.toISOString()
            : storyboard.generationStatus.completedAt
        } : storyboard.generationStatus
      };

      const response = await fetchApi<any>(
        '/movie/save',
        {
          method: 'POST',
          body: JSON.stringify(preparedStoryboard),
        }
      );

      console.log(`[API] Movie ${preparedStoryboard.id} saved successfully (ai: ${preparedStoryboard.aiProvider || 'unknown'}, clips: ${preparedStoryboard.clips?.length || 0})`);

      return {
        id: response.id || storyboard.id,
        movie: response.movie,
        success: true,
        message: response.message || 'Storyboard saved successfully'
      };
    } catch (error) {
      console.error('Error saving movie:', error);
      throw error;
    }
  },

  /**
   * List all movies from the server (via backend API)
   */
  listMovies: async (): Promise<Storyboard[]> => {
    try {
      const data = await fetchApi<any>('/movie/list');

      if (data.success && Array.isArray(data.movies)) {
        return data.movies;
      } else {
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error('Error listing movies:', error);
      throw error;
    }
  },

  /**
   * Get movie data by ID from server
   * @param id Movie ID
   * @returns Movie data or null if not found
   */
  getMovie: async (id: string): Promise<{ success: boolean; movie: Storyboard } | null> => {
    try {
      console.log(`Fetching movie with ID: ${id} from server`);
      const data = await fetchApi<any>(`/movie/${id}`);

      if (data.success && data.movie) {
        // Log details about the loaded storyboard, specifically focusing on clips
        console.log(`Successfully loaded movie '${data.movie.name}' (ID: ${id}) from server`);
        console.log(`Movie clip data:`, {
          clipCount: data.movie.clips?.length || 0,
          hasClips: Array.isArray(data.movie.clips) && data.movie.clips.length > 0,
          clipDetails: Array.isArray(data.movie.clips) ?
            data.movie.clips.map((clip: any, index: number) => ({
              index,
              id: clip.id,
              name: clip.name,
              hasContent: !!clip.svgContent,
              contentLength: clip.svgContent?.length || 0,
              hasAnimationId: !!clip.animationId,
              order: clip.order
            })) : 'No clips'
        });

        // If no clips found, this might be a server-side issue
        if (!data.movie.clips || data.movie.clips.length === 0) {
          console.warn(`Movie '${data.movie.name}' has no clips. This might indicate a server-side issue.`);
          if (data.movie.generationStatus?.completedScenes > 0) {
            console.warn(`Generation status shows ${data.movie.generationStatus.completedScenes} completed scenes but no clips found!`);
          }
        }

        return {
          success: true,
          movie: data.movie
        };
      } else {
        console.error(`Invalid response when loading movie ${id}:`, data);
        throw new Error('Invalid response from server');
      }
    } catch (error) {
      console.error(`Error getting movie ${id}:`, error);
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
        { method: 'DELETE' }
      );

      return data.success === true;
    } catch (error) {
      console.error(`Error deleting movie with ID ${id}:`, error);
      throw error;
    }
  },

  /**
   * Get a clip animation from the server by ID
   * @param animationId The animation ID to fetch
   * @returns The animation object or null if not found
   */
  getClipAnimation: async (animationId: string): Promise<{ id: string; svg: string; chatHistory?: Message[]; timestamp?: string } | null> => {
    if (!animationId) {
      console.error('Animation ID is required');
      return null;
    }

    // First check if it's already in the registry
    const registryCheck = AnimationRegistryHelpers.getAnimation(animationId);
    if (registryCheck.status === 'available' && registryCheck.svg) {
      console.log(`[API] Using cached animation from registry: ${animationId} (${registryCheck.svg.length} bytes)`);
      return {
        id: animationId,
        svg: registryCheck.svg,
        chatHistory: registryCheck.metadata?.chatHistory,
        timestamp: registryCheck.metadata?.timestamp
      };
    }

    // Register this animation as loading
    AnimationRegistryHelpers.markLoading(animationId);

    // Create a unique request ID for this animation load
    const requestId = `clip-animation-${animationId}`;

    try {
      // Use the registry to track this request and prevent duplicates
      return await AnimationRegistryHelpers.trackRequest(requestId, (async () => {
        try {
          // Directly use the regular animation endpoint - simpler and more reliable
          const animData = await AnimationStorageApi.getAnimation(animationId);

          if (animData && animData.svg) {
            // Store in registry for future use
            AnimationRegistryHelpers.storeAnimation(animationId, animData.svg, {
              name: animData.name,
              timestamp: animData.timestamp
            });

            console.log(`[API] Successfully fetched animation ${animationId}: ${animData.svg.length} bytes`);

            // Dispatch an event to notify any interested components
            window.dispatchEvent(new CustomEvent('animation-loaded', {
              detail: {
                animationId,
                svg: animData.svg
              }
            }));

            return {
              id: animationId,
              svg: animData.svg,
              chatHistory: animData.chatHistory,
              timestamp: animData.timestamp
            };
          }

          console.error(`Animation ${animationId} not found or invalid`);
          AnimationRegistryHelpers.markFailed(animationId);
          return null;
        } catch (error) {
          console.error(`Error fetching animation ${animationId}:`, error);
          AnimationRegistryHelpers.markFailed(animationId);
          return null;
        }
      })());
    } catch (error) {
      console.error(`Error fetching animation ${animationId}:`, error);
      AnimationRegistryHelpers.markFailed(animationId);
      return null;
    }
  },

  /**
   * Get a clip animation from the global registry (synchronous)
   * @param animationId The animation ID to check
   * @returns The animation object or null if not in registry
   */
  getClipAnimationFromRegistry: (animationId: string): { id: string; svg: string } | null => {
    if (!animationId) return null;

    // Check the global registry
    const registryCheck = AnimationRegistryHelpers.getAnimation(animationId);
    if (registryCheck.status === 'available' && registryCheck.svg) {
      return {
        id: animationId,
        svg: registryCheck.svg
      };
    }

    return null;
  }
};
