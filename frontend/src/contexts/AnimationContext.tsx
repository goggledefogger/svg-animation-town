import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { batSignalPreset } from '../utils/animationPresets';
import { AnimationApi } from '../services/api';
import { debugLog, debugWarn, logError } from '../utils/logging';

// Define the SVG element type
export interface SVGElement {
  id: string;
  type: 'circle' | 'rect' | 'path' | 'text' | 'line' | 'group';
  attributes: Record<string, string | number>;
  animations: Animation[];
}

// Define the animation type
export interface Animation {
  id: string;
  targetProperty: string;
  keyframes: Keyframe[];
  duration: number;
  easing: string;
  delay: number;
  iterationCount: number | 'infinite';
}

export interface Keyframe {
  offset: number; // 0 to 1
  value: string | number;
}

// Animation history item interface
interface AnimationHistoryItem {
  elements: SVGElement[];
  description: string;
  timestamp: number;
}

// Define the context interface
interface AnimationContextType {
  elements: SVGElement[];
  currentTime: number;
  playing: boolean;
  duration: number;
  history: AnimationHistoryItem[];
  historyIndex: number;
  setElements: React.Dispatch<React.SetStateAction<SVGElement[]>>;
  setCurrentTime: (time: number) => void;
  setPlaying: (playing: boolean) => void;
  setDuration: (duration: number) => void;
  addElement: (element: SVGElement) => void;
  updateElement: (id: string, updates: Partial<SVGElement>) => void;
  removeElement: (id: string) => void;
  addAnimation: (elementId: string, animation: Animation) => void;
  updateAnimation: (elementId: string, animationId: string, updates: Partial<Animation>) => void;
  removeAnimation: (elementId: string, animationId: string) => void;
  loadPreset: (presetName: string) => Promise<string>;
  generateAnimationFromPrompt: (prompt: string) => Promise<string>;
  updateAnimationFromPrompt: (prompt: string) => Promise<string>;
  undoAnimation: () => string | null;
  redoAnimation: () => string | null;
  canUndo: () => boolean;
  canRedo: () => boolean;
  clearAnimations: () => void;
}

// Create the context
const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

// Maximum number of animations to keep in history
const MAX_HISTORY_SIZE = 10;

