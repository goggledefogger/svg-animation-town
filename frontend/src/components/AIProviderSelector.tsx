import React from 'react';
import { useAnimation } from '../contexts/AnimationContext';

interface AIProviderSelectorProps {
  className?: string;
}

const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({ className }) => {
  const { aiProvider, setAIProvider } = useAnimation();

  return (
    <div className={`flex items-center ${className || ''}`}>
      <label htmlFor="ai-provider" className="mr-2 text-sm font-medium text-gray-300 hidden md:inline-block">
        AI Provider:
      </label>
      <select
        id="ai-provider"
        value={aiProvider}
        onChange={(e) => setAIProvider(e.target.value as 'openai' | 'claude')}
        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5"
      >
        <option value="openai">OpenAI</option>
        <option value="claude">Claude</option>
      </select>
    </div>
  );
};

export default AIProviderSelector;
