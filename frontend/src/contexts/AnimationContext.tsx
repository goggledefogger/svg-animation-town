import React, { createContext, useContext, useState, ReactNode, useEffect } from 'react';
import { batSignalPreset } from '../utils/animationPresets';
import { AnimationApi } from '../services/api';

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

// Define the context interface
interface AnimationContextType {
  elements: SVGElement[];
  currentTime: number;
  playing: boolean;
  duration: number;
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
}

// Create the context
const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

// Create a provider component
export const AnimationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [elements, setElements] = useState<SVGElement[]>([]);
  const [currentTime, setCurrentTime] = useState<number>(0);
  const [playing, setPlaying] = useState<boolean>(false);
  const [duration, setDuration] = useState<number>(5000); // 5 seconds default

  // Debug log when elements change
  useEffect(() => {
    console.log('Animation elements updated in context. Count:', elements.length);
    console.log('Element IDs:', elements.map(el => el.id).join(', '));

    // Check if any elements have required attributes
    elements.forEach(element => {
      console.log(`Element ${element.id} (${element.type}) attributes:`, element.attributes);

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
          console.warn(`Element ${element.id} missing required attributes:`, missingAttributes);
        }
      }

      // Log animations
      if (element.animations && element.animations.length > 0) {
        console.log(`Element ${element.id} has ${element.animations.length} animations`);
        element.animations.forEach(anim => {
          console.log(`Animation ${anim.id} for property ${anim.targetProperty}:`, anim);
        });
      } else {
        console.log(`Element ${element.id} has no animations`);
      }
    });
  }, [elements]);

  // Debug when currentTime changes
  useEffect(() => {
    console.log('Animation current time updated:', currentTime);
  }, [currentTime]);

  // Debug when playing state changes
  useEffect(() => {
    console.log('Animation playing state changed:', playing);
  }, [playing]);

  const addElement = (element: SVGElement) => {
    console.log('Adding element:', element);
    setElements(prev => [...prev, element]);
  };

  const updateElement = (id: string, updates: Partial<SVGElement>) => {
    console.log('Updating element:', id, updates);
    setElements(prev =>
      prev.map(el => el.id === id ? { ...el, ...updates } : el)
    );
  };

  const removeElement = (id: string) => {
    console.log('Removing element:', id);
    setElements(prev => prev.filter(el => el.id !== id));
  };

  const addAnimation = (elementId: string, animation: Animation) => {
    console.log('Adding animation to element:', elementId, animation);
    setElements(prev =>
      prev.map(el =>
        el.id === elementId
          ? { ...el, animations: [...el.animations, animation] }
          : el
      )
    );
  };

  const updateAnimation = (elementId: string, animationId: string, updates: Partial<Animation>) => {
    console.log('Updating animation:', elementId, animationId, updates);
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
    console.log('Removing animation:', elementId, animationId);
    setElements(prev =>
      prev.map(el =>
        el.id === elementId
          ? { ...el, animations: el.animations.filter(anim => anim.id !== animationId) }
          : el
      )
    );
  };

  const loadPreset = async (presetName: string): Promise<string> => {
    console.log('Loading preset:', presetName);
    try {
      // First try to fetch the preset from the API
      const presetData = await AnimationApi.getPreset(presetName);
      console.log('Loaded preset data:', presetData);
      setElements(presetData.elements);
      return presetData.message;
    } catch (error) {
      console.error(`Error loading preset from API: ${error}`);

      // Fall back to local presets if API fails
      switch (presetName) {
        case 'batSignal':
          console.log('Using local batSignal preset');
          setElements(batSignalPreset);
          return "I've created the bat signal with a dramatic reveal.";
        default:
          console.warn(`Preset '${presetName}' not found`);
          return '';
      }
    }
  };

  const generateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    console.log('Generating animation from prompt:', prompt);
    try {
      const result = await AnimationApi.generate(prompt);
      console.log('Generated animation result:', result);
      setElements(result.elements);
      return result.message;
    } catch (error: any) {
      console.error('Error generating animation:', error);
      throw error;
    }
  };

  const updateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    console.log('Updating animation from prompt:', prompt);
    try {
      const result = await AnimationApi.update(prompt, elements);
      console.log('Updated animation result:', result);
      setElements(result.elements);
      return result.message;
    } catch (error: any) {
      console.error('Error updating animation:', error);
      throw error;
    }
  };

  return (
    <AnimationContext.Provider value={{
      elements,
      currentTime,
      playing,
      duration,
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
      updateAnimationFromPrompt
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
