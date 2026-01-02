import { AnimationState, Message } from '../../types/animation';
import { AIProviderId, AIProviderInfo } from '@/types/ai';

// --- Actions ---

export type AnimationAction =
  | { type: 'SET_SVG'; payload: { content: string; source?: string } }
  | { type: 'SET_PLAYING'; payload: boolean }
  | { type: 'SET_PLAYBACK_SPEED'; payload: number | 'groovy' }
  | { type: 'SET_REVERSE'; payload: boolean }
  | { type: 'SET_AI_CONFIG'; payload: { provider?: AIProviderId; model?: string } }
  | { type: 'SET_CHAT_HISTORY'; payload: Message[] | ((prev: Message[]) => Message[]) } // Support functional updates
  | { type: 'SET_AVAILABLE_PROVIDERS'; payload: AIProviderInfo[] }
  | { type: 'SET_DEFAULT_MODELS'; payload: Record<AIProviderId, string> }

  // Lifecycle: Loading
  | { type: 'LOAD_START'; payload: { id?: string; name?: string } }
  | { type: 'LOAD_SUCCESS'; payload: { id?: string; name?: string; svg: string; chatHistory?: Message[]; provider?: AIProviderId; model?: string; timestamp?: string } }
  | { type: 'LOAD_FAILURE'; payload: string }

  // Lifecycle: Generation
  | { type: 'GENERATE_START'; payload: { prompt: string } }
  | { type: 'GENERATE_SUCCESS'; payload: { svg: string; message?: string; id?: string; provider?: AIProviderId; model?: string } }
  | { type: 'GENERATE_FAILURE'; payload: string }

  // Lifecycle: Saving
  | { type: 'SAVE_START' }
  | { type: 'SAVE_SUCCESS'; payload: { id: string; name: string } }
  | { type: 'SAVE_FAILURE'; payload: string }

  // Reset
  | { type: 'RESET_ANIMATION' }
  | { type: 'RESET_EVERYTHING' };

// --- Initial State ---

export const initialState: AnimationState = {
  status: 'IDLE',
  data: {
    svg: '',
    chatHistory: [],
  },
  playback: {
    isPlaying: true,
    speed: 1,
    isReverse: false,
  },
  meta: {
    isDirty: false,
    aiProvider: 'openai',
    aiModel: '',
    availableProviders: [],
    defaultModels: { openai: '', anthropic: '', google: '' },
  },
};

// --- Reducer ---

export function animationReducer(state: AnimationState, action: AnimationAction): AnimationState {
  switch (action.type) {
    case 'SET_SVG':
      return {
        ...state,
        data: { ...state.data, svg: action.payload.content },
        meta: { ...state.meta, isDirty: true }, // Manual edit marks as dirty
      };

    case 'SET_PLAYING':
      return { ...state, playback: { ...state.playback, isPlaying: action.payload } };

    case 'SET_PLAYBACK_SPEED':
      return { ...state, playback: { ...state.playback, speed: action.payload } };

    case 'SET_REVERSE':
      return { ...state, playback: { ...state.playback, isReverse: action.payload } };

    case 'SET_AI_CONFIG':
      return {
        ...state,
        meta: {
          ...state.meta,
          aiProvider: action.payload.provider || state.meta.aiProvider,
          aiModel: action.payload.model || state.meta.aiModel,
        },
      };

    case 'SET_CHAT_HISTORY':
        const newHistory = typeof action.payload === 'function'
            ? action.payload(state.data.chatHistory)
            : action.payload;
        return { ...state, data: { ...state.data, chatHistory: newHistory } };

    case 'SET_AVAILABLE_PROVIDERS':
        return { ...state, meta: { ...state.meta, availableProviders: action.payload } };

    case 'SET_DEFAULT_MODELS':
        return { ...state, meta: { ...state.meta, defaultModels: action.payload } };

    // --- Loading ---
    case 'LOAD_START':
      return {
        ...state,
        status: 'GENERATING', // Reuse generating status for loading spinner if needed, or could add LOADING
        data: { ...state.data, id: action.payload.id, name: action.payload.name },
        error: undefined,
      };

    case 'LOAD_SUCCESS':
      return {
        ...state,
        status: 'IDLE',
        data: {
          id: action.payload.id,
          name: action.payload.name,
          svg: action.payload.svg,
          chatHistory: action.payload.chatHistory || [],
        },
        meta: {
          ...state.meta,
          isDirty: false,
          lastSavedAt: action.payload.timestamp,
          aiProvider: action.payload.provider || state.meta.aiProvider,
          aiModel: action.payload.model || state.meta.aiModel,
        },
        error: undefined,
      };

    case 'LOAD_FAILURE':
        return { ...state, status: 'ERROR', error: action.payload };

    // --- Generation ---
    case 'GENERATE_START':
      return { ...state, status: 'GENERATING', error: undefined };

    case 'GENERATE_SUCCESS':
      return {
        ...state,
        status: 'IDLE',
        data: {
          ...state.data,
          svg: action.payload.svg,
          id: action.payload.id || state.data.id, // Only update ID if provided (new generation)
        },
        meta: {
          ...state.meta,
          isDirty: false, // Auto-saved on generation means clean
          aiProvider: action.payload.provider || state.meta.aiProvider,
          aiModel: action.payload.model || state.meta.aiModel,
        },
      };

    case 'GENERATE_FAILURE':
      return { ...state, status: 'ERROR', error: action.payload };

    // --- Saving ---
    case 'SAVE_START':
      return { ...state, status: 'SAVING', error: undefined };

    case 'SAVE_SUCCESS':
      return {
        ...state,
        status: 'IDLE',
        data: { ...state.data, id: action.payload.id, name: action.payload.name },
        meta: { ...state.meta, isDirty: false, lastSavedAt: new Date().toISOString() },
      };

    case 'SAVE_FAILURE':
      return { ...state, status: 'IDLE', error: action.payload }; // Return to IDLE but with error

    // --- Reset ---
    case 'RESET_ANIMATION':
        return {
            ...state,
            status: 'IDLE',
            data: { ...state.data, svg: '', id: undefined, name: undefined }, // Keep history? Legacy calls resetAnimations() which keeps config but clears content
            meta: { ...state.meta, isDirty: false }
        };

    case 'RESET_EVERYTHING':
        return { ...initialState, meta: { ...initialState.meta, availableProviders: state.meta.availableProviders, defaultModels: state.meta.defaultModels } }; // Keep loaded config

    default:
      return state;
  }
}
