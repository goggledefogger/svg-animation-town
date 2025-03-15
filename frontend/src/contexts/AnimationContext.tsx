import React, { createContext, useContext, useState, ReactNode, useRef, useCallback } from 'react';
import { AnimationApi } from '../services/api';

// Define the context interface
interface AnimationContextType {
  svgContent: string;
  playing: boolean;
  aiProvider: 'openai' | 'claude';
  setAIProvider: (provider: 'openai' | 'claude') => void;
  setPlaying: (playing: boolean) => void;
  setSvgContent: React.Dispatch<React.SetStateAction<string>>;
  setSvgRef: (ref: SVGSVGElement | null) => void;
  generateAnimationFromPrompt: (prompt: string) => Promise<string>;
  updateAnimationFromPrompt: (prompt: string) => Promise<string>;
  loadPreset: (presetName: string) => Promise<string>;
  pauseAnimations: () => void;
  resumeAnimations: () => void;
  resetAnimations: () => void;
}

// Create the context
const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

// Create a provider component
export const AnimationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [playing, setPlaying] = useState<boolean>(true);
  const [svgRef, setSvgRefState] = useState<SVGSVGElement | null>(null);
  const [aiProvider, setAIProvider] = useState<'openai' | 'claude'>('openai');

  // Use a ref to track the current SVG element to avoid unnecessary state updates
  const svgElementRef = useRef<SVGSVGElement | null>(null);

  // Create a stable reference for setting the SVG reference
  const setSvgRef = useCallback((ref: SVGSVGElement | null) => {
    // Only update state if the reference is different (by object identity)
    if (ref !== svgElementRef.current) {
      console.log('Setting SVG reference:', ref ? 'SVG Element' : 'null');
      svgElementRef.current = ref; // Update the ref first
      setSvgRefState(ref); // Then update the state, which will cause re-renders
    }
  }, []);

  // Load a preset animation by name
  const loadPreset = async (presetName: string): Promise<string> => {
    console.log('Loading preset:', presetName);
    try {
      // Try to fetch the preset from the API
      const presetData = await AnimationApi.getPreset(presetName);
      console.log('Loaded preset data:', presetData);
      setSvgContent(presetData.svg);
      return presetData.message;
    } catch (error) {
      console.error(`Error loading preset: ${error}`);
      return 'Error loading preset animation.';
    }
  };

  // Generate a new animation from a prompt
  const generateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    console.log('Generating animation from prompt:', prompt);
    try {
      const result = await AnimationApi.generate(prompt, aiProvider);
      console.log('Generated animation result');
      setSvgContent(result.svg);
      return result.message;
    } catch (error: any) {
      console.error('Error generating animation:', error);
      throw error;
    }
  };

  // Update the current animation from a prompt
  const updateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    if (!svgContent) {
      return generateAnimationFromPrompt(prompt);
    }

    console.log('Updating animation with prompt:', prompt);
    try {
      const result = await AnimationApi.update(prompt, svgContent, aiProvider);
      console.log('Updated animation result');
      setSvgContent(result.svg);
      return result.message;
    } catch (error: any) {
      console.error('Error updating animation:', error);
      throw error;
    }
  };

  // Helper function to control CSS animations by setting animation-play-state
  const controlCssAnimations = useCallback((playState: 'running' | 'paused') => {
    if (!svgRef) return;

    try {
      // Get all animated elements that have CSS animations
      const styleElement = svgRef.querySelector('style');
      if (!styleElement) {
        console.log('No style element found for CSS animations');
        return;
      }

      // Find elements with CSS animations by looking for IDs mentioned in keyframes
      const styleContent = styleElement.textContent || '';
      // Extract IDs from animation references like "#lightBeam {" or "#element {"
      const animatedElementIds = Array.from(styleContent.matchAll(/#([a-zA-Z0-9_-]+)\s+{/g))
        .map(match => match[1])
        .filter(id => styleContent.includes(`#${id}`) && styleContent.includes('animation:'));

      console.log(`Found ${animatedElementIds.length} elements with CSS animations`);

      // Apply play state to each element
      animatedElementIds.forEach(id => {
        const element = svgRef.getElementById(id);
        if (element) {
          // Cast to SVGElement which has a style property
          (element as SVGElement).style.animationPlayState = playState;
        }
      });

      // As a fallback, try to select all elements that might have animations
      const animatedElements = svgRef.querySelectorAll('[style*="animation"]');
      animatedElements.forEach((element) => {
        (element as SVGElement).style.animationPlayState = playState;
      });
    } catch (error) {
      console.error('Error controlling CSS animations:', error);
    }
  }, [svgRef]);

  // Animation control methods
  const pauseAnimations = useCallback(() => {
    if (svgRef) {
      console.log('Pausing animations');

      // Pause SMIL animations (animate tags)
      svgRef.pauseAnimations();

      // Pause CSS animations
      controlCssAnimations('paused');

      setPlaying(false);
    } else {
      console.warn('Cannot pause animations: SVG reference is null');
    }
  }, [svgRef, controlCssAnimations]);

  const resumeAnimations = useCallback(() => {
    if (svgRef) {
      console.log('Resuming animations');

      // Resume SMIL animations (animate tags)
      svgRef.unpauseAnimations();

      // Resume CSS animations
      controlCssAnimations('running');

      setPlaying(true);
    } else {
      console.warn('Cannot resume animations: SVG reference is null');
    }
  }, [svgRef, controlCssAnimations]);

  // Resets animations by re-inserting the SVG content
  const resetAnimations = useCallback(() => {
    console.log('Resetting animations');
    setSvgContent(prevContent => {
      // Force a re-render by adding and immediately removing a comment
      return prevContent ? prevContent + '<!-- reset -->' : prevContent;
    });

    // Remove the comment after a short delay
    setTimeout(() => {
      setSvgContent(prevContent => {
        return prevContent ? prevContent.replace('<!-- reset -->', '') : prevContent;
      });
    }, 50);

    setPlaying(true);
  }, []);

  // Debug logs for SVG content changes
  React.useEffect(() => {
    console.log('SVG Content changed:', svgContent ? 'Has content' : 'Empty');
  }, [svgContent]);

  return (
    <AnimationContext.Provider value={{
      svgContent,
      playing,
      aiProvider,
      setAIProvider,
      setPlaying,
      setSvgContent,
      setSvgRef,
      generateAnimationFromPrompt,
      updateAnimationFromPrompt,
      loadPreset,
      pauseAnimations,
      resumeAnimations,
      resetAnimations
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

// Export a hook to get the setSvgRef function
export const useSvgRef = () => {
  const { setSvgRef } = useAnimation();
  return setSvgRef;
};
