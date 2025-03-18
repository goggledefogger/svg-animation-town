import React, { createContext, useContext, useState, ReactNode, useCallback, useEffect } from 'react';
import { v4 as uuidv4 } from 'uuid';
import { useAnimation, Message } from './AnimationContext';
import { StoryboardResponse, StoryboardScene } from '../services/movie.api';
import { AnimationApi } from '../services/api';

// Define movie clip interface
export interface MovieClip {
  id: string;
  name: string;
  svgContent: string;
  duration: number;
  order: number;
  prompt?: string;
  chatHistory?: Message[];
}

// Define storyboard interface
export interface Storyboard {
  id: string;
  name: string;
  description: string;
  clips: MovieClip[];
  createdAt: Date;
  updatedAt: Date;
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

// MovieContext interface
interface MovieContextType {
  // Storyboard data
  currentStoryboard: Storyboard;
  savedStoryboards: string[];
  activeClipId: string | null;

  // Storyboard state setter
  setCurrentStoryboard: React.Dispatch<React.SetStateAction<Storyboard>>;

  // Storyboard management
  createNewStoryboard: (name?: string, description?: string) => void;
  renameStoryboard: (name: string) => void;
  updateStoryboardDescription: (description: string) => void;
  saveStoryboard: () => Promise<boolean>;
  loadStoryboard: (storyboardId: string) => boolean;
  getSavedStoryboards: () => string[];
  deleteStoryboard: (storyboardId: string) => boolean;

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
export const MovieProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  // Get animation context for interacting with current animation
  const { svgContent, chatHistory } = useAnimation();

  // Storyboard state
  const [currentStoryboard, setCurrentStoryboard] = useState<Storyboard>(defaultStoryboard);
  const [activeClipId, setActiveClipId] = useState<string | null>(null);
  const [savedStoryboards, setSavedStoryboards] = useState<string[]>([]);

  // Playback state
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentPlaybackPosition, setCurrentPlaybackPosition] = useState(0);

  // Load saved storyboard list on mount
  useEffect(() => {
    const storedStoryboardIds = getSavedStoryboardsFromStorage();
    setSavedStoryboards(storedStoryboardIds);
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

  // Save storyboard to local storage
  const saveStoryboard = useCallback(() => {
    return new Promise<boolean>((resolve) => {
      try {
        // Get existing storyboards
        const storyboardsString = localStorage.getItem(STORYBOARD_STORAGE_KEY);
        const storyboards: Record<string, Storyboard> = storyboardsString
          ? JSON.parse(storyboardsString)
          : {};

        // Update storyboard with current date
        const updatedStoryboard = {
          ...currentStoryboard,
          updatedAt: new Date()
        };

        // Save updated storyboard
        storyboards[updatedStoryboard.id] = updatedStoryboard;
        localStorage.setItem(STORYBOARD_STORAGE_KEY, JSON.stringify(storyboards));

        // Update saved storyboards list
        setSavedStoryboards(Object.keys(storyboards));

        // Also update current storyboard state
        setCurrentStoryboard(updatedStoryboard);

        console.log('Storyboard saved successfully with', updatedStoryboard.clips.length, 'clips');
        resolve(true);
      } catch (error) {
        console.error('Error saving storyboard:', error);
        resolve(false);
      }
    });
  }, [currentStoryboard]);

  // Load storyboard from local storage
  const loadStoryboard = useCallback((storyboardId: string) => {
    try {
      const storyboardsString = localStorage.getItem(STORYBOARD_STORAGE_KEY);
      if (!storyboardsString) {
        console.error('No storyboards found in storage');
        return false;
      }

      const storyboards = JSON.parse(storyboardsString) as Record<string, Storyboard>;
      const storyboard = storyboards[storyboardId];

      if (!storyboard) {
        console.error(`Storyboard with ID ${storyboardId} not found`);
        return false;
      }

      // Convert date strings back to Date objects
      storyboard.createdAt = new Date(storyboard.createdAt);
      storyboard.updatedAt = new Date(storyboard.updatedAt);

      setCurrentStoryboard(storyboard);
      setActiveClipId(storyboard.clips.length > 0 ? storyboard.clips[0].id : null);
      return true;
    } catch (error) {
      console.error('Error loading storyboard:', error);
      return false;
    }
  }, []);

  // Get list of saved storyboard names
  const getSavedStoryboards = useCallback(() => {
    return getSavedStoryboardsFromStorage();
  }, []);

  // Delete a storyboard
  const deleteStoryboard = useCallback((storyboardId: string) => {
    try {
      const storyboardsString = localStorage.getItem(STORYBOARD_STORAGE_KEY);
      if (!storyboardsString) return false;

      const storyboards = JSON.parse(storyboardsString) as Record<string, Storyboard>;

      if (!storyboards[storyboardId]) return false;

      // Delete the storyboard
      delete storyboards[storyboardId];
      localStorage.setItem(STORYBOARD_STORAGE_KEY, JSON.stringify(storyboards));

      // Update saved storyboards list
      setSavedStoryboards(Object.keys(storyboards));

      // If current storyboard was deleted, create a new one
      if (currentStoryboard.id === storyboardId) {
        createNewStoryboard();
      }

      return true;
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
  }, [addClip, chatHistory, svgContent]);

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
        // Use the AnimationApi to generate an SVG for each scene
        console.log(`Generating SVG for scene ${index + 1}: ${scene.id}`);
        const generatedSvg = await AnimationApi.generate(scene.svgPrompt);

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
          }]
        };

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
          prompt: scene.svgPrompt
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

      // Save the storyboard
      saveStoryboard();

      return updatedStoryboard;
    } catch (error) {
      console.error('Error creating storyboard from response:', error);
      return newStoryboard;
    }
  }, []);

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

  // Provide context values
  const contextValue: MovieContextType = {
    currentStoryboard,
    savedStoryboards,
    activeClipId,
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
    setActiveClipId,
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
