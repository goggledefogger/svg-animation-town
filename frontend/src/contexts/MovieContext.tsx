import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect, useRef } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { Message } from './AnimationContext';
import { StoryboardResponse, StoryboardScene } from '../services/movie.api';
import { AnimationApi, MovieStorageApi } from '../services/api';

// Define movie clip interface
export interface MovieClip {
  id: string;
  name: string;
  svgContent: string;
  duration: number;
  order: number;
  prompt?: string;
  chatHistory?: Message[];
  animationId?: string; // Reference to saved animation ID in backend storage
  createdAt?: Date;     // When the clip was created
  provider?: 'openai' | 'claude'; // Which AI provider was used to generate the clip
}

// Define storyboard interface
export interface Storyboard {
  id: string;
  name: string;
  description: string;
  clips: MovieClip[];
  createdAt: Date;
  updatedAt: Date;
  // AI provider used for generation
  aiProvider?: 'openai' | 'claude';
  // Store original scenes from the storyboard response
  originalScenes?: any[];
  // Generation status for in-progress movies
  generationStatus?: {
    inProgress: boolean;
    completedScenes: number;
    totalScenes: number;
    startedAt?: Date;
    completedAt?: Date;
  };
}

// Storage key for local storage
const STORYBOARD_STORAGE_KEY = 'svg-animator-storyboards';

// Default empty storyboard
const defaultStoryboard: Storyboard = {
  id: uuidv4(),
  name: 'New Movie',
  description: '',
  clips: [],
  createdAt: new Date(),
  updatedAt: new Date()
};

// Interface for animation data passed from parent
export interface AnimationData {
  svgContent: string;
  chatHistory: Message[];
  generateAnimation?: (prompt: string) => Promise<any>;
  setSvgContent?: (svgContent: string) => void;
  setChatHistory?: (chatHistory: Message[]) => void;
}

// MovieContext interface
interface MovieContextType {
  // Storyboard data
  currentStoryboard: Storyboard;
  savedStoryboards: string[];
  activeClipId: string | null;
  activeClip: MovieClip | null;

  // Storyboard state setter
  setCurrentStoryboard: React.Dispatch<React.SetStateAction<Storyboard>>;

  // Storyboard management
  createNewStoryboard: (name?: string, description?: string) => void;
  renameStoryboard: (name: string) => void;
  updateStoryboardDescription: (description: string) => void;
  saveStoryboard: () => Promise<boolean>;
  loadStoryboard: (storyboardId: string) => Promise<boolean>;
  getSavedStoryboards: () => Promise<string[]>;
  deleteStoryboard: (storyboardId: string) => Promise<boolean>;

  // Clip management
  addClip: (clip: Omit<MovieClip, 'id' | 'order'>) => string;
  saveCurrentAnimationAsClip: (name: string) => string | null;
  updateClip: (clipId: string, updates: Partial<Omit<MovieClip, 'id'>> & { order?: number }) => void;
  removeClip: (clipId: string) => void;
  reorderClips: (clipIds: string[]) => void;

  // Active clip management
  setActiveClipId: (clipId: string | null) => void;
  getActiveClip: () => MovieClip | null;

  // Playback control
  isPlaying: boolean;
  setIsPlaying: (playing: boolean) => void;
  currentPlaybackPosition: number;
  setCurrentPlaybackPosition: (position: number) => void;

  // Export
  exportStoryboard: (format: 'json' | 'svg') => void;

  // Storyboard generation
  createStoryboardFromResponse: (storyboardResponse: StoryboardResponse) => Promise<Storyboard>;
}

// Create context
const MovieContext = createContext<MovieContextType | undefined>(undefined);

// Context provider component
interface MovieProviderProps {
  children: ReactNode;
  animationData: AnimationData;
}

