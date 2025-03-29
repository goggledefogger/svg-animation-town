import React, { useState, useRef, useEffect, useCallback } from 'react';
import ReactDOM from 'react-dom';

interface StoryboardGeneratorModalProps {
  isOpen: boolean;
  onCancel: () => void;
  onGenerate: (prompt: string, provider: 'openai' | 'claude' | 'gemini', numScenes?: number) => void;
  isLoading: boolean;
}

// Position return type to satisfy TypeScript
interface DropdownPosition {
  top: number;
  left: number;
  width: number;
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
  const providerButtonRef = useRef<HTMLButtonElement>(null);
  const scenesButtonRef = useRef<HTMLButtonElement>(null);
  const modalRef = useRef<HTMLDivElement>(null);

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

  // Close dropdowns when clicking outside or pressing escape
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (providerDropdownRef.current && !providerDropdownRef.current.contains(event.target as Node) &&
          providerButtonRef.current && !providerButtonRef.current.contains(event.target as Node)) {
        setProviderDropdownOpen(false);
      }
      if (scenesDropdownRef.current && !scenesDropdownRef.current.contains(event.target as Node) &&
          scenesButtonRef.current && !scenesButtonRef.current.contains(event.target as Node)) {
        setScenesDropdownOpen(false);
      }
    }

    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === 'Escape') {
        setProviderDropdownOpen(false);
        setScenesDropdownOpen(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    document.addEventListener('keydown', handleEscapeKey);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
      document.removeEventListener('keydown', handleEscapeKey);
    };
  }, []);

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

  // Get dropdown position for provider dropdown
  const getProviderDropdownPosition = useCallback((): DropdownPosition => {
    if (!providerButtonRef.current) return { top: 0, left: 0, width: 100 };

    const rect = providerButtonRef.current.getBoundingClientRect();
    const modalRect = modalRef.current?.getBoundingClientRect() || { top: 0, left: 0, width: 0 };
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(3 * 40, window.innerHeight * 0.3); // Approx 3 items, max 30% of viewport

    // Position calculations
    let top = rect.bottom + 5;
    let left = rect.left;

    // If not enough space below, position above
    if (spaceBelow < dropdownHeight + 10) {
      top = rect.top - dropdownHeight - 5;
    }

    // Make sure dropdown doesn't go off screen
    if (top < 0) top = 10;
    if (top + dropdownHeight > window.innerHeight) {
      top = window.innerHeight - dropdownHeight - 10;
    }

    return {
      top,
      left,
      width: rect.width
    };
  }, []);

  // Get dropdown position for scenes dropdown
  const getScenesDropdownPosition = useCallback((): DropdownPosition => {
    if (!scenesButtonRef.current) return { top: 0, left: 0, width: 100 };

    const rect = scenesButtonRef.current.getBoundingClientRect();
    const spaceBelow = window.innerHeight - rect.bottom;
    const dropdownHeight = Math.min(9 * 40, window.innerHeight * 0.4); // Approx 9 items, max 40% of viewport

    // Position calculations
    let top = rect.bottom + 5;
    let left = rect.left;

    // If not enough space below, position above
    if (spaceBelow < dropdownHeight + 10) {
      top = rect.top - dropdownHeight - 5;
    }

    // Make sure dropdown doesn't go off screen
    if (top < 0) top = 10;
    if (top + dropdownHeight > window.innerHeight) {
      top = window.innerHeight - dropdownHeight - 10;
    }

    // Adjust position if dropdown would go off right edge
    if (left + rect.width > window.innerWidth) {
      left = window.innerWidth - rect.width - 10;
    }

    return {
      top,
      left,
      width: rect.width
    };
  }, []);

  // Render dropdown using portal pattern to avoid containment issues
  const renderDropdown = (
    isOpen: boolean,
    getPosition: () => DropdownPosition,
    options: Array<{ value: any, label: string }>,
    currentValue: any,
    onSelect: (value: any) => void,
    highlightColor: string = 'text-bat-yellow'
  ) => {
    if (!isOpen) return null;

    const position = getPosition();

    return ReactDOM.createPortal(
      <div
        ref={isOpen === providerDropdownOpen ? providerDropdownRef : scenesDropdownRef}
        className="fixed z-[9999] bg-gray-700 border border-gray-600 rounded-md shadow-xl overflow-y-auto"
        style={{
          top: `${position.top}px`,
          left: `${position.left}px`,
          width: `${position.width}px`,
          maxHeight: '40vh',
          animation: 'dropdown-fade 150ms ease-out',
        }}
      >
        <ul className="py-1" role="menu" aria-orientation="vertical">
          {options.map(option => (
            <li key={String(option.value)} className="px-1">
              <button
                type="button"
                className={`block px-3 py-2 text-sm w-full text-left rounded-sm transition-colors ${
                  currentValue === option.value
                    ? `bg-gray-600 ${highlightColor}`
                    : 'text-white hover:bg-gray-600/70'
                }`}
                onClick={() => onSelect(option.value)}
              >
                {option.label}
              </button>
            </li>
          ))}
        </ul>
      </div>,
      document.body
    );
  };

  // Render provider dropdown
  const renderProviderDropdown = () => {
    const options = [
      { value: 'openai', label: 'OpenAI' },
      { value: 'claude', label: 'Claude' },
      { value: 'gemini', label: 'Gemini' },
    ];

    return renderDropdown(
      providerDropdownOpen,
      getProviderDropdownPosition,
      options,
      provider,
      (value) => {
        setProvider(value);
        setProviderDropdownOpen(false);
      }
    );
  };

  // Render scenes dropdown
  const renderScenesDropdown = () => {
    const options = [
      { value: 'auto', label: 'Auto' },
      ...([1, 2, 3, 4, 5, 6, 7].map(num => ({
        value: num,
        label: num.toString()
      })))
    ];

    return renderDropdown(
      scenesDropdownOpen,
      getScenesDropdownPosition,
      options,
      numScenes,
      (value) => {
        setNumScenes(value);
        setScenesDropdownOpen(false);
      }
    );
  };

  if (!isOpen) {
    return null;
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div
        ref={modalRef}
        className="bg-gray-800 rounded-lg p-5 border border-gray-700 w-11/12 max-w-md shadow-2xl overflow-auto max-h-[90vh]"
      >
        <div className="flex justify-between items-center mb-4">
          <h2 className="text-xl font-semibold text-white">Generate Storyboard</h2>
          <button
            onClick={onCancel}
            className="text-gray-400 hover:text-white transition-colors p-1 rounded-full hover:bg-gray-700/50"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        <form onSubmit={handleSubmit} className="mb-5">
          {/* Prompt input */}
          <div className="mb-5">
            <label htmlFor="prompt" className="block text-sm font-medium text-gray-300 mb-2">
              Describe Your Storyboard
            </label>
            <textarea
              id="prompt"
              value={prompt}
              onChange={(e) => setPrompt(e.target.value)}
              className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:ring-2 focus:ring-bat-yellow/50 focus:border-bat-yellow min-h-24 resize-y"
              placeholder="Enter a description of the story you want to generate as a storyboard..."
              disabled={isLoading}
            />
          </div>

          {/* AI Provider and Number of Scenes on the same line */}
          <div className="flex flex-wrap gap-3 mb-5">
            {/* AI Provider Selection */}
            <div className="flex-1 min-w-[48%]">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                AI Provider
              </label>
              <div className="relative">
                <button
                  ref={providerButtonRef}
                  type="button"
                  className="flex items-center justify-between w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 hover:border-bat-yellow rounded-md focus:outline-none focus:ring-2 focus:ring-bat-yellow/50 text-white transition-colors"
                  onClick={() => !isLoading && setProviderDropdownOpen(!providerDropdownOpen)}
                  disabled={isLoading}
                  aria-haspopup="listbox"
                  aria-expanded={providerDropdownOpen}
                >
                  <span>{getProviderDisplayName(provider)}</span>
                  <svg
                    className={`ml-2 w-4 h-4 transition-transform duration-200 ${providerDropdownOpen ? 'transform rotate-180' : ''}`}
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

                {/* Provider dropdown rendered via portal */}
                {renderProviderDropdown()}
              </div>
            </div>

            {/* Number of Scenes Selection */}
            <div className="flex-1 min-w-[48%]">
              <label className="block text-sm font-medium text-gray-300 mb-2">
                Number of Scenes
              </label>
              <div className="relative">
                <button
                  ref={scenesButtonRef}
                  type="button"
                  className="flex items-center justify-between w-full px-3 py-2 text-sm bg-gray-700 border border-gray-600 hover:border-bat-yellow rounded-md focus:outline-none focus:ring-2 focus:ring-bat-yellow/50 text-white transition-colors"
                  onClick={() => !isLoading && setScenesDropdownOpen(!scenesDropdownOpen)}
                  disabled={isLoading}
                  aria-haspopup="listbox"
                  aria-expanded={scenesDropdownOpen}
                >
                  <span>{getScenesDisplayName(numScenes)}</span>
                  <svg
                    className={`ml-2 w-4 h-4 transition-transform duration-200 ${scenesDropdownOpen ? 'transform rotate-180' : ''}`}
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

                {/* Scenes dropdown rendered via portal */}
                {renderScenesDropdown()}
              </div>
            </div>
          </div>
        </form>

        <div className="flex justify-end gap-3">
          <button
            type="button"
            onClick={onCancel}
            className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded-md transition-colors"
            disabled={isLoading}
          >
            Cancel
          </button>
          <button
            type="button"
            onClick={handleSubmit}
            className="px-4 py-2 bg-bat-yellow hover:bg-bat-yellow/90 disabled:bg-gray-700 disabled:text-gray-400 text-black rounded-md transition-colors flex items-center gap-2 font-medium"
            disabled={isLoading || !prompt.trim()}
          >
            {isLoading ? (
              <>
                <svg className="animate-spin h-4 w-4 text-current" xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24">
                  <circle className="opacity-25" cx="12" cy="12" r="10" stroke="currentColor" strokeWidth="4"></circle>
                  <path className="opacity-75" fill="currentColor" d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"></path>
                </svg>
                <span>Generating...</span>
              </>
            ) : (
              'Generate Storyboard'
            )}
          </button>
        </div>
      </div>

      {/* Add dropdown animation styles */}
      <style>
        {`
          @keyframes dropdown-fade {
            from { opacity: 0; transform: translateY(-8px); }
            to { opacity: 1; transform: translateY(0); }
          }
        `}
      </style>
    </div>
  );
};

export default StoryboardGeneratorModal;
