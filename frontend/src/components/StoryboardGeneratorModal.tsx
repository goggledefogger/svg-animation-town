import React, { useState, KeyboardEvent } from 'react';
import ConfirmationModal from './ConfirmationModal';

interface StoryboardGeneratorModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onGenerate: (prompt: string, aiProvider: 'openai' | 'claude') => void;
  isLoading: boolean;
}

const StoryboardGeneratorModal: React.FC<StoryboardGeneratorModalProps> = ({
  isOpen,
  onCancel,
  onGenerate,
  isLoading
}) => {
  const [prompt, setPrompt] = useState('');
  const [aiProvider, setAIProvider] = useState<'openai' | 'claude'>('openai');

  const handleSubmit = () => {
    if (prompt.trim()) {
      onGenerate(prompt.trim(), aiProvider);
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    if (e.key === 'Enter' && e.ctrlKey && prompt.trim()) {
      handleSubmit();
    }
  };

  return (
    <ConfirmationModal
      isOpen={isOpen}
      title="Generate Storyboard"
      message={
        <div className="mt-2">
          <label htmlFor="moviePrompt" className="block text-sm font-medium text-gray-300 mb-2">
            Describe your movie concept
          </label>
          <textarea
            id="moviePrompt"
            className="input min-h-[150px]"
            placeholder="Describe the movie you want to create. Be specific about scenes, transitions, and style."
            value={prompt}
            onChange={(e) => setPrompt(e.target.value)}
            onKeyDown={handleKeyDown}
            disabled={isLoading}
            autoFocus
          />

          <div className="mt-4">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              AI Provider
            </label>
            <div className="flex space-x-4">
              <div className="flex items-center">
                <input
                  id="openai"
                  name="aiProvider"
                  type="radio"
                  className="h-4 w-4 border-gray-600 text-blue-600 focus:ring-blue-500"
                  checked={aiProvider === 'openai'}
                  onChange={() => setAIProvider('openai')}
                  disabled={isLoading}
                />
                <label htmlFor="openai" className="ml-2 block text-sm text-gray-300">
                  OpenAI
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="claude"
                  name="aiProvider"
                  type="radio"
                  className="h-4 w-4 border-gray-600 text-blue-600 focus:ring-blue-500"
                  checked={aiProvider === 'claude'}
                  onChange={() => setAIProvider('claude')}
                  disabled={isLoading}
                />
                <label htmlFor="claude" className="ml-2 block text-sm text-gray-300">
                  Claude
                </label>
              </div>
            </div>
          </div>

          <p className="mt-4 text-sm text-gray-400">
            This will generate a storyboard with multiple scenes based on your description.
            Each scene will be added as a separate clip to your movie.
            <br /><br />
            <strong>Pro tip:</strong> Be specific about the number of scenes, the visual style,
            transitions, and any recurring characters or elements.
          </p>
        </div>
      }
      confirmText={isLoading ? "Generating..." : "Generate Storyboard"}
      cancelText="Cancel"
      onConfirm={handleSubmit}
      onCancel={onCancel}
      confirmDisabled={!prompt.trim() || isLoading}
      showSpinner={isLoading}
    />
  );
};

export default StoryboardGeneratorModal;
