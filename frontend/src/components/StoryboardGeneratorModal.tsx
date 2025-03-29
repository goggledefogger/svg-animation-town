import React, { useState, useRef, useEffect } from 'react';

interface StoryboardGeneratorModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onGenerate: (prompt: string, provider: 'openai' | 'claude' | 'gemini', numScenes?: number) => void;
  isLoading: boolean;
}

const StoryboardGeneratorModal: React.FC<StoryboardGeneratorModalProps> = ({
  isOpen,
  onCancel,
  onGenerate,
  isLoading
}) => {
  const [prompt, setPrompt] = useState('');
  const [provider, setProvider] = useState<'openai' | 'claude' | 'gemini'>('openai');
  const [numScenes, setNumScenes] = useState<'auto' | number>('auto');
  const [providerDropdownOpen, setProviderDropdownOpen] = useState(false);
  const [scenesDropdownOpen, setScenesDropdownOpen] = useState(false);
  const providerDropdownRef = useRef<HTMLDivElement>(null);
  const scenesDropdownRef = useRef<HTMLDivElement>(null);

  // Fetch default provider from backend on initial load
  useEffect(() => {
    const fetchDefaultProvider = async () => {
      try {
        const response = await fetch('/api/config');
        const data = await response.json();
        if (data.config && data.config.aiProvider) {
          console.log(`Setting default AI provider from backend: ${data.config.aiProvider}`);
          setProvider(data.config.aiProvider as 'openai' | 'claude' | 'gemini');
        }
      } catch (error) {
        console.error('Error fetching default provider:', error);
      }
    };
    fetchDefaultProvider();
  }, []);

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

  const getProviderDisplayName = (providerValue: 'openai' | 'claude' | 'gemini') => {
    switch (providerValue) {
      case 'openai': return 'OpenAI';
      case 'claude': return 'Claude';
      case 'gemini': return 'Gemini';
      default: return providerValue;
    }
  };

  const getScenesDisplayName = (scenesValue: 'auto' | number) => {
    return scenesValue === 'auto' ? 'Auto' : scenesValue.toString();
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gray-800 rounded-lg p-4 border border-gray-700 w-11/12 max-w-md shadow-xl overflow-hidden">
        <div className="flex justify-between items-center mb-3">
          <h2 className="text-lg font-medium text-white">Generate Storyboard</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mb-4">
          {/* Prompt input */}
          <div className="mb-4">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-1">
              Describe Your Storyboard
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:border-bat-yellow min-h-24 resize-y"
              placeholder="Enter a description of the story you want to generate as a storyboard..."
              disabled={isLoading}
            />
          </div>

          {/* AI Provider Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              AI Provider
            </label>
            <div className="relative" ref={providerDropdownRef}>
              <button
                type="button"
                className="flex items-center justify-between w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 hover:border-bat-yellow rounded-md focus:outline-none text-white"
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

              {/* Dropdown menu for AI Provider */}
              {providerDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg">
                  <ul role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                    <li>
                      <button
                        type="button"
                        className={`block px-4 py-2 text-sm w-full text-left ${
                          provider === 'openai' ? 'bg-gray-600 text-bat-yellow' : 'text-white hover:bg-gray-600'
                        }`}
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
                        className={`block px-4 py-2 text-sm w-full text-left ${
                          provider === 'claude' ? 'bg-gray-600 text-bat-yellow' : 'text-white hover:bg-gray-600'
                        }`}
                        onClick={() => {
                          setProvider('claude');
                          setProviderDropdownOpen(false);
                        }}
                      >
                        Claude
                      </button>
                    </li>
                    <li>
                      <button
                        type="button"
                        className={`block px-4 py-2 text-sm w-full text-left ${
                          provider === 'gemini' ? 'bg-gray-600 text-bat-yellow' : 'text-white hover:bg-gray-600'
                        }`}
                        onClick={() => {
                          setProvider('gemini');
                          setProviderDropdownOpen(false);
                        }}
                      >
                        Gemini
                      </button>
                    </li>
                  </ul>
                </div>
              )}
            </div>
          </div>

          {/* Number of Scenes Selection */}
          <div className="mb-4">
            <label className="block text-sm font-medium text-gray-300 mb-1">
              Number of Scenes
            </label>
            <div className="relative" ref={scenesDropdownRef}>
              <button
                type="button"
                className="flex items-center justify-between w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 hover:border-bat-yellow rounded-md focus:outline-none text-white"
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

              {/* Dropdown menu for Number of Scenes */}
              {scenesDropdownOpen && (
                <div className="absolute z-10 mt-1 w-full bg-gray-700 border border-gray-600 rounded-md shadow-lg">
                  <ul role="menu" aria-orientation="vertical" aria-labelledby="options-menu">
                    <li>
                      <button
                        type="button"
                        className={`block px-4 py-2 text-sm w-full text-left ${
                          numScenes === 'auto' ? 'bg-gray-600 text-bat-yellow' : 'text-white hover:bg-gray-600'
                        }`}
                        onClick={() => {
                          setNumScenes('auto');
                          setScenesDropdownOpen(false);
                        }}
                      >
                        Auto
                      </button>
                    </li>
                    {[3, 5, 8, 10, 12].map(num => (
                      <li key={num}>
                        <button
                          type="button"
                          className={`block px-4 py-2 text-sm w-full text-left ${
                            numScenes === num ? 'bg-gray-600 text-bat-yellow' : 'text-white hover:bg-gray-600'
                          }`}
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
        </form>

        <div className="flex justify-end space-x-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-bat-yellow hover:bg-bat-yellow/90 disabled:bg-gray-700 disabled:text-gray-400 text-black rounded flex items-center"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin -ml-1 mr-2 h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
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
      </div>
    </div>
  );
};

export default StoryboardGeneratorModal;
