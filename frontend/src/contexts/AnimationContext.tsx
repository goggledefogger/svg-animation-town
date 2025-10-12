import React, { createContext, useContext, useState, ReactNode, useRef, useCallback, useEffect } from 'react';
import { AnimationApi, AnimationStorageApi } from '../services/api';
import type { AnimationGenerateResult } from '../services/api';
import { exportAnimation as exportAnimationUtil, canExportAsSvg } from '../utils/exportUtils';
import { useViewerPreferences } from './ViewerPreferencesContext';
import { v4 as uuidv4 } from 'uuid';
import { isMobileDevice, isFreshPageLoad } from '../utils/deviceUtils';
import { GLOBAL_ANIMATION_REGISTRY, AnimationRegistryHelpers } from '../hooks/useAnimationLoader';
import { resetAnimations as resetAnimationsUtil, controlAnimations } from '../utils/animationUtils';
import type { AIProviderId, AIProviderInfo } from '@/types/ai';
import { buildProviderSelection, normalizeProviderId } from '@/utils/providerUtils';

// Define the context interface
export interface AnimationContextType {
  svgContent: string;
  playing: boolean;
  playbackSpeed: number | 'groovy';
  aiProvider: AIProviderId;
  aiModel: string;
  setAIProvider: (provider: AIProviderId) => void;
  setAIModel: (model: string) => void;
  availableProviders: AIProviderInfo[];
  defaultModels: Record<AIProviderId, string>;
  setPlaying: (playing: boolean) => void;
  setSvgContent: React.Dispatch<React.SetStateAction<string>>;
  setSvgContentWithBroadcast: (newContent: string | ((prev: string) => string), source?: string) => void;
  setSvgRef: (ref: SVGSVGElement | null) => void;
  generateAnimationFromPrompt: (prompt: string) => Promise<string>;
  updateAnimationFromPrompt: (prompt: string) => Promise<string>;
  generateAnimation: (prompt: string) => Promise<AnimationGenerateResult>;
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
  exportAnimation: (filename: string, format: 'svg' | 'json', includeBackground?: boolean) => void;
  canExportAsSvg: () => boolean;
  chatHistory: Message[];
  setChatHistory: React.Dispatch<React.SetStateAction<Message[]>>;
  svgRef: SVGSVGElement | null;
  togglePlayPause: () => void;
  isReverse: boolean;
  setIsReverse: (isReverse: boolean) => void;
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
  const [aiProvider, setAIProviderState] = useState<AIProviderId>('openai');
  const [aiModel, setAIModelState] = useState<string>('');
  const [defaultProvider, setDefaultProvider] = useState<AIProviderId>('openai');
  const [defaultModels, setDefaultModels] = useState<Record<AIProviderId, string>>({
    openai: '',
    anthropic: '',
    google: ''
  });
  const [availableProviders, setAvailableProviders] = useState<AIProviderInfo[]>([]);
  const [playbackSpeed, setPlaybackSpeed] = useState<number | 'groovy'>(1);
  const [chatHistory, setChatHistory] = useState<Message[]>([]);
  const groovyIntervalRef = useRef<number | null>(null);

  // Use a ref to track the current SVG element to avoid unnecessary state updates
  const svgElementRef = useRef<SVGSVGElement | null>(null);

  // Create refs to track in-progress API requests to avoid duplicates
  const animationRequestsInProgress = useRef<Map<string, Promise<any>>>(new Map());

  // Cache for animation listings to prevent redundant API calls
  const animationListCache = useRef<{
    timestamp: number;
    animations: any[];
  } | null>(null);

  // Cache expiration in milliseconds (5 seconds)
  const CACHE_EXPIRATION = 5000;

  const viewerPreferences = useViewerPreferences();

  const getDefaultModelForProvider = useCallback(
    (providerId: AIProviderId) => {
      if (defaultModels[providerId]) {
        return defaultModels[providerId];
      }

      const providerInfo = availableProviders.find((info) => info.id === providerId);
      return providerInfo?.defaultModel || '';
    },
    [availableProviders, defaultModels]
  );

  const setAIProvider = useCallback((providerId: AIProviderId) => {
    setAIProviderState(providerId);
    setAIModelState((prevModel) => {
      const nextModel = getDefaultModelForProvider(providerId);
      return nextModel || prevModel;
    });
  }, [getDefaultModelForProvider]);

  const setAIModel = useCallback((modelId: string) => {
    setAIModelState(modelId);
  }, []);

  const applyProviderSelectionFromData = useCallback(
    (providerValue?: string | null, modelValue?: string | null) => {
      const normalized = normalizeProviderId(providerValue);
      if (normalized) {
        setAIProvider(normalized);
        if (modelValue) {
          setAIModel(modelValue);
        }
      } else {
        setAIProvider(defaultProvider);
      }
    },
    [defaultProvider, setAIProvider, setAIModel]
  );

