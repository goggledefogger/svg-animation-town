import React, { createContext, useContext, useState, ReactNode, useRef, useCallback, useEffect } from 'react';
import { AnimationApi, AnimationStorageApi } from '../services/api';
import { exportAnimation as exportAnimationUtil, canExportAsSvg } from '../utils/exportUtils';
import { v4 as uuidv4 } from 'uuid';
import { isMobileDevice, isFreshPageLoad } from '../utils/deviceUtils';

// Define the context interface
interface AnimationContextType {
  svgContent: string;
  playing: boolean;
  playbackSpeed: number | 'groovy';
  aiProvider: 'openai' | 'claude';
  setAIProvider: (provider: 'openai' | 'claude') => void;
  setPlaying: (playing: boolean) => void;
  setSvgContent: React.Dispatch<React.SetStateAction<string>>;
  setSvgRef: (ref: SVGSVGElement | null) => void;
  generateAnimationFromPrompt: (prompt: string) => Promise<string>;
  updateAnimationFromPrompt: (prompt: string) => Promise<string>;
  generateAnimation: (prompt: string) => Promise<any>;
  loadPreset: (presetName: string) => Promise<string>;
  pauseAnimations: () => void;
  resumeAnimations: () => void;
  resetAnimations: () => void;
  resetEverything: () => void;
  setPlaybackSpeed: (speed: number | 'groovy') => void;
  saveAnimation: (name: string, chatHistory?: Message[]) => Promise<void>;
  loadAnimation: (name: string) => Promise<ChatData | null>;
  getSavedAnimations: () => Promise<any[]>;
  deleteAnimation: (name: string) => Promise<boolean>;
  exportAnimation: (filename: string, format: 'svg' | 'json') => void;
  canExportAsSvg: () => boolean;
  chatHistory: Message[];
  setChatHistory: React.Dispatch<React.SetStateAction<Message[]>>;
}

// Message type for chat history
export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp?: Date;
}

// Data structure for saved animations
export interface ChatData {
  svg: string;
  chatHistory?: Message[];
  timestamp: string;
}

// Create the context
const AnimationContext = createContext<AnimationContextType | undefined>(undefined);

// Session storage key for persisting state
const SESSION_STORAGE_KEY = 'current_animation_state';