// Create a provider component
export const AnimationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [elements, setElements] = useState<SVGElement[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(5000); // 5 seconds default
  
  // Animation history state
  const [history, setHistory] = useState<AnimationHistoryItem[]>([]);
  const [historyIndex, setHistoryIndex] = useState<number>(-1);

  // Add new animation to history
  const addToHistory = (newElements: SVGElement[], description: string) => {
    debugLog('Adding to animation history:', description);
    
    // Create a deep copy of the elements to prevent reference issues
    const elementsCopy = JSON.parse(JSON.stringify(newElements));
    
    // If we're not at the end of history (user has done undo),
    // discard anything ahead of current index
    const newHistory = history.slice(0, historyIndex + 1);
    
    // Add the new item
    const newItem: AnimationHistoryItem = {
      elements: elementsCopy,
      description,
      timestamp: Date.now()
    };
    
    // Ensure we don't exceed max history size
    if (newHistory.length >= MAX_HISTORY_SIZE) {
      newHistory.shift(); // Remove oldest item
    }
    
    // Update history and index
    const updatedHistory = [...newHistory, newItem];
    setHistory(updatedHistory);
    setHistoryIndex(updatedHistory.length - 1);
    
    debugLog('History updated. Size:', updatedHistory.length, 'Index:', updatedHistory.length - 1);
  };

  // Clear all animations
  const clearAnimations = () => {
    debugLog('Clearing all animations');
    setElements([]);
    // Note: We don't add this to history since it's just clearing
  };

  // Undo functionality
  const undoAnimation = (): string | null => {
    debugLog('Attempting to undo animation. Current index:', historyIndex);
    
    if (historyIndex <= 0) {
      debugLog('Cannot undo: at beginning of history or empty history');
      return null;
    }
    
    const newIndex = historyIndex - 1;
    const prevItem = history[newIndex];
    
    debugLog('Undoing to history item:', prevItem.description);
    setHistoryIndex(newIndex);
    setElements(prevItem.elements);
    
    return prevItem.description;
  };
  
  // Redo functionality
  const redoAnimation = (): string | null => {
    debugLog('Attempting to redo animation. Current index:', historyIndex);
    
    if (historyIndex >= history.length - 1) {
      debugLog('Cannot redo: at end of history');
      return null;
    }
    
    const newIndex = historyIndex + 1;
    const nextItem = history[newIndex];
    
    debugLog('Redoing to history item:', nextItem.description);
    setHistoryIndex(newIndex);
    setElements(nextItem.elements);
    
    return nextItem.description;
  };
  
  // Check if undo is possible
  const canUndo = (): boolean => {
    return historyIndex > 0;
  };
  
  // Check if redo is possible
  const canRedo = (): boolean => {
    return historyIndex < history.length - 1;
  };

  // Debug log when elements change
  useEffect(() => {
    debugLog('Animation elements updated in context. Count:', elements.length);
    debugLog('Element IDs:', elements.map(el => el.id).join(', '));

    // Check if any elements have required attributes
    elements.forEach(element => {
      debugLog(`Element ${element.id} (${element.type}) attributes:`, element.attributes);

      // Check for required attributes based on type (using camelCase for React)
      const requiredAttributes = {
        circle: ['cx', 'cy', 'r', 'fill'],
        rect: ['x', 'y', 'width', 'height', 'fill'],
        path: ['d', 'fill'],
        text: ['x', 'y', 'fontSize', 'fill'], // Changed from font-size to fontSize
        line: ['x1', 'y1', 'x2', 'y2', 'stroke'],
        group: []
      };

      if (element.type in requiredAttributes) {
        // Convert attribute names to both hyphenated and camelCase versions for checking
        const elementAttributes = Object.keys(element.attributes).map(key => key.toLowerCase());

        const missingAttributes = requiredAttributes[element.type as keyof typeof requiredAttributes]
          .filter(attr => {
            // Check for both camelCase and hyphenated versions of the attribute
            const camelCaseAttr = attr.replace(/-([a-z])/g, (g) => g[1].toUpperCase());
            const hyphenatedAttr = camelCaseAttr.replace(/([A-Z])/g, '-$1').toLowerCase();

            return !elementAttributes.includes(camelCaseAttr.toLowerCase()) &&
                   !elementAttributes.includes(hyphenatedAttr.toLowerCase());
          });

        if (missingAttributes.length > 0) {
          debugWarn(`Element ${element.id} missing required attributes:`, missingAttributes);
        }
      }

      // Log animations
      if (element.animations && element.animations.length > 0) {
        debugLog(`Element ${element.id} has ${element.animations.length} animations`);
        element.animations.forEach(anim => {
          debugLog(`Animation ${anim.id} for property ${anim.targetProperty}:`, anim);
        });
      } else {
        debugLog(`Element ${element.id} has no animations`);
      }
    });
  }, [elements]);

  // Debug when currentTime changes
  useEffect(() => {
    debugLog('Animation current time updated:', currentTime);
  }, [currentTime]);

  // Debug when playing state changes
  useEffect(() => {
    debugLog('Animation playing state changed:', playing);
  }, [playing]);

  const addElement = (element: SVGElement) => {
    debugLog('Adding element:', element);
    setElements(prev => [...prev, element]);
  };

  const updateElement = (id: string, updates: Partial<SVGElement>) => {
    debugLog('Updating element:', id, updates);
    setElements(prev =>
      prev.map(el => el.id === id ? { ...el, ...updates } : el)
    );
  };

  const removeElement = (id: string) => {
    debugLog('Removing element:', id);
    setElements(prev => prev.filter(el => el.id !== id));
  };

  const addAnimation = (elementId: string, animation: Animation) => {
    debugLog('Adding animation to element:', elementId, animation);
    setElements(prev =>
      prev.map(el =>
        el.id === elementId
          ? { ...el, animations: [...el.animations, animation] }
          : el
      )
    );
  };

  const updateAnimation = (elementId: string, animationId: string, updates: Partial<Animation>) => {
    debugLog('Updating animation:', elementId, animationId, updates);
    setElements(prev =>
      prev.map(el =>
        el.id === elementId
          ? {
              ...el,
              animations: el.animations.map(anim =>
                anim.id === animationId ? { ...anim, ...updates } : anim
              )
            }
          : el
      )
    );
  };

  const removeAnimation = (elementId: string, animationId: string) => {
    debugLog('Removing animation:', elementId, animationId);
    setElements(prev =>
      prev.map(el =>
        el.id === elementId
          ? { ...el, animations: el.animations.filter(anim => anim.id !== animationId) }
          : el
      )
    );
  };

  const loadPreset = async (presetName: string): Promise<string> => {
    debugLog('Loading preset:', presetName);
    try {
      // First clear any existing animations
      clearAnimations();
      
      // Try to fetch the preset from the API
      const presetData = await AnimationApi.getPreset(presetName);
      debugLog('Loaded preset data:', presetData);
      setElements(presetData.elements);
      
      // Add to history
      addToHistory(presetData.elements, `Loaded ${presetName} preset: ${presetData.message}`);
      
      return presetData.message;
    } catch (error) {
      logError(`Error loading preset from API: ${error}`);

      // Fall back to local presets if API fails
      switch (presetName) {
        case 'batSignal':
          debugLog('Using local batSignal preset');
          setElements(batSignalPreset);
          
          // Add to history
          addToHistory(batSignalPreset, `Loaded ${presetName} preset: I've created the bat signal with a dramatic reveal.`);
          
          return "I've created the bat signal with a dramatic reveal.";
        default:
          debugWarn(`Preset '${presetName}' not found`);
          return '';
      }
    }
  };

  const generateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    debugLog('Generating animation from prompt:', prompt);
    try {
      // First clear any existing animations
      clearAnimations();
      
      const result = await AnimationApi.generate(prompt);
      debugLog('Generated animation result:', result);
      setElements(result.elements);
      
      // Add to history
      addToHistory(result.elements, `Generated animation: ${result.message}`);
      
      return result.message;
    } catch (error: any) {
      logError('Error generating animation:', error);
      throw error;
    }
  };

  const updateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    debugLog('Updating animation from prompt:', prompt);
    try {
      const result = await AnimationApi.update(prompt, elements);
      debugLog('Updated animation result:', result);
      setElements(result.elements);
      
      // Add to history
      addToHistory(result.elements, `Updated animation: ${result.message}`);
      
      return result.message;
    } catch (error: any) {
      logError('Error updating animation:', error);
      throw error;
    }
  };

  return (
    <AnimationContext.Provider value={{
      elements,
      currentTime,
      playing,
      duration,
      history,
      historyIndex,
      setElements,
      setCurrentTime,
      setPlaying,
      setDuration,
      addElement,
      updateElement,
      removeElement,
      addAnimation,
      updateAnimation,
      removeAnimation,
      loadPreset,
      generateAnimationFromPrompt,
      updateAnimationFromPrompt,
      undoAnimation,
      redoAnimation,
      canUndo,
      canRedo,
      clearAnimations
    }}>
      {children}
    </AnimationContext.Provider>
  );
};

// Create a hook for using the context
export const useAnimation = (): AnimationContextType => {
  const context = useContext(AnimationContext);
  if (context === undefined) {
    throw new Error('useAnimation must be used within an AnimationProvider');
  }
  return context;
};