  // Reference to store the last processed clip ID
  const lastProcessedClipRef = useRef<string | null>(null);
  // Debounce timer reference
  const clipChangeDebounceRef = useRef<number | null>(null);

  // Fetch provider configuration from backend on initial load
  useEffect(() => {
    const fetchProviderConfig = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();

        if (!data.config) {
          return;
        }

        const providers: AIProviderInfo[] = Array.isArray(data.config.providers)
          ? data.config.providers
          : [];

        if (providers.length > 0) {
          setAvailableProviders(providers);
        }

        const combinedDefaults: Record<AIProviderId, string> = {
          openai: '',
          anthropic: '',
          google: ''
        };

        const applyDefaults = (map?: Record<string, string>) => {
          if (!map) return;
          Object.entries(map).forEach(([key, value]) => {
            const normalized = normalizeProviderId(key);
            if (normalized && typeof value === 'string') {
              combinedDefaults[normalized] = value;
            }
          });
        };

        applyDefaults(data.config.defaults);
        applyDefaults(data.config.currentModels);

        providers.forEach((providerInfo) => {
          if (!combinedDefaults[providerInfo.id]) {
            combinedDefaults[providerInfo.id] = providerInfo.defaultModel;
          }
        });

        setDefaultModels(combinedDefaults);

        const backendProvider = normalizeProviderId(data.config.aiProvider) || 'openai';
        const initialSelection = buildProviderSelection(providers, {
          provider: backendProvider,
          model: combinedDefaults[backendProvider]
        });

        console.log(`Setting default AI provider from backend: ${initialSelection.provider} (${initialSelection.model})`);

        setAIProviderState(initialSelection.provider);
        setAIModelState(initialSelection.model);
        setDefaultProvider(initialSelection.provider);
      } catch (error) {
        console.error('Error fetching provider configuration:', error);
      }
    };

