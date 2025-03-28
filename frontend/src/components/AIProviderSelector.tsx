import React from 'react';
import { useAnimation } from '../contexts/AnimationContext';

interface AIProviderSelectorProps {
  className?: string;
}

const AIProviderSelector: React.FC<AIProviderSelectorProps> = ({ className }) => {
  const { aiProvider, setAIProvider } = useAnimation();

  return (
    <div className={`flex items-center ${className || ''}`}>
      <select
        id="ai-provider"
        value={aiProvider}
        onChange={(e) => setAIProvider(e.target.value as 'openai' | 'claude' | 'gemini')}
        className="bg-gray-700 border border-gray-600 text-white text-sm rounded-lg focus:ring-blue-500 focus:border-blue-500 block p-1.5"
        aria-label="Select AI Provider"
      >
        <option value="openai">OpenAI</option>
        <option value="claude">Claude</option>
        <option value="gemini">Gemini</option>
      </select>
    </div>
  );
};

export default AIProviderSelector;
