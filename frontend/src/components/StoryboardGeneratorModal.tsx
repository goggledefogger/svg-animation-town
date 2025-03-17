import React, { useState } from 'react';

interface StoryboardGeneratorModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onGenerate: (prompt: string, provider: 'openai' | 'claude') => void;
  isLoading: boolean;
}

const StoryboardGeneratorModal: React.FC<StoryboardGeneratorModalProps> = ({
  isOpen,
  onCancel,
  onGenerate,
  isLoading
}) => {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<'openai' | 'claude'>('openai');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      onGenerate(prompt.trim(), provider);
    }
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center p-4 z-50">
      <div className="bg-gray-800 rounded-lg p-6 w-full max-w-md">
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-bold text-white">Generate Storyboard</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit}>
          <div className="mb-4">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
              Describe your movie concept
            </label>
            <textarea
              id="prompt"
              rows={5}
              className="w-full p-3 bg-gray-700 rounded border border-gray-600 text-white"
              placeholder="E.g., A Batman story where he fights crime in Gotham City during a blackout"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              required
              disabled={isLoading}
            />
          </div>

          <div className="mb-6">
            <label className="block text-sm font-medium text-gray-300 mb-2">
              AI Provider
            </label>
            <div className="flex space-x-4">
              <div className="flex items-center">
                <input
                  id="openai"
                  type="radio"
                  name="provider"
                  value="openai"
                  checked={provider === 'openai'}
                  onChange={() => setProvider('openai')}
                  className="h-4 w-4 text-bat-yellow focus:ring-bat-yellow"
                  disabled={isLoading}
                />
                <label htmlFor="openai" className="ml-2 text-gray-300">
                  OpenAI
                </label>
              </div>
              <div className="flex items-center">
                <input
                  id="claude"
                  type="radio"
                  name="provider"
                  value="claude"
                  checked={provider === 'claude'}
                  onChange={() => setProvider('claude')}
                  className="h-4 w-4 text-bat-yellow focus:ring-bat-yellow"
                  disabled={isLoading}
                />
                <label htmlFor="claude" className="ml-2 text-gray-300">
                  Claude
                </label>
              </div>
            </div>
          </div>

          <div className="flex justify-end space-x-2">
            <button
              type="button"
              onClick={onCancel}
              className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              disabled={isLoading}
            >
              Cancel
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-bat-yellow hover:bg-yellow-500 text-black font-medium rounded flex items-center"
              disabled={isLoading || !prompt.trim()}
            >
              {isLoading ? (
                <>
                  <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-black" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                    <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                    <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                  </svg>
                  Generating...
                </>
              ) : (
                'Generate Storyboard'
              )}
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

export default StoryboardGeneratorModal;
