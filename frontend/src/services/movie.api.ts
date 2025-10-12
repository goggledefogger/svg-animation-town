import { fetchApi } from './api';
import type { AIProviderId } from '@/types/ai';

/**
 * Interface for storyboard scene
 */
export interface StoryboardScene {
  id: string;
  description: string;
  svgPrompt: string;
  duration: number;
  provider?: AIProviderId;
  model?: string;
}

/**
 * Interface for storyboard response
 */
export interface StoryboardResponse {
  title: string;
  description: string;
  scenes: StoryboardScene[];
  aiProvider?: AIProviderId;
  aiModel?: string;
}

/**
 * Custom error for API failures
 */
export class ApiError extends Error {
  status?: number;
  data?: any;

  constructor(message: string, status?: number, data?: any) {
    super(message);
    this.name = 'ApiError';
    this.status = status;
    this.data = data;
  }
}

/**
 * Movie API endpoints for working with storyboards and movies
 */
export const MovieApi = {
  /**
   * Generate a storyboard from a text prompt
   */
  generateStoryboard: async (
    prompt: string,
    options: { provider?: AIProviderId; model?: string } = {},
    numScenes?: number
  ): Promise<StoryboardResponse> => {
    console.log('Generating storyboard with prompt:', prompt);
    console.log('Using AI provider:', options.provider ?? 'default');
    if (options.model) {
      console.log('Using AI model:', options.model);
    }
    console.log('Number of scenes:', numScenes ? numScenes : 'Auto');

    try {
      const payload: Record<string, unknown> = {
        prompt,
        numScenes
      };

      if (options.provider) {
        payload.provider = options.provider;
      }

      if (options.model) {
        payload.model = options.model;
      }

      const data = await fetchApi<any>(
        '/movie/generate-storyboard',
        {
          method: 'POST',
          body: JSON.stringify(payload),
        }
      );

      console.log('Received storyboard data from generate endpoint');

      if (data.success && data.storyboard) {
        // Validate storyboard structure
        if (!data.storyboard.title || !data.storyboard.description || !Array.isArray(data.storyboard.scenes)) {
          const missingFields = [];
          if (!data.storyboard.title) missingFields.push('title');
          if (!data.storyboard.description) missingFields.push('description');
          if (!Array.isArray(data.storyboard.scenes)) missingFields.push('scenes array');

          throw new ApiError(`Invalid storyboard structure. Missing required fields: ${missingFields.join(', ')}`);
        }

        if (options.provider) {
          data.storyboard.aiProvider = data.storyboard.aiProvider || options.provider;
        }
        if (options.model) {
          data.storyboard.aiModel = data.storyboard.aiModel || options.model;
        }

        data.storyboard.scenes = data.storyboard.scenes.map((scene: StoryboardScene) => ({
          ...scene,
          provider: scene.provider ?? options.provider,
          model: scene.model ?? options.model
        }));

        return data.storyboard;
      } else if (data.error) {
        // If the API returns an explicit error message
        throw new ApiError(`API Error: ${data.error}`);
      } else {
        console.error('Invalid response format:', data);
        throw new ApiError('Invalid response format: missing storyboard data', 500, data);
      }
    } catch (error) {
      console.error('Error generating storyboard:', error);

      // If it's already an ApiError, just re-throw it
      if (error instanceof ApiError) {
        throw error;
      }

      // Otherwise wrap in our custom error
      if (error instanceof Error) {
        throw new ApiError(`Storyboard generation failed: ${error.message}`);
      } else {
        throw new ApiError('Unknown error occurred during storyboard generation');
      }
    }
  }
};