    fetchProviderConfig();
  }, []);

  // Try to restore state from session storage on initial load
  useEffect(() => {
    const isMobile = isMobileDevice();
    const isFresh = isFreshPageLoad();

    // For desktop page reloads, we still clear most animation state
    // but will allow the aiProvider to be set by the animation loading process
    if (!isMobile && isFresh) {
      // Clear session storage but don't reset aiProvider
      // We'll let the loadAnimation method set it from the server response
      sessionStorage.removeItem(SESSION_STORAGE_KEY);
      console.log('Desktop page reload detected - cleared animation state but preserving provider settings');
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
            const normalized = normalizeProviderId(parsedState.aiProvider) || defaultProvider;
            setAIProvider(normalized);
          }
          if (parsedState.aiModel) {
            setAIModel(parsedState.aiModel);
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
          aiModel,
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
  }, [svgContent, chatHistory, aiProvider, aiModel, playbackSpeed]);

  useEffect(() => {
    sessionStorage.setItem('animation_provider', aiProvider);
    if (aiModel) {
      sessionStorage.setItem('animation_model', aiModel);
    }
  }, [aiProvider, aiModel]);

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
        chatHistory,
        {
          provider: aiProvider,
          model: aiModel
        }
      );

      console.log(`Animation saved to server with ID: ${result.id}`);

      // Set a flag to force UI refresh from server data after saving
      sessionStorage.setItem('force_server_refresh', 'true');

      // For client-side cache, also save locally with the server ID
      try {
        // Get existing saved animations
        const savedAnimationsStr = localStorage.getItem('savedAnimations') || '{}';
        const savedAnimations = JSON.parse(savedAnimationsStr);

        // Add/update the current animation with chat history and server ID
        savedAnimations[name] = {
          id: result.id, // Always store the server ID for reference
          svg: svgContent,
          chatHistory,
          timestamp: new Date().toISOString(),
          provider: aiProvider,
          model: aiModel
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
          timestamp: new Date().toISOString(),
          provider: aiProvider,
          model: aiModel
        };

        localStorage.setItem('savedAnimations', JSON.stringify(savedAnimations));
        console.log(`Animation saved locally as fallback: ${name}`);
      } catch (localError) {
        console.error(`Error in local fallback save: ${localError}`);
      }
    }
  }, [svgContent]);

  // Get saved animations from server
  const getSavedAnimations = useCallback(async (): Promise<any[]> => {
    try {
      // Check the registry first
      const cachedList = AnimationRegistryHelpers.getAnimationList(CACHE_EXPIRATION);
      if (cachedList !== null) {
        return cachedList;
      }

      // Create a unique ID for this request
      const requestId = `list-animations-${Date.now()}`;

      // Use the registry helper to create or reuse the request
      const request = async () => {
        const animations = await AnimationStorageApi.listAnimations();

        // Store in registry for future use
        AnimationRegistryHelpers.storeAnimationList(animations);

        return animations;
      };

      return AnimationRegistryHelpers.trackRequest(requestId, request());
    } catch (error) {
      console.error('Error getting saved animations:', error);
        return [];
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
  const generateAnimation = useCallback(async (prompt: string): Promise<AnimationGenerateResult> => {
    try {
      console.log(`Generating animation via API with prompt: "${prompt}"`);
      const result = await AnimationApi.generate(prompt, {
        provider: aiProvider,
        model: aiModel
      });
      applyProviderSelectionFromData(result.provider, result.model);
      // Return the full result including animation ID if available
      return result;
    } catch (error) {
      console.error('Error generating animation via API:', error);
      throw error;
    }
  }, [aiProvider, aiModel, applyProviderSelectionFromData]);

  // Generate a new animation from a prompt
  const generateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    // Create a request ID to track this specific request
    const requestId = `generate-${prompt.substring(0, 20)}`;

    // Check if this exact request is already in progress
    if (animationRequestsInProgress.current.has(requestId)) {
      console.log('Duplicate animation request detected, reusing in-progress request');
      // Return the promise from the request already in progress
      return animationRequestsInProgress.current.get(requestId)!;
    }

    console.log('Generating animation from prompt:', prompt);

    // Create a promise for this request
    const requestPromise = (async () => {
      try {
        const result = await AnimationApi.generate(prompt, {
          provider: aiProvider,
          model: aiModel
        });
        console.log('Generated animation result');
        applyProviderSelectionFromData(result.provider, result.model);

        // Set the SVG content with broadcast
        setSvgContentWithBroadcast(result.svg, 'new-animation');

        // If animation has an ID from backend, store it in chat history for reference
        if (result.animationId) {
          console.log(`Animation saved on server with ID: ${result.animationId}`);
        }

        return result.message;
      } catch (error: any) {
        console.error('Error generating animation:', error);
        throw error;
      } finally {
        // Remove this request from the in-progress map
        animationRequestsInProgress.current.delete(requestId);
      }
    })();

    // Store the promise in the map
    animationRequestsInProgress.current.set(requestId, requestPromise);

    // Return the promise
    return requestPromise;
  };

  // Broadcast SVG content update to ensure all components are notified
  const broadcastDebounceRef = useRef<number | null>(null);

  const broadcastSvgUpdate = useCallback((source: string) => {
    // Don't broadcast if there's no SVG content to display
    if (!svgContent) {
      return;
    }

    // Clear any previous pending broadcast
    if (broadcastDebounceRef.current) {
      clearTimeout(broadcastDebounceRef.current);
    }

    // Dispatch event to force UI refresh after a small delay to ensure state has been updated
    broadcastDebounceRef.current = window.setTimeout(() => {
      const updateEvent = new CustomEvent('animation-updated', {
        detail: {
          source,
          timestamp: Date.now()
        }
      });
      window.dispatchEvent(updateEvent);
      broadcastDebounceRef.current = null;
    }, 100); // Increased debounce time to reduce multiple events
  }, [svgContent]);

  // Enhanced setter for SVG content that also broadcasts updates
  const setSvgContentWithBroadcast = useCallback(
    (newContent: string | ((prev: string) => string), source = 'unknown') => {
    // Direct approach - just set the content and broadcast update
    if (typeof newContent === 'function') {
      setSvgContent(prevContent => {
        const result = newContent(prevContent);
        // Only broadcast if we have actual content after the update
        if (result && result.length > 0) {
          broadcastSvgUpdate(source);
        }
        return result;
      });
    } else {
      // Check if content is actually different before updating
      if (typeof newContent === 'string' && newContent !== svgContent) {
        setSvgContent(newContent);
        // Only broadcast if we have actual content
        if (newContent.length > 0) {
          broadcastSvgUpdate(source);
        }
      }
    }
  }, [broadcastSvgUpdate, svgContent]);

  // Helper function to add timestamp to SVG content to force updates
  const addTimestampToSvg = (content: string): string => {
    // Simply return the original content without modification
    return content;
  };

  // Update the current animation from a prompt
  const updateAnimationFromPrompt = async (prompt: string): Promise<string> => {
    if (!svgContent) {
      return generateAnimationFromPrompt(prompt);
    }

    // Store the original SVG so we can compare if it changed
    const originalSvg = svgContent;
    console.log('Updating existing animation with prompt:', prompt);
    console.log('Original SVG length:', originalSvg.length);

    // Create a request ID to track this specific request
    const requestId = `update-${prompt.substring(0, 20)}`;

    // Check if this exact request is already in progress
    if (animationRequestsInProgress.current.has(requestId)) {
      console.log('Duplicate update request detected, reusing in-progress request');
      // Return the promise from the request already in progress
      return animationRequestsInProgress.current.get(requestId)!;
    }

    console.log('Sending update request to API');

    // Create a promise for this request
    const requestPromise = (async () => {
      try {
        const result = await AnimationApi.update(prompt, originalSvg, {
          provider: aiProvider,
          model: aiModel
        });
        console.log('Received updated animation result from API');
        applyProviderSelectionFromData(result.provider, result.model);

        // Check if the SVG actually changed
        const svgChanged = result.svg !== originalSvg;
        console.log('SVG content changed:', svgChanged);

        if (svgChanged) {
          // Set the new SVG content with broadcast
          setSvgContentWithBroadcast(result.svg, 'prompt-update');
          console.log('SVG content updated and broadcast sent');

          // We don't need the additional event dispatch, removed the setTimeout
        } else {
          console.warn('SVG content did not change after update. This may indicate the API did not modify the SVG.');
          // Force a re-render even if the content is the same
          setSvgContent(prevContent => {
            // Add a timestamp comment to force React to see this as new content
            const timestampComment = `<!-- Updated ${Date.now()} -->`;
            return prevContent.replace('</svg>', `${timestampComment}</svg>`);
          });

          // Ensure we broadcast this update
          broadcastSvgUpdate('force-refresh-unchanged-content');
          console.log('Added timestamp to force re-render');
        }

        return result.message;
      } catch (error: any) {
        console.error('Error updating animation:', error);
        throw error;
      } finally {
        // Remove this request from the in-progress map
        animationRequestsInProgress.current.delete(requestId);
      }
    })();

    // Store the promise in the map
    animationRequestsInProgress.current.set(requestId, requestPromise);

    // Return the promise
    return requestPromise;
  };

  // Apply playback speed changes
  useEffect(() => {
    if (!svgRef) return;

    // Clear any existing groovy interval
    if (groovyIntervalRef.current) {
      clearInterval(groovyIntervalRef.current);
      groovyIntervalRef.current = null;
    }

    if (playbackSpeed === 'groovy' && playing) {
      // For groovy mode, keep the existing implementation which handles dynamic speed changes
      // For tracking current speeds for smooth transitions in groovy mode
      const currentSpeeds = new Map();
      // For tracking direction for each element
      const currentDirections = new Map();
      // For tracking transition timing for Bezier curves
      const currentTransitions = new Map();
      // For tracking target speeds
      const targetSpeeds = new Map();
      // Track progress through transitions
      const transitionProgress = new Map();

      // For groovy mode, we'll gradually change the speed with smooth Bezier transitions
      groovyIntervalRef.current = window.setInterval(() => {
        // Get all animated elements
        const animatedElements = svgRef.querySelectorAll('[style*="animation"], animate, animateTransform, animateMotion');

        animatedElements.forEach((element, index) => {
          // Generate a unique key for this element
          const elementKey = `element-${index}`;

          // Get current speed or initialize with a value between 0.5 and 1.5
          let currentSpeed = currentSpeeds.get(elementKey);
          let currentDirection = currentDirections.get(elementKey);
          let currentTransition = currentTransitions.get(elementKey);
          let targetSpeed = targetSpeeds.get(elementKey);
          let progress = transitionProgress.get(elementKey) || 0;

          // Initialize values if they don't exist
          if (currentSpeed === undefined) {
            currentSpeed = 0.5 + Math.random();
            currentSpeeds.set(elementKey, currentSpeed);
          }

          if (currentDirection === undefined) {
            currentDirection = 'normal';
            currentDirections.set(elementKey, currentDirection);
          }

          if (currentTransition === undefined) {
            // Generate a random cubic-bezier curve for more interesting easing
            const x1 = Math.random() * 0.8;
            const y1 = Math.random();
            const x2 = 0.2 + Math.random() * 0.8;
            const y2 = Math.random();
            currentTransition = `cubic-bezier(${x1.toFixed(2)}, ${y1.toFixed(2)}, ${x2.toFixed(2)}, ${y2.toFixed(2)})`;
            currentTransitions.set(elementKey, currentTransition);
          }

          // Set a new target speed if needed
          if (targetSpeed === undefined || progress >= 1) {
            // More extreme speed range for more dynamic effects - between 0.15 and 4
            targetSpeed = 0.15 + Math.random() * 3.85;
            targetSpeeds.set(elementKey, targetSpeed);
            progress = 0;

            // Generate a new transition curve periodically
            if (Math.random() < 0.3) {
              const x1 = Math.random() * 0.8;
              const y1 = Math.random();
              const x2 = 0.2 + Math.random() * 0.8;
              const y2 = Math.random();
              currentTransition = `cubic-bezier(${x1.toFixed(2)}, ${y1.toFixed(2)}, ${x2.toFixed(2)}, ${y2.toFixed(2)})`;
              currentTransitions.set(elementKey, currentTransition);
            }
          }

          // Update progress through the transition (0 to 1)
          progress += 0.03 + (Math.random() * 0.02); // Slightly randomize progress increase
          progress = Math.min(1, progress);
          transitionProgress.set(elementKey, progress);

          // Calculate new speed using cubic-bezier interpolation
          // Simple linear interpolation for now - the cubic-bezier is applied via CSS
          const newSpeed = currentSpeed + ((targetSpeed - currentSpeed) * progress);
          currentSpeeds.set(elementKey, newSpeed);

          // Small chance to change direction (5% chance), but with crossfade effect
          const directionChangeThreshold = 0.05;
          if (Math.random() < directionChangeThreshold) {
            currentDirection = currentDirection === 'normal' ? 'reverse' : 'normal';
            currentDirections.set(elementKey, currentDirection);
          }

          if (element instanceof SVGElement && element.style) {
            // For CSS animations
            element.style.animationDirection = currentDirection;
            element.style.animationDuration = `${3 / newSpeed}s`;

            // Add smooth Bezier curve transition for animation-duration
            element.style.transition = `animation-duration 1.5s ${currentTransition}`;
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

            // Store original duration if not already stored
            if (!element.getAttribute('data-original-dur') && element.getAttribute('dur')) {
              element.setAttribute('data-original-dur', element.getAttribute('dur') || '');
            }

            const dur = parseFloat(element.getAttribute('data-original-dur') || element.getAttribute('dur') || '1s');
            element.setAttribute('dur', `${dur / newSpeed}s`);
          }
        });
      }, 800); // Update more frequently for smoother transitions
    } else {
      // For normal speed changes, use our unified controller
      controlAnimations(svgRef, {
        playState: playing ? 'running' : 'paused',
        shouldReset: false, // Don't reset when changing speed
        playbackSpeed: playbackSpeed,
        initialSetup: false
      });
    }
  }, [svgRef, playbackSpeed, playing]);

  // Animation control methods
  const pauseAnimations = useCallback(() => {
    if (svgRef) {
      try {
        // Use our unified controller for consistent pause behavior
        controlAnimations(svgRef, {
          playState: 'paused',
          shouldReset: false,
          playbackSpeed,
          initialSetup: false
        });

        // Update state
        setPlaying(false);
      } catch (error) {
        console.error('Error in pauseAnimations:', error);
      }
    } else {
      console.warn('Cannot pause animations: SVG reference is null');
    }
  }, [svgRef, playbackSpeed]);

  const resumeAnimations = useCallback(() => {
    if (svgRef) {
      try {
        // Use our unified controller for consistent resume behavior
        controlAnimations(svgRef, {
          playState: 'running',
          shouldReset: false,
          playbackSpeed,
          initialSetup: false
        });

        // Update state
        setPlaying(true);
      } catch (error) {
        console.error('Error in resumeAnimations:', error);
      }
    } else {
      console.warn('Cannot resume animations: SVG reference is null');
    }
  }, [svgRef, playbackSpeed]);

  // Resets animations by cloning and replacing the SVG element
  const resetAnimations = useCallback(() => {
    if (svgRef) {
      try {
        // Use our unified controller for consistent reset behavior
        controlAnimations(svgRef, {
          playState: 'running',
          shouldReset: true,
          playbackSpeed,
          initialSetup: false
        });

        // Ensure playing state is true
        setPlaying(true);
      } catch (error) {
        console.error('Error resetting animations:', error);

        // Fallback: reapply the same content to force a refresh
        if (svgContent) {
          console.log('Using fallback reset method');
          const currentContent = svgContent;

          // Briefly clear content then reapply
          setSvgContent('');

          // Use setTimeout to ensure React processes the state change
          setTimeout(() => {
            setSvgContent(currentContent);
            setPlaying(true);
          }, 10);
        }
      }
    } else {
      setPlaying(true);
    }
  }, [svgRef, svgContent, setPlaying, setSvgContent, playbackSpeed]);

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
  const exportAnimationFn = useCallback((filename: string, format: 'svg' | 'json', includeBackground?: boolean) => {
    if (!svgContent) {
      console.warn('No animation to export');
      return;
    }

    // Only pass the background if includeBackground is true
    const background = includeBackground === false ? undefined : viewerPreferences.currentBackground;
    exportAnimationUtil(svgContent, filename, format, chatHistory, background);
  }, [svgContent, chatHistory, viewerPreferences.currentBackground]);

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
      let animationId = null;

      // Check if this is a direct ID rather than a name (for server-only animations)
      const isUUID = /^[0-9a-f]{8}-([0-9a-f]{4}-){3}[0-9a-f]{12}$/i.test(name);

      if (isUUID) {
        // If the name is actually a UUID, use it directly as the ID
        animationId = name;
      } else if (localData && localData.id) {
        // If we have a cached entry with an ID, use that
        animationId = localData.id;
      }

      // If we have an ID, try to delete from server
      if (animationId) {
        try {
          success = await AnimationStorageApi.deleteAnimation(animationId);
          console.log(`Animation deleted from server with ID: ${animationId}`);
        } catch (serverError) {
          console.warn(`Error deleting from server: ${serverError}`);
        }
      }

      // Also delete from local storage if it exists there
      try {
        // Remove from local storage
        if (savedAnimations[name]) {
          delete savedAnimations[name];
          localStorage.setItem('savedAnimations', JSON.stringify(savedAnimations));
          console.log(`Animation deleted from local storage: ${name}`);
          success = true;
        }
      } catch (localError) {
        console.error(`Error deleting from local storage: ${localError}`);
      }

      // Invalidate the cache if deletion was successful
      if (success) {
        // Force refresh from server on next list request
        animationListCache.current = null;
        sessionStorage.setItem('force_server_refresh', 'true');
      }

      return success;
    } catch (error) {
      console.error(`Error deleting animation: ${error}`);
      return false;
    }
  }, []);

  // Listen for clip selection events and load the associated animation
  useEffect(() => {
    const handleClipChanged = (event: Event) => {
      const customEvent = event as CustomEvent;
      const detail = customEvent.detail;

      if (!detail) return;

      const { clip, clipId } = detail;

      // Skip if no clip data
      if (!clip) return;

      // Check if this is the same clip we're already processing
      if (clipId === lastProcessedClipRef.current) {
        return;
      }

      // Clear any existing debounce timer
      if (clipChangeDebounceRef.current) {
        window.clearTimeout(clipChangeDebounceRef.current);
        clipChangeDebounceRef.current = null;
      }

      // Set as the last processed clip
      lastProcessedClipRef.current = clipId;

      // Use a small debounce to prevent rapid switching issues
      clipChangeDebounceRef.current = window.setTimeout(() => {
        // Mark that we're in a clip change operation (prevent playback conflicts)
        window._isClipChanging = true;

        // First stop any existing animations
        if (svgRef) {
          try {
            svgRef.pauseAnimations();
          } catch (e) {
            // Ignore pause errors
          }
        }

        // Reset state before loading new content
        setSvgContent('');
        setChatHistory([]);

        // Load SVG content with different approaches in sequence
        const loadClipContent = async () => {
          // First - check if we have SVG content directly in the clip
          if (clip.svgContent && clip.svgContent.length > 100) {
            setSvgContent(clip.svgContent);

            if (clip.chatHistory) {
              setChatHistory(clip.chatHistory);
            }

            // Set AI provider if available in clip data
            if (clip.provider || clip.model) {
              applyProviderSelectionFromData(clip.provider, clip.model);
            }

            // Also cache in the registry if we have an animationId
            if (clip.animationId) {
              AnimationRegistryHelpers.storeAnimation(
                clip.animationId,
                clip.svgContent,
                {
                  chatHistory: clip.chatHistory,
                  provider: clip.provider,
                  model: clip.model
                }
              );
            }

            return true;
          }

          // Second - if animationId exists, check registry first
          if (clip.animationId) {
            const animationId = clip.animationId;
            const result = AnimationRegistryHelpers.getAnimation(animationId);

            // Handle each possible status
            switch (result.status) {
              case 'available':
                if (result.svg) {
                  console.log(`[AnimationContext] Using cached animation from registry: ${animationId}`);
                  setSvgContent(result.svg);

                  // Set the chat history if available from registry
                  if (result.metadata?.chatHistory) {
                    setChatHistory(result.metadata.chatHistory);
                  }

                  // Set AI provider if available in metadata, otherwise set to default
                  if (result.metadata?.provider || result.metadata?.model) {
                    applyProviderSelectionFromData(result.metadata.provider, result.metadata.model);
                  } else {
                    applyProviderSelectionFromData(defaultProvider, defaultModels[defaultProvider]);
                  }

                  return true;
                }
                break;

              case 'loading':
                return false;

              case 'failed':
                return false;

              case 'not_found':
                // Not in registry, need to load it
                console.log(`[AnimationContext] Loading animation from server: ${animationId}`);

                // Create a request ID for this animation load
                const requestId = `load-animation-${animationId}`;
                // Mark as loading
                AnimationRegistryHelpers.markLoading(animationId);

                try {
                  const response = await AnimationStorageApi.getAnimation(animationId);
                  // Handle both response formats (direct or wrapped)
                  const animation = response && response.success ? response.animation : response;

                  if (animation?.svg) {
                    // Store in registry with metadata
                    AnimationRegistryHelpers.storeAnimation(
                      animationId,
                      animation.svg,
                      {
                        chatHistory: animation.chatHistory,
                        timestamp: animation.timestamp,
                        provider: animation.provider,
                        model: animation.model
                      }
                    );

                    // Make sure this is still the clip we want to display
                    if (clipId === lastProcessedClipRef.current) {
                      // Set the SVG content
                      setSvgContent(animation.svg);

                      // Set the chat history if available
                      if (animation.chatHistory) {
                        setChatHistory(animation.chatHistory);
                      }

                      // Set AI provider if available in animation data, otherwise default to defaultProvider
                      applyProviderSelectionFromData(animation.provider, animation.model);

                      console.log(`[AnimationContext] Animation loaded: ${animationId}`);
                      return true;
                    } else {
                      return false;
                    }
                  } else {
                    AnimationRegistryHelpers.markFailed(animationId);
                    return false;
                  }
                } catch (error) {
                  console.error(`[AnimationContext] Error loading animation: ${error}`);
                  AnimationRegistryHelpers.markFailed(animationId);
                  return false;
                }
            }
          }

          return false;
        };

        // Load content and then auto-play when ready
        loadClipContent().then(success => {
          // Verify this is still the clip we want to display
          if (clipId !== lastProcessedClipRef.current) {
            window._isClipChanging = false;
            return;
          }

          if (success) {
            // Give SVG time to load into DOM before auto-playing
            setTimeout(() => {
              // Verify again that this is still the clip we want to display
              if (clipId !== lastProcessedClipRef.current) {
                window._isClipChanging = false;
                return;
              }

              // Auto-play when a new clip is selected
              setPlaying(true);

              // Apply running state to the SVG if available
              if (svgRef) {
                controlAnimations(svgRef, {
                  playState: 'running',
                  shouldReset: false,
                  playbackSpeed,
                  initialSetup: false
                });
              }

              // Clear the clip changing flag
              window._isClipChanging = false;

              // Dispatch event to notify other components
              window.dispatchEvent(new CustomEvent('clip-autoplay'));
            }, 150);
          } else {
            // If loading failed, still clear the flag
            window._isClipChanging = false;
          }
        });

        // Clear the debounce reference
        clipChangeDebounceRef.current = null;
      }, 50); // Short debounce to handle rapid clip switching
    };

    // Add event listener
    window.addEventListener('clip-changed', handleClipChanged);

    // Cleanup
    return () => {
      window.removeEventListener('clip-changed', handleClipChanged);
      if (clipChangeDebounceRef.current) {
        window.clearTimeout(clipChangeDebounceRef.current);
      }
    };
  }, [svgRef, setSvgContent, setChatHistory, setAIProvider, defaultProvider, playbackSpeed]);

  // Listen for animation-reset events from other components
  useEffect(() => {
    const handleAnimationReset = () => {
      // Ensure we're in play mode after a reset
      setPlaying(true);
    };

    const handleClipAutoPlay = () => {
      // Ensure we're in play mode when a clip is changed
      setPlaying(true);

      // Apply running state to the SVG if available
      if (svgRef) {
        setTimeout(() => {
          controlAnimations(svgRef, {
            playState: 'running',
            shouldReset: false,
            playbackSpeed,
            initialSetup: false
          });
        }, 50);
      }
    };

    window.addEventListener('animation-reset', handleAnimationReset);
    window.addEventListener('clip-autoplay', handleClipAutoPlay);

    return () => {
      window.removeEventListener('animation-reset', handleAnimationReset);
      window.removeEventListener('clip-autoplay', handleClipAutoPlay);
    };
  }, [svgRef, playbackSpeed]);

  // Load an animation from server by name
  const loadAnimation = useCallback(async (name: string): Promise<ChatData | null> => {
    try {
      // Parse animation name to get the ID
      let animationId: string | undefined;

      // Check if name has the format "name (id)"
      const idMatch = name.match(/^(.+) \(([a-f0-9-]+)\)$/);
      if (idMatch) {
        animationId = idMatch[2];
      } else {
        // Use the whole name as ID if it looks like a UUID
        if (/^[a-f0-9-]{36}$/.test(name)) {
          animationId = name;
        }
      }

      // If we have an ID, create a request ID for tracking
      const requestId = `load-animation-by-name-${animationId || name}`;

      // Create the load request function
      const loadRequest = async () => {
        // If we have an animation ID, check the registry first
        if (animationId) {
          const result = AnimationRegistryHelpers.getAnimation(animationId);

          if (result.status === 'available' && result.svg) {
            console.log(`Using animation from registry: ${animationId}`);
            setSvgContent(result.svg);

            // Set chat history if available
            if (result.metadata?.chatHistory) {
              setChatHistory(result.metadata.chatHistory);
            }

            // Set AI provider if available in metadata, otherwise set to default
            if (result.metadata?.provider || result.metadata?.model) {
              console.log(`Setting AI provider from loaded animation metadata: ${result.metadata?.provider}`);
              applyProviderSelectionFromData(result.metadata?.provider, result.metadata?.model);
            } else {
              console.log(`No provider found for animation ${animationId}, setting to default '${defaultProvider}'`);
              applyProviderSelectionFromData(defaultProvider, defaultModels[defaultProvider]);
            }

            return {
              svg: result.svg,
              chatHistory: result.metadata?.chatHistory,
              timestamp: result.metadata?.timestamp || new Date().toISOString()
            };
          }
        }

        try {
          // Load from server
          console.log(`Loading animation by name: ${name}, id: ${animationId || 'none'}`);

          let response;
          if (animationId) {
            // If we have a direct ID, use the storage API
            response = await AnimationStorageApi.getAnimation(animationId);

            // Check if response has the new format with success and animation properties
            const animationData = response && response.success ? response.animation : response;

            if (animationData && animationData.svg) {
              console.log(`Animation loaded from server: ${name}, ${animationData.svg.length} bytes`);
              setSvgContent(animationData.svg);

              if (animationData.chatHistory) {
                setChatHistory(animationData.chatHistory);
              }

              // Set AI provider if available in animation data, otherwise default to defaultProvider
              console.log(`Setting AI provider from loaded animation: ${animationData.provider}`);
              applyProviderSelectionFromData(animationData.provider, animationData.model);

              // Also store in registry for future use
              AnimationRegistryHelpers.storeAnimation(
                animationId,
                animationData.svg,
                {
                  chatHistory: animationData.chatHistory,
                  timestamp: animationData.timestamp,
                  provider: animationData.provider,
                  model: animationData.model
                }
              );

              return {
                svg: animationData.svg,
                chatHistory: animationData.chatHistory,
                timestamp: animationData.timestamp
              };
            }
          } else {
            // We don't have an ID, search by name
            response = await AnimationStorageApi.listAnimations();

            if (response && Array.isArray(response)) {
              // Filter animations by name
              const matches = response.filter(anim =>
                anim.name.toLowerCase().includes(name.toLowerCase())
              );

              if (matches.length > 0) {
                // Get the first matching animation
                const match = matches[0];

                // Load full animation details
                const animation = await AnimationStorageApi.getAnimation(match.id);
                const animationData = animation && animation.success ? animation.animation : animation;

                if (animationData && animationData.svg) {
                  console.log(`Animation found and loaded from search: ${name}, id: ${match.id}`);
                  setSvgContent(animationData.svg);

                  if (animationData.chatHistory) {
                    setChatHistory(animationData.chatHistory);
                  }

                  // Set AI provider if available in animation data, otherwise default to defaultProvider
                  console.log(`Setting AI provider from loaded animation: ${animationData.provider}`);
                  applyProviderSelectionFromData(animationData.provider, animationData.model);

                  // Store in registry
                  AnimationRegistryHelpers.storeAnimation(
                    match.id,
                    animationData.svg,
                    {
                      chatHistory: animationData.chatHistory,
                      timestamp: animationData.timestamp,
                      provider: animationData.provider,
                      model: animationData.model
                    }
                  );

                  return {
                    svg: animationData.svg,
                    chatHistory: animationData.chatHistory,
                    timestamp: animationData.timestamp
                  };
                }
              }
            }
          }

          console.warn(`Animation not found: ${name}`);
          return null;
        } catch (error) {
          console.error(`Error loading animation: ${error}`);
          return null;
        }
      };

      // Track the request to prevent duplicates
      return await AnimationRegistryHelpers.trackRequest(requestId, loadRequest());
    } catch (error) {
      console.error(`Error in loadAnimation: ${error}`);
      return null;
    }
  }, [setSvgContent, setChatHistory, setAIProvider]);

  return (
    <AnimationContext.Provider
      value={{
        svgContent,
        setSvgContent,
        setSvgContentWithBroadcast,
        svgRef,
        setSvgRef,
        playing,
        setPlaying,
        playbackSpeed,
        setPlaybackSpeed,
        chatHistory,
        setChatHistory,
        aiProvider,
        aiModel,
        setAIProvider,
        setAIModel,
        availableProviders,
        defaultModels,
        generateAnimationFromPrompt,
        updateAnimationFromPrompt,
        generateAnimation,
        loadPreset,
        pauseAnimations,
        resumeAnimations,
        resetAnimations,
        resetEverything,
        saveAnimation,
        loadAnimation,
        getSavedAnimations,
        deleteAnimation,
        exportAnimation: exportAnimationFn,
        canExportAsSvg: canExportAsSvgFn,
        togglePlayPause: pauseAnimations,
        isReverse: typeof playbackSpeed === 'number' && playbackSpeed < 0,
        setIsReverse: (reverse: boolean) => {
          // If currently using a numeric speed, flip its sign based on reverse value
          if (typeof playbackSpeed === 'number') {
            const currentSpeed = Math.abs(playbackSpeed);
            setPlaybackSpeed(reverse ? -currentSpeed : currentSpeed);
          }
        },
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
