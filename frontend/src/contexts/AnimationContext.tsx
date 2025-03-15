import React, { createContext, useContext, useState, ReactNode } from 'react';
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

  const addElement = (element: SVGElement) => {
    setElements(prev => [...prev, element]);
  };

  const updateElement = (id: string, updates: Partial<SVGElement>) => {
    setElements(prev =>
      prev.map(el => el.id === id ? { ...el, ...updates } : el)
    );
  };

  const removeElement = (id: string) => {
    setElements(prev => prev.filter(el => el.id !== id));
  };

  const addAnimation = (elementId: string, animation: Animation) => {
    setElements(prev =>
      prev.map(el =>
        el.id === elementId
          ? { ...el, animations: [...el.animations, animation] }
          : el
      )
    );
  };

  const updateAnimation = (elementId: string, animationId: string, updates: Partial<Animation>) => {
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
    setElements(prev =>
      prev.map(el =>
        el.id === elementId
          ? { ...el, animations: el.animations.filter(anim => anim.id !== animationId) }
          : el
      )
    );
  };

  const loadPreset = async (presetName: string): Promise<string> => {
    try {
      // First try to fetch the preset from the API
      const presetData = await AnimationApi.getPreset(presetName);
      setElements(presetData.elements);
      return presetData.message;
    } catch (error) {
      console.error(`Error loading preset from API: ${error}`);

      // Fall back to local presets if API fails
      switch (presetName) {
        case 'batSignal':
          setElements(batSignalPreset);
          return "I've created the bat signal with a dramatic reveal.";
        default:
          console.warn(`Preset '${presetName}' not found`);
          return '';
      }
    }
  };

  const generateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    try {
      const result = await AnimationApi.generate(prompt);
      setElements(result.elements);
      return result.message;
    } catch (error: any) {
      console.error('Error generating animation:', error);
      throw error;
    }
  };

  const updateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    try {
      const result = await AnimationApi.update(prompt, elements);
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
