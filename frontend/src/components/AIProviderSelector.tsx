import React, { useMemo } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import type { AIProviderId, AIProviderInfo, AIModelInfo } from '@/types/ai';

interface AIProviderSelectorProps {
  className?: string;
}

const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({ className }) => {
  const {
    aiProvider,
    aiModel,
    setAIProvider,
    setAIModel,
    availableProviders
  } = useAnimation();

  // Use providers from context (loaded from backend's ai-providers.json)
  const providerList = useMemo((): AIProviderInfo[] => {
    return availableProviders;
  }, [availableProviders]);

  const currentProvider =
    providerList.find((provider: AIProviderInfo) => provider.id === aiProvider) ?? providerList[0];

  const models = currentProvider?.models ?? [];

  const handleProviderChange = (value: string) => {
    const providerId = value as AIProviderId;
    setAIProvider(providerId);
  };

  const handleModelChange = (value: string) => {
    setAIModel(value);
  };

  // If no providers are loaded yet, show a loading state
  if (!providerList || providerList.length === 0) {
    return (
      <div className={`flex flex-col sm:flex-row gap-2 ${className || ''}`}>
        <div className="flex flex-col text-xs text-gray-300">
          <label htmlFor="ai-provider" className="mb-1 uppercase tracking-wide">
            Provider
          </label>
          <div className="bg-gray-700 border border-gray-600 text-gray-400 text-sm rounded-lg px-2 py-1">
            Loading...
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={`flex flex-col sm:flex-row gap-2 ${className || ''}`}>
      <div className="flex flex-col text-xs text-gray-300">
        <label htmlFor="ai-provider" className="mb-1 uppercase tracking-wide">
          Provider
        </label>
        <select
          id="ai-provider"
          value={currentProvider?.id}
          onChange={(e) => handleProviderChange(e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-2 py-1"
          aria-label="Select AI Provider"
        >
          {providerList.map((provider: AIProviderInfo) => (
            <option key={provider.id} value={provider.id}>
              {provider.displayName}
            </option>
          ))}
        </select>
      </div>
      <div className="flex flex-col text-xs text-gray-300 min-w-[160px]">
        <label htmlFor="ai-model" className="mb-1 uppercase tracking-wide">
          Model
        </label>
        <select
          id="ai-model"
          value={models.find((model: AIModelInfo) => model.id === aiModel)?.id || currentProvider?.defaultModel}
          onChange={(e) => handleModelChange(e.target.value)}
          className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 px-2 py-1"
          aria-label="Select AI Model"
          disabled={!models.length}
        >
          {models.map((model: AIModelInfo) => (
            <option key={model.id} value={model.id} title={model.useCase ?? ''}>
              {model.label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
};

export default AIProviderSelector;
