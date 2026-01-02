import { AIProviderId, AIProviderInfo } from '@/types/ai';
import { AnimationGenerateResult } from '../services/api';

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
  provider?: AIProviderId;
  model?: string;
  id?: string;
}

// Standard Animation State Types
export interface AnimationState {
  status: 'IDLE' | 'GENERATING' | 'SAVING' | 'ERROR';
  data: {
    id?: string;
    name?: string;
    svg: string;
    chatHistory: Message[];
  };
  playback: {
    isPlaying: boolean;
    speed: number | 'groovy';
    isReverse: boolean;
  };
  meta: {
    isDirty: boolean;
    lastSavedAt?: string;
    aiProvider: AIProviderId;
    aiModel: string;
    availableProviders: AIProviderInfo[];
    defaultModels: Record<AIProviderId, string>;
  };
  error?: string;
}

// Context Interface (Must match legacy AnimationContext exactly where possible)
export interface AnimationContextType {
  // Data
  svgContent: string;
  chatHistory: Message[];
  currentAnimationId: string | undefined;
  currentAnimationName: string | undefined;

  // Playback
  playing: boolean;
  playbackSpeed: number | 'groovy';
  isReverse: boolean;
  svgRef: SVGSVGElement | null;

  // AI Config
  aiProvider: AIProviderId;
  aiModel: string;
  availableProviders: AIProviderInfo[];
  defaultModels: Record<AIProviderId, string>;

  // State Setters (Legacy compatibility)
  setPlaying: (playing: boolean) => void;
  setSvgContent: React.Dispatch<React.SetStateAction<string>>;
  setSvgContentWithBroadcast: (newContent: string | ((prev: string) => string), source?: string) => void;
  setSvgRef: (ref: SVGSVGElement | null) => void;
  setAIProvider: (provider: AIProviderId) => void;
  setAIModel: (model: string) => void;
  setPlaybackSpeed: (speed: number | 'groovy') => void;
  setChatHistory: React.Dispatch<React.SetStateAction<Message[]>>;
  setIsReverse: (isReverse: boolean) => void;
  togglePlayPause: () => void;

  // Actions
  generateAnimationFromPrompt: (prompt: string) => Promise<string>;
  updateAnimationFromPrompt: (prompt: string) => Promise<string>;
  generateAnimation: (prompt: string) => Promise<AnimationGenerateResult>;
  saveAnimation: (name: string, chatHistory?: Message[]) => Promise<void>;
  loadAnimation: (name: string) => Promise<ChatData | null>;
  getSavedAnimations: () => Promise<any[]>;
  deleteAnimation: (name: string) => Promise<boolean>;

  // Utilities
  loadPreset: (presetName: string) => Promise<string>;
  pauseAnimations: () => void;
  resumeAnimations: () => void;
  resetAnimations: () => void;
  resetEverything: () => void;
  exportAnimation: (filename: string, format: 'svg' | 'json', includeBackground?: boolean) => void;
  canExportAsSvg: () => boolean;
}
