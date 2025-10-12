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

  const providerList = useMemo((): AIProviderInfo[] => {
    if (availableProviders.length > 0) {
      return availableProviders;
    }

    return [
      {
        id: 'openai',
        displayName: 'OpenAI',
        defaultModel: 'gpt-4o-mini',
        models: [
          { id: 'gpt-4o-mini', label: 'GPT-4o Mini', useCase: 'Balanced default for SVG animations' },
          { id: 'gpt-4o', label: 'GPT-4o', useCase: 'More capable than mini, good for complex animations' }
        ]
      },
      {
        id: 'anthropic',
        displayName: 'Anthropic Claude',
        defaultModel: 'claude-3-7-sonnet-latest',
        models: [{ id: 'claude-3-7-sonnet-latest', label: 'Claude 3.7 Sonnet', useCase: 'Detailed storytelling and SVG updates' }]
      },
      {
        id: 'google',
        displayName: 'Google Gemini',
        defaultModel: 'gemini-2.5-flash',
        models: [{ id: 'gemini-2.5-flash', label: 'Gemini 2.5 Flash', useCase: 'Fast storyboard and animation drafting' }]
      }
    ];
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