// Create a provider component
export const AnimationProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [svgContent, setSvgContent] = useState<string>('');
  const [playing, setPlaying] = useState<boolean>(true);
  const [svgRef, setSvgRefState] = useState<SVGSVGElement | null>(null);
  const [aiProvider, setAIProvider] = useState<'openai' | 'claude'>('openai');
  const [playbackSpeed, setPlaybackSpeed] = useState<number | 'groovy'>(1);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const groovyIntervalRef = useRef<number | null>(null);

  // Use a ref to track the current SVG element to avoid unnecessary state updates
  const svgElementRef = useRef<SVGSVGElement | null>(null);

  // Cache for animation listings to prevent redundant API calls
  const animationListCache = useRef<{
    timestamp: number;
    animations: string[];
  } | null>(null);

  // Cache expiration in milliseconds (5 seconds)
  const CACHE_EXPIRATION = 5000;

  // Try to restore state from session storage on initial load
  useEffect(() => {
    const isMobile = isMobileDevice();
    const isFresh = isFreshPageLoad();

    // Clear session storage on desktop page reloads
    if (!isMobile && isFresh) {
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      console.log('Desktop page reload detected - cleared animation state');
      return;
    }

    // Only restore state for mobile or when returning to the app (not a page reload)
    if (isMobile || !isFresh) {
      try {
        const savedState = sessionStorage.getItem(SESSION_STORAGE_KEY);
        if (savedState) {
          const parsedState = JSON.parse(savedState);
          if (parsedState.svgContent) {
            setSvgContent(parsedState.svgContent);
          }
          if (parsedState.chatHistory) {
            setChatHistory(parsedState.chatHistory);
          }
          if (parsedState.aiProvider) {
            setAIProvider(parsedState.aiProvider);
          }
          if (parsedState.playbackSpeed !== undefined) {
            setPlaybackSpeed(parsedState.playbackSpeed);
          }
          console.log('Restored animation state from session storage');
        }
      } catch (error) {
        console.error('Error restoring animation state:', error);
      }
    }
  }, []);

  // Save state when visibility changes or before unloading
  useEffect(() => {
    // Skip saving if there's no content to save
    if (!svgContent && chatHistory.length === 0) return;

    const saveCurrentState = () => {
      try {
        // Only save state to sessionStorage for mobile devices or when browser is being closed
        // (not on regular page refreshes for desktop)
        const stateToSave = {
          svgContent,
          chatHistory,
          aiProvider,
          playbackSpeed,
          timestamp: new Date().toISOString()
        };
        sessionStorage.setItem(SESSION_STORAGE_KEY, JSON.stringify(stateToSave));
        console.log('Saved animation state to session storage');
      } catch (error) {
        console.error('Error saving animation state:', error);
      }
    };

    // Handle visibility change (when minimizing browser or screen turns off)
    const handleVisibilityChange = () => {
      if (document.visibilityState === 'hidden') {
        // Only save on visibility change for mobile devices
        if (isMobileDevice()) {
          saveCurrentState();
        }
      }
    };

    // Handle before unload (when refreshing or closing tab)
    const handleBeforeUnload = () => {
      // For mobile, always save
      if (isMobileDevice()) {
        saveCurrentState();
      }
      // For desktop, only save if user is closing browser (not refreshing)
      // This is an approximate approach as beforeunload can't reliably
      // distinguish between refresh and close
      else if (navigator.userAgent.includes('Chrome')) {
        // Chrome-specific behavior
        saveCurrentState();
      }
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('beforeunload', handleBeforeUnload);

    return () => {
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('beforeunload', handleBeforeUnload);
    };
  }, [svgContent, chatHistory, aiProvider, playbackSpeed]);

  // Create a stable reference for setting the SVG reference
  const setSvgRef = useCallback((ref: SVGSVGElement | null) => {
    // Only update state if the reference is different (by object identity)
    if (ref !== svgElementRef.current) {
      svgElementRef.current = ref; // Update the ref first
      setSvgRefState(ref); // Then update the state, which will cause re-renders
    }
  }, []);

  // Save the current animation to the server with a given name
  const saveAnimation = useCallback(async (name: string, chatHistory?: Message[]) => {
    if (!svgContent) {
      console.warn('No animation to save');
      return;
    }

    try {
      // Invalidate the animation list cache before saving
      // This ensures we don't get stale data after a successful save
      animationListCache.current = null;

      // Save to server
      const result = await AnimationStorageApi.saveAnimation(
        name,
        svgContent,
        chatHistory
      );

      console.log(`Animation saved to server with ID: ${result.id}`);

      // For client-side cache, also save locally
      try {
        // Get existing saved animations
        const savedAnimationsStr = localStorage.getItem('savedAnimations') || '{}';
        const savedAnimations = JSON.parse(savedAnimationsStr);

        // Add/update the current animation with chat history
        savedAnimations[name] = {
          id: result.id, // Store the server ID for future reference
          svg: svgContent,
          chatHistory,
          timestamp: new Date().toISOString()
        };

        // Save back to localStorage as cache
        localStorage.setItem('savedAnimations', JSON.stringify(savedAnimations));
      } catch (error) {
        console.error(`Error caching animation locally: ${error}`);
        // Continue anyway since the server save succeeded
      }
    } catch (error) {
      console.error(`Error saving animation to server: ${error}`);

      // Fallback to local storage only if server save fails
      try {
        const savedAnimationsStr = localStorage.getItem('savedAnimations') || '{}';
        const savedAnimations = JSON.parse(savedAnimationsStr);

        savedAnimations[name] = {
          svg: svgContent,
          chatHistory,
          timestamp: new Date().toISOString()
        };

        localStorage.setItem('savedAnimations', JSON.stringify(savedAnimations));
        console.log(`Animation saved locally as fallback: ${name}`);
      } catch (localError) {
        console.error(`Error in local fallback save: ${localError}`);
      }
    }
  }, [svgContent]);

  // Load an animation by name - first try server, then fall back to localStorage
  const loadAnimation = useCallback(async (name: string): Promise<ChatData | null> => {
    try {
      // First check local cache to get the ID
      const savedAnimationsStr = localStorage.getItem('savedAnimations') || '{}';
      const savedAnimations = JSON.parse(savedAnimationsStr);
      const localData = savedAnimations[name];

      // If we have a cached entry with server ID, load from server
      if (localData && localData.id) {
        try {
          const serverAnimation = await AnimationStorageApi.getAnimation(localData.id);

          if (serverAnimation && serverAnimation.svg) {
            setSvgContent(serverAnimation.svg);
            console.log(`Animation loaded from server: ${name} (${localData.id})`);

            // Dispatch a custom event to notify components about animation load
            const loadEvent = new CustomEvent('animation-loaded', {
              detail: { chatHistory: serverAnimation.chatHistory }
            });
            window.dispatchEvent(loadEvent);

            return {
              svg: serverAnimation.svg,
              chatHistory: serverAnimation.chatHistory,
              timestamp: serverAnimation.timestamp
            };
          }
        } catch (serverError) {
          console.warn(`Server load failed, falling back to local cache: ${serverError}`);
          // Continue to use local cache as fallback below
        }
      }

      // If server load fails or there's no server ID, use local cache
      if (localData) {
        setSvgContent(localData.svg);
        console.log(`Animation loaded from local cache: ${name}`);

        // Dispatch a custom event to notify components about animation load
        const loadEvent = new CustomEvent('animation-loaded', {
          detail: { chatHistory: localData.chatHistory }
        });
        window.dispatchEvent(loadEvent);

        return localData as ChatData;
      } else {
        console.warn(`Animation not found: ${name}`);
        return null;
      }
    } catch (error) {
      console.error(`Error loading animation: ${error}`);
      return null;
    }
  }, []);

  // Get saved animations from storage and API
  const getSavedAnimations = useCallback(async (): Promise<any[]> => {
    try {
      // Always try to get animations from server first
      const serverAnimations = await AnimationStorageApi.listAnimations();

      // Check for force refresh flag and clear it if present
      const forceRefresh = sessionStorage.getItem('force_server_refresh') === 'true';
      if (forceRefresh) {
        sessionStorage.removeItem('force_server_refresh');
        return serverAnimations;
      }

      // Combine with local animations as a fallback
      try {
        const savedAnimationsStr = localStorage.getItem('savedAnimations') || '{}';
        const savedAnimations = JSON.parse(savedAnimationsStr);

        // Convert local storage names to objects to match server format
        const localAnimations = Object.keys(savedAnimations).map(name => ({
          id: savedAnimations[name].id || `local-${name}`,
          name: name,
          timestamp: savedAnimations[name].timestamp || new Date().toISOString()
        }));

        // Combine lists, removing duplicates based on name
        const nameSet = new Set();
        const allAnimations = [...serverAnimations];

        // Add local animations that aren't already in the server list
        for (const localAnim of localAnimations) {
          const existsInServer = serverAnimations.some(serverAnim =>
            serverAnim.name === localAnim.name
          );

          if (!existsInServer && !nameSet.has(localAnim.name)) {
            nameSet.add(localAnim.name);
            allAnimations.push(localAnim);
          }
        }

        return allAnimations;
      } catch (localError) {
        return serverAnimations;
      }
    } catch (error) {
      // Fall back to localStorage if server request fails
      try {
        const savedAnimationsStr = localStorage.getItem('savedAnimations') || '{}';
        const savedAnimations = JSON.parse(savedAnimationsStr);

        // Convert local animations to objects to match server format
        return Object.keys(savedAnimations).map(name => ({
          id: savedAnimations[name].id || `local-${name}`,
          name: name,
          timestamp: savedAnimations[name].timestamp || new Date().toISOString()
        }));
      } catch (localError) {
        return [];
      }
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

  // Generate animation directly via API, returning raw API response
  const generateAnimation = useCallback(async (prompt: string) => {
    try {
      console.log(`Generating animation via API with prompt: "${prompt}"`);
      const result = await AnimationApi.generate(prompt, aiProvider);
      // Return the full result including animation ID if available
      return result;
    } catch (error) {
      console.error('Error generating animation via API:', error);
      throw error;
    }
  }, [aiProvider]);

  // Generate a new animation from a prompt
  const generateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    console.log('Generating animation from prompt:', prompt);
    try {
      const result = await AnimationApi.generate(prompt, aiProvider);
      console.log('Generated animation result');
      setSvgContent(result.svg);

      // If animation has an ID from backend, store it in chat history for reference
      if (result.animationId) {
        console.log(`Animation saved on server with ID: ${result.animationId}`);
      }

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

  // Update helper function to control CSS animations to handle reverse playback
  const controlCssAnimations = useCallback((playState: 'running' | 'paused') => {
    if (!svgRef) return;

    try {
      // Get all animated elements that have CSS animations
      const styleElement = svgRef.querySelector('style');
      if (!styleElement) {
        return;
      }

      // Find elements with CSS animations by looking for IDs mentioned in keyframes
      const styleContent = styleElement.textContent || '';

      // More comprehensive approach to find animated elements
      // 1. Find IDs in style blocks with animation properties
      const animatedElementIds = Array.from(styleContent.matchAll(/#([a-zA-Z0-9_-]+)\s*{[^}]*animation[^}]*}/g))
        .map(match => match[1]);

      // 2. Also find class-based animations
      const animatedClassSelectors = Array.from(styleContent.matchAll(/\.([a-zA-Z0-9_-]+)\s*{[^}]*animation[^}]*}/g))
        .map(match => match[1]);

      // Get current playback speed (except in groovy mode which is handled separately)
      const isReverse = typeof playbackSpeed === 'number' && playbackSpeed < 0;
      const speedValue = typeof playbackSpeed === 'number' ? Math.abs(playbackSpeed) : 1;

      // Apply play state and speed to elements with IDs
      animatedElementIds.forEach(id => {
        const element = svgRef.getElementById(id);
        if (element) {
          (element as SVGElement).style.animationPlayState = playState;

          // Set direction and speed for non-groovy modes
          if (playbackSpeed !== 'groovy') {
            (element as SVGElement).style.animationDirection = isReverse ? 'reverse' : 'normal';
            (element as SVGElement).style.animationDuration =
              `calc(var(--animation-duration, 1s) / ${speedValue})`;
          }
        }
      });

      // Apply play state and speed to elements with animated classes
      animatedClassSelectors.forEach(className => {
        const elements = svgRef.getElementsByClassName(className);
        Array.from(elements).forEach(element => {
          (element as SVGElement).style.animationPlayState = playState;

          // Set direction and speed for non-groovy modes
          if (playbackSpeed !== 'groovy') {
            (element as SVGElement).style.animationDirection = isReverse ? 'reverse' : 'normal';
            (element as SVGElement).style.animationDuration =
              `calc(var(--animation-duration, 1s) / ${speedValue})`;
          }
        });
      });

      // Fallback approach - find all elements with style attribute containing animation
      const allElements = svgRef.querySelectorAll('*');
      allElements.forEach(element => {
        const style = (element as SVGElement).getAttribute('style');
        if (style && style.includes('animation')) {
          (element as SVGElement).style.animationPlayState = playState;

          // Set direction and speed for non-groovy modes
          if (playbackSpeed !== 'groovy' && style.includes('animation-duration')) {
            // Set animation direction
            (element as SVGElement).style.animationDirection = isReverse ? 'reverse' : 'normal';

            const durationMatch = style.match(/animation-duration:\s*([^;]+)/);
            if (durationMatch) {
              const originalDuration = durationMatch[1];
              const newStyle = style.replace(
                /animation-duration:\s*([^;]+)/,
                `animation-duration: calc(${originalDuration} / ${speedValue})`
              );
              (element as SVGElement).setAttribute('style', newStyle);
            }
          }
        }
      });

      // Additional approach - find elements with inline style attributes containing animation
      const elementsWithStyle = svgRef.querySelectorAll('[style*="animation"]');
      elementsWithStyle.forEach((element) => {
        (element as SVGElement).style.animationPlayState = playState;

        // Set direction and speed for non-groovy modes
        if (playbackSpeed !== 'groovy') {
          // Set animation direction
          (element as SVGElement).style.animationDirection = isReverse ? 'reverse' : 'normal';

          const currentDuration = getComputedStyle(element).animationDuration;
          if (currentDuration && currentDuration !== '0s') {
            const durationInS = parseFloat(currentDuration);
            const newDuration = durationInS / speedValue;
            (element as SVGElement).style.animationDuration = `${newDuration}s`;
          }
        }
      });

    } catch (error) {
      console.error('Error controlling CSS animations:', error);
    }
  }, [svgRef, playbackSpeed]);

  // Apply playback speed changes
  useEffect(() => {
    if (!svgRef) return;

    // Clear any existing groovy interval
    if (groovyIntervalRef.current) {
      clearInterval(groovyIntervalRef.current);
      groovyIntervalRef.current = null;
    }

    if (playbackSpeed === 'groovy' && playing) {
      // For tracking current speeds for smooth transitions in groovy mode
      const currentSpeeds = new Map();
      // For tracking direction for each element
      const currentDirections = new Map();

      // For groovy mode, we'll gradually change the speed with smooth transitions
      groovyIntervalRef.current = window.setInterval(() => {
        // Get all animated elements
        const animatedElements = svgRef.querySelectorAll('[style*="animation"], animate, animateTransform, animateMotion');

        animatedElements.forEach((element, index) => {
          // Generate a unique key for this element
          const elementKey = `element-${index}`;

          // Get current speed or initialize with a value between 0.5 and 1.5
          let currentSpeed = currentSpeeds.get(elementKey);
          let currentDirection = currentDirections.get(elementKey);

          if (currentSpeed === undefined) {
            currentSpeed = 0.5 + Math.random();
            currentSpeeds.set(elementKey, currentSpeed);
          }

          if (currentDirection === undefined) {
            currentDirection = 'normal';
            currentDirections.set(elementKey, currentDirection);
          }

          // Gradually change speed - either faster or slower with small increments
          // Random value between -0.15 and 0.15 for gentle acceleration/deceleration
          const speedChange = (Math.random() * 0.3) - 0.15;

          // Update current speed, keeping it between 0.25 and 3
          let newSpeed = currentSpeed + speedChange;
          newSpeed = Math.max(0.25, Math.min(3, newSpeed));

          // Small chance to change direction (5% chance)
          if (Math.random() < 0.05) {
            currentDirection = currentDirection === 'normal' ? 'reverse' : 'normal';
            currentDirections.set(elementKey, currentDirection);
          }

          // Apply the new speed to the element
          currentSpeeds.set(elementKey, newSpeed);

          if (element instanceof SVGElement && element.style) {
            // For CSS animations
            element.style.animationDirection = currentDirection;
            element.style.animationDuration = `${3 / newSpeed}s`;
            // Add smooth transition for animation-duration
            element.style.transition = 'animation-duration 1.5s ease-in-out';
          } else if (element instanceof SVGAnimateElement ||
                    element instanceof SVGAnimateTransformElement ||
                    element instanceof SVGAnimateMotionElement) {
            // For SMIL animations
            if (currentDirection === 'reverse') {
              element.setAttribute('keyPoints', '1;0');
              element.setAttribute('keyTimes', '0;1');
            } else {
              element.setAttribute('keyPoints', '0;1');
              element.setAttribute('keyTimes', '0;1');
            }

            const dur = parseFloat(element.getAttribute('data-original-dur') || element.getAttribute('dur') || '1s');
            element.setAttribute('dur', `${dur / newSpeed}s`);
          }
        });
      }, 1500); // Update speeds every 1.5 seconds for smoother transitions
    } else if (typeof playbackSpeed === 'number' && playing) {
      // For reverse playback (speed = -1)
      const isReverse = playbackSpeed < 0;
      const speedAbs = Math.abs(playbackSpeed);

      // Apply to CSS animations first
      const cssAnimatedElements = svgRef.querySelectorAll('[style*="animation"]');
      cssAnimatedElements.forEach(element => {
        if (element instanceof SVGElement) {
          // Set the animation direction based on speed
          element.style.animationDirection = isReverse ? 'reverse' : 'normal';

          // Get current duration info from computed style
          const currentDuration = getComputedStyle(element).animationDuration;
          if (currentDuration && currentDuration !== '0s') {
            const durationInS = parseFloat(currentDuration);
            const newDuration = durationInS / speedAbs;
            element.style.animationDuration = `${newDuration}s`;
          }
        }
      });

      // Apply fixed speed to SMIL animations
      const smilAnimations = svgRef.querySelectorAll('animate, animateTransform, animateMotion');
      smilAnimations.forEach(animation => {
        // Get original duration from a data attribute or current attribute
        const originalDur = animation.getAttribute('data-original-dur') || animation.getAttribute('dur');
        if (originalDur) {
          // Store original duration if not already saved
          if (!animation.getAttribute('data-original-dur')) {
            animation.setAttribute('data-original-dur', originalDur);
          }

          // For reverse playback, set keyPoints and keyTimes appropriately
          if (isReverse) {
            animation.setAttribute('keyPoints', '1;0');
            animation.setAttribute('keyTimes', '0;1');
          } else {
            // Reset to normal direction if previously reversed
            if (animation.getAttribute('keyPoints') === '1;0') {
              animation.setAttribute('keyPoints', '0;1');
              animation.setAttribute('keyTimes', '0;1');
            }
          }

          // Parse the duration value
          const durationMatch = originalDur.match(/([0-9.]+)([a-z]+)/);
          if (durationMatch) {
            const [_, value, unit] = durationMatch;
            const newValue = parseFloat(value) / speedAbs;
            animation.setAttribute('dur', `${newValue}${unit}`);
          }
        }
      });

      // Apply fixed speed to CSS animations via controlCssAnimations function
      controlCssAnimations(playing ? 'running' : 'paused');
    }

    return () => {
      if (groovyIntervalRef.current) {
        clearInterval(groovyIntervalRef.current);
        groovyIntervalRef.current = null;
      }
    };
  }, [playbackSpeed, svgRef, playing, controlCssAnimations]);

  // Animation control methods
  const pauseAnimations = useCallback(() => {
    if (svgRef) {
      try {
        // Pause SMIL animations (animate tags)
        svgRef.pauseAnimations();

        // Pause CSS animations
        controlCssAnimations('paused');

        setPlaying(false);
      } catch (error) {
        console.error('Error in pauseAnimations:', error);
      }
    } else {
      console.warn('Cannot pause animations: SVG reference is null');
    }
  }, [svgRef, controlCssAnimations]);

  const resumeAnimations = useCallback(() => {
    if (svgRef) {
      try {
        // Resume SMIL animations (animate tags)
        svgRef.unpauseAnimations();

        // Resume CSS animations
        controlCssAnimations('running');

        setPlaying(true);
      } catch (error) {
        console.error('Error in resumeAnimations:', error);
      }
    } else {
      console.warn('Cannot resume animations: SVG reference is null');
    }
  }, [svgRef, controlCssAnimations]);

  // Resets animations by re-inserting the SVG content
  const resetAnimations = useCallback(() => {
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

  // Completely reset everything to initial state
  const resetEverything = useCallback(() => {
    // Reset SVG content to empty string
    setSvgContent('');

    // Reset other state values to their defaults
    setPlaying(true);
    setPlaybackSpeed(1);
    setChatHistory([]);

    // Clear session storage
    sessionStorage.removeItem(SESSION_STORAGE_KEY);

    // Clear any running intervals
    if (groovyIntervalRef.current) {
      clearInterval(groovyIntervalRef.current);
      groovyIntervalRef.current = null;
    }

    // Reset SVG references
    svgElementRef.current = null;
    setSvgRefState(null);

    // Dispatch a custom event to notify other components about the reset
    window.dispatchEvent(new CustomEvent('animation-reset'));
  }, []);

  // Function to export animation
  const exportAnimationFn = useCallback((filename: string, format: 'svg' | 'json') => {
    if (!svgContent) {
      console.warn('No animation to export');
      return;
    }

    exportAnimationUtil(svgContent, filename, format, chatHistory);
  }, [svgContent, chatHistory]);

  // Check if SVG can be exported with animations
  const canExportAsSvgFn = useCallback(() => {
    return canExportAsSvg(svgContent);
  }, [svgContent]);

  // Delete an animation by name
  const deleteAnimation = useCallback(async (name: string): Promise<boolean> => {
    try {
      // First check local cache to get the ID
      const savedAnimationsStr = localStorage.getItem('savedAnimations') || '{}';
      const savedAnimations = JSON.parse(savedAnimationsStr);
      const localData = savedAnimations[name];

      let success = false;

      // If we have a server ID, delete from server
      if (localData && localData.id) {
        try {
          success = await AnimationStorageApi.deleteAnimation(localData.id);
          console.log(`Animation deleted from server: ${name} (${localData.id})`);
        } catch (serverError) {
          console.warn(`Error deleting from server: ${serverError}`);
        }
      }

      // Also delete from local storage
      try {
        // Remove from local storage
        if (savedAnimations[name]) {
          delete savedAnimations[name];
          localStorage.setItem('savedAnimations', JSON.stringify(savedAnimations));
          success = true;
          console.log(`Animation deleted from local storage: ${name}`);
        }
      } catch (localError) {
        console.error(`Error deleting from local storage: ${localError}`);
      }

      // Invalidate the cache if deletion was successful
      if (success) {
        animationListCache.current = null;
      }

      return success;
    } catch (error) {
      console.error(`Error deleting animation: ${error}`);
      return false;
    }
  }, []);

  return (
    <AnimationContext.Provider value={{
      svgContent,
      playing,
      playbackSpeed,
      aiProvider,
      setAIProvider,
      setPlaying,
      setSvgContent,
      setSvgRef,
      generateAnimationFromPrompt,
      updateAnimationFromPrompt,
      generateAnimation,
      loadPreset,
      pauseAnimations,
      resumeAnimations,
      resetAnimations,
      resetEverything,
      setPlaybackSpeed,
      saveAnimation,
      loadAnimation,
      getSavedAnimations,
      deleteAnimation,
      exportAnimation: exportAnimationFn,
      canExportAsSvg: canExportAsSvgFn,
      chatHistory,
      setChatHistory
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
  const context = useContext(AnimationContext);
  if (context === undefined) {
    throw new Error('useSvgRef must be used within an AnimationProvider');
  }
  return context.setSvgRef;
};
