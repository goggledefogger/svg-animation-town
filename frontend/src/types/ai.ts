export type AIProviderId = 'openai' | 'anthropic' | 'google';

export interface AIModelInfo {
  id: string;
  label: string;
  useCase?: string;
  supportsTemperature?: boolean;
}

export interface AIProviderInfo {
  id: AIProviderId;
  displayName: string;
  description?: string;
  defaultModel: string;
  models: AIModelInfo[];
}

export interface AIConfigResponse {
  aiProvider: AIProviderId;
  providers: AIProviderInfo[];
  defaults: Record<AIProviderId, string>;
  currentModels: Record<AIProviderId, string>;
}

export interface ProviderSelection {
  provider: AIProviderId;
  model: string;
}