export const MovieProvider: React.FC<MovieProviderProps> = ({ children, animationData }) => {
  // Define props coming from animation data
  const { svgContent, chatHistory, generateAnimation } = animationData;

  // Destructure additional functions needed from the parent component
  // The parent is expected to pass setSvgContent and setChatHistory functions
  const setSvgContent = animationData.setSvgContent || (() => {});
  const setChatHistory = animationData.setChatHistory || (() => {});

  // Storyboard state
  const [currentStoryboard, setCurrentStoryboard] = useState<Storyboard>(defaultStoryboard);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [activeClip, setActiveClip] = useState<MovieClip | null>(null);
  const [savedStoryboards, setSavedStoryboards] = useState<string[]>([]);

  // Caching mechanism to avoid redundant API calls
  const animationListCache = useRef<{timestamp: number, animations: string[]} | null>(null);
  const notFoundMovieIds = useRef<Set<string>>(new Set());

  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPlaybackPosition, setCurrentPlaybackPosition] = useState(0);

  // Load saved storyboard list on mount
  useEffect(() => {
    const storedStoryboardIds = getSavedStoryboardsFromStorage();
    setSavedStoryboards(storedStoryboardIds);
  }, []);

  // Clear server not-found cache on component mount
  useEffect(() => {
    notFoundMovieIds.current = new Set();
  }, []);

  // Get all saved storyboard IDs from local storage
  const getSavedStoryboardsFromStorage = (): string[] => {
    try {
      const allStoryboards = localStorage.getItem(STORYBOARD_STORAGE_KEY);
      if (!allStoryboards) return [];

      const storyboardMap = JSON.parse(allStoryboards) as Record<string, Storyboard>;
      return Object.keys(storyboardMap);
    } catch (error) {
      console.error('Error loading saved storyboards:', error);
      return [];
    }
  };

  /**
   * Get saved storyboards from the server
   */
  const getSavedStoryboards = useCallback(async () => {
    try {
      // Try to fetch from server first
      let updatedSavedStoryboards: Record<string, Storyboard> = {};

      try {
        console.log('Fetching storyboards from server...');
        const serverStoryboards = await MovieStorageApi.listMovies();

        console.log(`Received ${serverStoryboards.length} storyboards from server`);

        // Convert to record format
        updatedSavedStoryboards = serverStoryboards.reduce((acc, storyboard) => {
          acc[storyboard.id] = storyboard;
          return acc;
        }, {} as Record<string, Storyboard>);

        // Check for force refresh flag and clear it if present
        const forceRefresh = sessionStorage.getItem('force_server_refresh') === 'true';
        if (forceRefresh) {
          sessionStorage.removeItem('force_server_refresh');
          console.log('Forced server refresh requested - using server data only for movies');
          const serverIds = serverStoryboards.map(sb => sb.id);
          setSavedStoryboards(serverIds);
          return serverIds;
        }
      } catch (error) {
        console.error('Error fetching storyboards from server:', error);
        // Will fall back to localStorage
      }

      // Also try to get from localStorage as fallback or to merge with server data
      try {
        const localIds = getSavedStoryboardsFromStorage();

        // Get local storyboards data
        const localStoryboards = JSON.parse(localStorage.getItem(STORYBOARD_STORAGE_KEY) || '{}');

        // Merge local and server storyboards
        const mergedStoryboards = { ...updatedSavedStoryboards };

        // Add local storyboards that aren't in the server data
        localIds.forEach(id => {
          if (!mergedStoryboards[id] && localStoryboards[id]) {
            mergedStoryboards[id] = localStoryboards[id];
          }
        });

        // Update saved storyboards list with merged IDs
        const mergedIds = Object.keys(mergedStoryboards);
        setSavedStoryboards(mergedIds);

        return mergedIds;
      } catch (localError) {
        console.error('Error getting storyboards from local storage:', localError);
      }

      // If we get here, there was an error with both server and local storage
      // Return an empty array to maintain the return type
      return [];
    } catch (error) {
      console.error('Error getting saved storyboards:', error);
      return [];
    }
  }, []);

  // Save storyboard to server, with local cache as fallback
  const saveStoryboard = useCallback(() => {
    return new Promise<boolean>(async (resolve) => {
      try {
        // Update storyboard with current date
        const updatedStoryboard = {
          ...currentStoryboard,
          updatedAt: new Date()
        };

        // Try to save to server first - no longer need the try/catch here
        // since we're using setTimeout with its own error handling
        setTimeout(async () => {
          try {
            const result = await MovieStorageApi.saveMovie(updatedStoryboard);
            console.log('Storyboard saved to server with ID:', result.id);

            // Update the storyboard with the server ID if needed
            if (updatedStoryboard.id !== result.id) {
              setCurrentStoryboard(prev => ({
                ...prev,
                id: result.id
              }));
            }
          } catch (serverError) {
            console.error('Error saving storyboard to server:', serverError);
          }
        }, 0);

        // Also update local cache
        try {
          // Get existing storyboards
          const storyboardsString = localStorage.getItem(STORYBOARD_STORAGE_KEY);
          const storyboards: Record<string, Storyboard> = storyboardsString
            ? JSON.parse(storyboardsString)
            : {};

          // Save updated storyboard
          storyboards[updatedStoryboard.id] = updatedStoryboard;
          localStorage.setItem(STORYBOARD_STORAGE_KEY, JSON.stringify(storyboards));

          // Update saved storyboards list with IDs from local cache
          const localIds = Object.keys(storyboards);
          setSavedStoryboards(prevIds => [...new Set([...prevIds, ...localIds])]);
        } catch (localError) {
          console.error('Error saving storyboard to local cache:', localError);
        }

        // Also update current storyboard state
        setCurrentStoryboard(updatedStoryboard);

        console.log('Storyboard saved with', updatedStoryboard.clips.length, 'clips');

        // Refresh the storyboard list to ensure we have the latest from both server and local
        // Use setTimeout to move this outside the render cycle
        setTimeout(() => {
          getSavedStoryboards().catch(err => {
            console.error('Error refreshing storyboard list after save:', err);
          });
        }, 0);

        resolve(true);
      } catch (error) {
        console.error('Error saving storyboard:', error);
        resolve(false);
      }
    });
  }, [currentStoryboard, getSavedStoryboards]);

  // Create a new storyboard
  const createNewStoryboard = useCallback((name?: string, description?: string) => {
    const newStoryboard: Storyboard = {
      id: uuidv4(),
      name: name || 'New Movie',
      description: description || '',
      clips: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setCurrentStoryboard(newStoryboard);
    setActiveClipId(null);
    setActiveClip(null);
  }, []);

  // Rename current storyboard
  const renameStoryboard = useCallback((name: string) => {
    setCurrentStoryboard(prev => ({
      ...prev,
      name,
      updatedAt: new Date()
    }));
  }, []);

  // Update storyboard description
  const updateStoryboardDescription = useCallback((description: string) => {
    setCurrentStoryboard(prev => ({
      ...prev,
      description,
      updatedAt: new Date()
    }));
  }, []);

  // Update a clip
  const updateClip = useCallback((clipId: string, updates: Partial<Omit<MovieClip, 'id'>> & { order?: number }) => {
    setCurrentStoryboard(prev => {
      const clipIndex = prev.clips.findIndex(clip => clip.id === clipId);
      if (clipIndex === -1) return prev;

      const updatedClips = [...prev.clips];
      updatedClips[clipIndex] = {
        ...updatedClips[clipIndex],
        ...updates
      };

      return {
        ...prev,
        clips: updatedClips,
        updatedAt: new Date()
      };
    });
  }, []);

  /**
   * Validate clip data and ensure animation references are valid
   */
  const validateMovieClips = useCallback((clips: MovieClip[]): MovieClip[] => {
    if (!clips || !Array.isArray(clips)) {
      console.warn('No clips array provided for validation');
      return [];
    }

    console.log(`[Validation] Validating ${clips.length} clips`);

    // Check for clips with missing animation IDs
    const missingAnimationIds = clips.filter(clip => !clip.animationId);
    if (missingAnimationIds.length > 0) {
      console.warn(`[Validation] Found ${missingAnimationIds.length} clips missing animation IDs`);
      missingAnimationIds.forEach(clip => {
        console.warn(`[Validation] Clip ${clip.id} (order: ${clip.order}) missing animation ID`);
      });
    }

    // Verify SVG content sync with animation IDs
    const svgMismatches = clips.filter(clip =>
      clip.animationId &&
      (!clip.svgContent || clip.svgContent.length < 100)
    );

    if (svgMismatches.length > 0) {
      console.warn(`[Validation] Found ${svgMismatches.length} clips with animation IDs but missing/invalid SVG content`);
    }

    // Ensure clip orders are sequential and unique
    const orders = clips.map(clip => clip.order).sort((a, b) => a - b);
    const expectedOrders = Array.from({ length: orders.length }, (_, i) => i);

    const orderGaps = expectedOrders.filter(order => !orders.includes(order));
    if (orderGaps.length > 0) {
      console.warn(`[Validation] Found gaps in clip order sequence: missing orders ${orderGaps.join(', ')}`);
    }

    // Check for duplicate orders
    const orderCounts = new Map<number, number>();
    orders.forEach(order => {
      orderCounts.set(order, (orderCounts.get(order) || 0) + 1);
    });

    const duplicateOrders = Array.from(orderCounts.entries())
      .filter(([_, count]) => count > 1)
      .map(([order, _]) => order);

    if (duplicateOrders.length > 0) {
      console.warn(`[Validation] Found duplicate clip orders: ${duplicateOrders.join(', ')}`);
    }

    // Return the validated clips - for now we're just logging issues
    return clips;
  }, []);

  // Load storyboard from API or local storage
  const loadStoryboard = useCallback(async (storyboardId: string) => {
    console.log(`Attempting to load storyboard with ID: ${storyboardId} from server`);

    try {
      const response = await MovieStorageApi.getMovie(storyboardId);

      if (!response || !response.success || !response.movie) {
        console.error(`Storyboard with ID ${storyboardId} not found on server`);
        return false;
      }

      // Get the movie data from the API response
      const { movie } = response;

      const storyboard: Storyboard = {
        id: movie.id,
        name: movie.name,
        description: movie.description || '',
        clips: Array.isArray(movie.clips) ? movie.clips : [],
        createdAt: new Date(movie.createdAt),
        updatedAt: new Date(movie.updatedAt),
        // Preserve AI provider and original scenes for resumption
        aiProvider: movie.aiProvider,
        originalScenes: movie.originalScenes,
        // Copy generation status from server
        generationStatus: movie.generationStatus ? {
          ...movie.generationStatus,
          startedAt: movie.generationStatus.startedAt ? new Date(movie.generationStatus.startedAt) : undefined,
          completedAt: movie.generationStatus.completedAt ? new Date(movie.generationStatus.completedAt) : undefined
        } : undefined
      };

      // Log generation status for debugging
      if (storyboard.generationStatus?.inProgress) {
        console.log(`Loading in-progress movie: ${storyboard.name} (${storyboard.id})`, storyboard.generationStatus);
      }

      // Validate and synchronize clips if needed
      if (storyboard.clips && storyboard.clips.length > 0) {
        // Validate clips for integrity
        storyboard.clips = validateMovieClips(storyboard.clips);

        // Sort clips by order to ensure correct sequence
        storyboard.clips.sort((a, b) => a.order - b.order);

        // Begin loading clip animations in background
        const clipLoadPromises = storyboard.clips
          .filter(clip => clip.animationId && (!clip.svgContent || clip.svgContent.length < 100))
          .map(async (clip) => {
            if (!clip.animationId) return;

            console.log(`[ClipSync] Loading animation content for clip ${clip.id}, animation ID: ${clip.animationId}`);

            try {
              const animation = await MovieStorageApi.getClipAnimation(clip.animationId);
              if (animation && animation.svg) {
                // Update clip with animation content
                console.log(`[ClipSync] Successfully loaded animation for clip ${clip.id}`);

                updateClip(clip.id, {
                  svgContent: animation.svg,
                  chatHistory: animation.chatHistory
                });
              }
            } catch (err) {
              console.error(`[ClipSync] Failed to load animation for clip ${clip.id}:`, err);
            }
          });

        // Don't await these promises - let them load in the background
        // Just fire and forget, the UI will update as they complete
        Promise.all(clipLoadPromises)
          .then(() => console.log('[ClipSync] Completed background loading of clip animations'))
          .catch(err => console.error('[ClipSync] Error in background clip loading:', err));
      }

      // Update the current storyboard state
      setCurrentStoryboard(storyboard);

      // If there are clips, set the first one as active
      if (storyboard.clips && storyboard.clips.length > 0) {
        setActiveClipId(storyboard.clips[0].id);
      } else {
        setActiveClipId(null);
      }

      console.log(`Loaded storyboard from server: ${storyboard.name}`);
      return true;
    } catch (error) {
      console.error(`Error loading storyboard ${storyboardId}:`, error);
      return false;
    }
  }, [updateClip, validateMovieClips]);

  // Delete a storyboard from server and local storage
  const deleteStoryboard = useCallback(async (storyboardId: string) => {
    try {
      // Try to delete from server
      let serverDeleteSuccess = false;
      try {
        serverDeleteSuccess = await MovieStorageApi.deleteMovie(storyboardId);
      } catch (serverError) {
        console.warn('Error deleting storyboard from server:', serverError);
      }

      // Also delete from local storage
      let localDeleteSuccess = false;
      try {
        const storyboardsString = localStorage.getItem(STORYBOARD_STORAGE_KEY);
        if (storyboardsString) {
          const storyboards = JSON.parse(storyboardsString) as Record<string, Storyboard>;

          if (storyboards[storyboardId]) {
            // Delete the storyboard
            delete storyboards[storyboardId];
            localStorage.setItem(STORYBOARD_STORAGE_KEY, JSON.stringify(storyboards));

            // Update saved storyboards list
            setSavedStoryboards(Object.keys(storyboards));
            localDeleteSuccess = true;
          }
        }
      } catch (localError) {
        console.error('Error deleting storyboard from local storage:', localError);
      }

      // If current storyboard was deleted, create a new one
      if ((serverDeleteSuccess || localDeleteSuccess) && currentStoryboard.id === storyboardId) {
        createNewStoryboard();
      }

      return serverDeleteSuccess || localDeleteSuccess;
    } catch (error) {
      console.error('Error deleting storyboard:', error);
      return false;
    }
  }, [createNewStoryboard, currentStoryboard.id]);

  // Add a new clip to the storyboard
  const addClip = useCallback((clip: Omit<MovieClip, 'id' | 'order'>) => {
    const newClipId = uuidv4();

    setCurrentStoryboard(prev => {
      const order = prev.clips.length; // Add to the end
      const newClip: MovieClip = {
        ...clip,
        id: newClipId,
        order
      };

      return {
        ...prev,
        clips: [...prev.clips, newClip],
        updatedAt: new Date()
      };
    });

    return newClipId;
  }, []);

  // Save current animation as a clip
  const saveCurrentAnimationAsClip = useCallback((name: string) => {
    if (!svgContent) return null;

    // Extract prompt from chat history - find the most recent user message
    let prompt = '';
    if (chatHistory && chatHistory.length > 0) {
      // Find the most recent user message to use as prompt
      for (let i = chatHistory.length - 1; i >= 0; i--) {
        if (chatHistory[i].sender === 'user') {
          prompt = chatHistory[i].text;
          break;
        }
      }
    }

    const newClipId = addClip({
      name,
      svgContent,
      duration: 5, // Default duration in seconds
      prompt,
      chatHistory
    });

    return newClipId;
  }, [addClip, svgContent, chatHistory]);

  // Remove a clip
  const removeClip = useCallback((clipId: string) => {
    setCurrentStoryboard(prev => {
      const updatedClips = prev.clips.filter(clip => clip.id !== clipId);

      // Re-assign orders to ensure sequential ordering
      const reorderedClips = updatedClips.map((clip, index) => ({
        ...clip,
        order: index
      }));

      return {
        ...prev,
        clips: reorderedClips,
        updatedAt: new Date()
      };
    });

    // If the active clip was removed, select the first clip or null
    if (activeClipId === clipId) {
      setActiveClipId(currentStoryboard.clips.length > 1 ? currentStoryboard.clips[0].id : null);
    }
  }, [activeClipId, currentStoryboard.clips]);

  // Reorder clips based on array of clip IDs
  const reorderClips = useCallback((clipIds: string[]) => {
    setCurrentStoryboard(prev => {
      // Create a map of IDs to clips for quick lookup
      const clipMap = new Map(prev.clips.map(clip => [clip.id, clip]));

      // Create new clips array with updated order
      const reorderedClips = clipIds.map((id, index) => {
        const clip = clipMap.get(id);
        if (!clip) throw new Error(`Clip with ID ${id} not found`);

        return {
          ...clip,
          order: index
        };
      });

      return {
        ...prev,
        clips: reorderedClips,
        updatedAt: new Date()
      };
    });
  }, []);

  // Get active clip
  const getActiveClip = useCallback(() => {
    if (!activeClipId) return null;
    return currentStoryboard.clips.find(clip => clip.id === activeClipId) || null;
  }, [activeClipId, currentStoryboard.clips]);

  // Export storyboard
  const exportStoryboard = useCallback((format: 'json' | 'svg') => {
    if (format === 'json') {
      // Export as JSON
      const jsonData = JSON.stringify(currentStoryboard, null, 2);
      const blob = new Blob([jsonData], { type: 'application/json' });
      const url = URL.createObjectURL(blob);
      const a = document.createElement('a');
      a.href = url;
      a.download = `${currentStoryboard.name.replace(/\s+/g, '_')}_storyboard.json`;
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      URL.revokeObjectURL(url);
    } else if (format === 'svg') {
      // Export as a single SVG with all animations
      // This is more complex and would need to combine all SVGs with proper timing
      console.warn('SVG export not yet implemented');
      // TODO: Implement SVG export
    }
  }, [currentStoryboard]);

  // Create a storyboard from an LLM-generated response
  const createStoryboardFromResponse = useCallback(async (storyboardResponse: StoryboardResponse): Promise<Storyboard> => {
    // Create a new storyboard with the title and description from the response
    const newStoryboard: Storyboard = {
      id: uuidv4(),
      name: storyboardResponse.title || 'New Movie',
      description: storyboardResponse.description || '',
      clips: [],
      createdAt: new Date(),
      updatedAt: new Date()
    };

    setCurrentStoryboard(newStoryboard);

    // Generate clips for each scene in the storyboard
    const scenePromises = storyboardResponse.scenes.map(async (scene, index) => {
      try {
        // Use the generate function from animationData if available, otherwise fall back to AnimationApi
        console.log(`Generating SVG for scene ${index + 1}: ${scene.id}`);
        const generateFn = generateAnimation || AnimationApi.generate;
        const generatedSvg = await generateFn(scene.svgPrompt);

        // Create a new clip with the generated SVG
        const newClip: MovieClip = {
          id: uuidv4(),
          name: `Scene ${index + 1}: ${scene.id}`,
          svgContent: generatedSvg.svg,
          duration: scene.duration || 5,
          order: index,
          prompt: scene.svgPrompt,
          chatHistory: [{
            id: uuidv4(),
            sender: 'user',
            text: scene.svgPrompt,
            timestamp: new Date()
          }, {
            id: uuidv4(),
            sender: 'ai',
            text: generatedSvg.message,
            timestamp: new Date()
          }],
          animationId: generatedSvg.animationId,
          createdAt: new Date(),
          provider: scene.provider
        };

        // Log if an animation ID was returned from the backend
        if (generatedSvg.animationId) {
          console.log(`Scene ${index + 1} saved on server with animation ID: ${generatedSvg.animationId}`);
        } else {
          console.warn(`No animation ID for scene ${index + 1}, animation may not be saved on server`);
        }

        return newClip;
      } catch (error) {
        console.error(`Error generating SVG for scene ${scene.id}:`, error);
        // Return a placeholder clip for failed scenes
        return {
          id: uuidv4(),
          name: `Scene ${index + 1}: ${scene.id} (Failed)`,
          svgContent: createErrorSvg(scene.description),
          duration: scene.duration || 5,
          order: index,
          prompt: scene.svgPrompt,
          createdAt: new Date(),
          provider: scene.provider
        };
      }
    });

    try {
      // Wait for all scene SVGs to be generated
      const generatedClips = await Promise.all(scenePromises);

      // Update the storyboard with the generated clips
      const updatedStoryboard = {
        ...newStoryboard,
        clips: generatedClips,
        updatedAt: new Date()
      };

      setCurrentStoryboard(updatedStoryboard);
      setActiveClipId(generatedClips[0]?.id || null);
      if (generatedClips.length > 0) {
        setActiveClip(generatedClips[0]);
      } else {
        setActiveClip(null);
      }

      // Save the storyboard
      saveStoryboard();

      return updatedStoryboard;
    } catch (error) {
      console.error('Error creating storyboard from response:', error);
      return newStoryboard;
    }
  }, [generateAnimation, saveStoryboard]);

  // Create an error SVG for failed clip generation
  const createErrorSvg = (description: string): string => {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
      <rect width="800" height="600" fill="#1a1a2e" />
      <circle cx="400" cy="250" r="60" fill="#ffdf00" />
      <text x="400" y="400" font-family="Arial" font-size="24" fill="white" text-anchor="middle">
        Scene Generation Failed
      </text>
      <text x="400" y="440" font-family="Arial" font-size="16" fill="#cccccc" text-anchor="middle" width="600">
        ${description}
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
  };

  // Set active clip
  const updateActiveClipId = useCallback((id: string | null) => {
    // Prevent duplicate updates for the same clip ID
    if (id === activeClipId) {
      return;
    }

    // Set active clip ID in state
    setActiveClipId(id);

    // Find the active clip
    const activeClipObj = id ? currentStoryboard.clips.find(clip => clip.id === id) : null;

    // Update the activeClip state
    setActiveClip(activeClipObj || null);

    // Dispatch event after state updates to ensure proper order
    setTimeout(() => {
      window.dispatchEvent(new CustomEvent('clip-changed', {
        detail: {
          clipId: id,
          clip: activeClipObj
        }
      }));
    }, 0);
  }, [currentStoryboard.clips, activeClipId]);

  // Provide context values
  const contextValue: MovieContextType = {
    currentStoryboard,
    savedStoryboards,
    activeClipId,
    activeClip,
    setCurrentStoryboard,
    createNewStoryboard,
    renameStoryboard,
    updateStoryboardDescription,
    saveStoryboard,
    loadStoryboard,
    getSavedStoryboards,
    deleteStoryboard,
    addClip,
    saveCurrentAnimationAsClip,
    updateClip,
    removeClip,
    reorderClips,
    setActiveClipId: updateActiveClipId,
    getActiveClip,
    isPlaying,
    setIsPlaying,
    currentPlaybackPosition,
    setCurrentPlaybackPosition,
    exportStoryboard,
    createStoryboardFromResponse
  };

  return (
    <MovieContext.Provider value={contextValue}>
      {children}
    </MovieContext.Provider>
  );
};

// Custom hook to use movie context
export const useMovie = (): MovieContextType => {
  const context = useContext(MovieContext);
  if (context === undefined) {
    throw new Error('useMovie must be used within a MovieProvider');
  }
  return context;
};
