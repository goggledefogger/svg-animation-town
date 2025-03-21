import React, { useState, useRef, useEffect } from 'react';

interface StoryboardGeneratorModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onGenerate: (prompt: string, provider: 'openai' | 'claude', numScenes?: number) => void;
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
  const [numScenes, setNumScenes] = useState<'auto' | number>('auto');
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [scenesDropdownOpen, setScenesDropdownOpen] = useState(false);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const scenesDropdownRef = useRef<HTMLDivElement>(null);

  // Close dropdowns when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node)) {
        setProviderDropdownOpen(false);
      }
      if (scenesDropdownRef.current && !scenesDropdownRef.current.contains(event.target as Node)) {
        setScenesDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [providerDropdownRef, scenesDropdownRef]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (prompt.trim()) {
      // Pass undefined for numScenes when 'auto' is selected, otherwise pass the number
      onGenerate(
        prompt.trim(),
        provider,
        numScenes === 'auto' ? undefined : numScenes
      );
    }
  };

  const getProviderDisplayName = (providerValue: 'openai' | 'claude') => {
    return providerValue === 'openai' ? 'OpenAI' : 'Claude';
  };

  const getScenesDisplayName = (scenesValue: 'auto' | number) => {
    return scenesValue === 'auto' ? 'Auto' : scenesValue.toString();
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

          <div className="grid grid-cols-1 gap-4 sm:grid-cols-2 mb-6">
            {/* Dropdown for AI Provider selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                AI Provider
              </label>
              <div className="relative" ref={providerDropdownRef}>
                <button
                  type="button"
                  className={`
                    flex items-center justify-between w-full px-4 py-2 text-sm
                    bg-gray-700 border ${isLoading ? 'border-gray-600' : 'border-gray-600 hover:border-gray-500'}
                    rounded-md focus:outline-none ${provider === 'openai' ? 'text-bat-yellow' : provider === 'claude' ? 'text-bat-yellow' : 'text-white'}
                  `}
                  onClick={() => !isLoading && setProviderDropdownOpen(!providerDropdownOpen)}
                  disabled={isLoading}
                >
                  <span>{getProviderDisplayName(provider)}</span>
                  <svg
                    className={`ml-2 w-4 h-4 transition-transform ${providerDropdownOpen ? 'transform rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {providerDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg">
                    <ul className="py-1 text-sm">
                      <li>
                        <button
                          type="button"
                          className={`w-full px-4 py-2 text-left ${provider === 'openai' ? 'bg-gray-600 text-bat-yellow' : 'text-white hover:bg-gray-600'}`}
                          onClick={() => {
                            setProvider('openai');
                            setProviderDropdownOpen(false);
                          }}
                        >
                          OpenAI
                        </button>
                      </li>
                      <li>
                        <button
                          type="button"
                          className={`w-full px-4 py-2 text-left ${provider === 'claude' ? 'bg-gray-600 text-bat-yellow' : 'text-white hover:bg-gray-600'}`}
                          onClick={() => {
                            setProvider('claude');
                            setProviderDropdownOpen(false);
                          }}
                        >
                          Claude
                        </button>
                      </li>
                    </ul>
                  </div>
                )}
              </div>
            </div>

            {/* Dropdown for Number of Scenes selection */}
            <div>
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Number of Scenes
              </label>
              <div className="relative" ref={scenesDropdownRef}>
                <button
                  type="button"
                  className={`
                    flex items-center justify-between w-full px-4 py-2 text-sm
                    bg-gray-700 border ${isLoading ? 'border-gray-600' : 'border-gray-600 hover:border-gray-500'}
                    rounded-md focus:outline-none text-bat-yellow
                  `}
                  onClick={() => !isLoading && setScenesDropdownOpen(!scenesDropdownOpen)}
                  disabled={isLoading}
                >
                  <span>{getScenesDisplayName(numScenes)}</span>
                  <svg
                    className={`ml-2 w-4 h-4 transition-transform ${scenesDropdownOpen ? 'transform rotate-180' : ''}`}
                    xmlns="http://www.w3.org/2000/svg"
                    viewBox="0 0 20 20"
                    fill="currentColor"
                    aria-hidden="true"
                  >
                    <path
                      fillRule="evenodd"
                      d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z"
                      clipRule="evenodd"
                    />
                  </svg>
                </button>

                {scenesDropdownOpen && (
                  <div className="absolute z-10 w-full mt-1 bg-gray-700 border border-gray-600 rounded-md shadow-lg max-h-60 overflow-auto">
                    <ul className="py-1 text-sm">
                      <li>
                        <button
                          type="button"
                          className={`w-full px-4 py-2 text-left ${numScenes === 'auto' ? 'bg-gray-600 text-bat-yellow' : 'text-white hover:bg-gray-600'}`}
                          onClick={() => {
                            setNumScenes('auto');
                            setScenesDropdownOpen(false);
                          }}
                        >
                          Auto
                        </button>
                      </li>
                      {[1, 2, 3, 4, 5, 6, 7].map(num => (
                        <li key={num}>
                          <button
                            type="button"
                            className={`w-full px-4 py-2 text-left ${numScenes === num ? 'bg-gray-600 text-bat-yellow' : 'text-white hover:bg-gray-600'}`}
                            onClick={() => {
                              setNumScenes(num);
                              setScenesDropdownOpen(false);
                            }}
                          >
                            {num}
                          </button>
                        </li>
                      ))}
                    </ul>
                  </div>
                )}
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
