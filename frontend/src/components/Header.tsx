import React, { useState, useEffect, useRef, KeyboardEvent } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import ConfirmationModal from './ConfirmationModal';
import ExportModal from './ExportModal';

const Header: React.FC = () => {
  const { loadPreset, resetEverything, saveAnimation, loadAnimation, getSavedAnimations, exportAnimation, svgContent, chatHistory } = useAnimation();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [animationName, setAnimationName] = useState('');
  const [savedAnimations, setSavedAnimations] = useState<string[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  // Load the list of saved animations when the component mounts or when a new animation is saved
  useEffect(() => {
    setSavedAnimations(getSavedAnimations());
  }, [getSavedAnimations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Remove event listener on cleanup
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef]);

  const handleResetConfirm = () => {
    resetEverything();
    setShowResetModal(false);
  };

  const handleSave = () => {
    if (animationName.trim()) {
      // Use chatHistory directly from AnimationContext
      saveAnimation(animationName.trim(), chatHistory);
      setShowSaveModal(false);
      setAnimationName('');
      // Update the list of saved animations
      setSavedAnimations(getSavedAnimations());
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter' && animationName.trim()) {
      handleSave();
    }
  };

  const handleExport = (filename: string, format: 'svg' | 'json') => {
    exportAnimation(filename, format);
    setShowExportModal(false);
  };

  // Handle export button click
  const handleExportClick = () => {
    setShowExportModal(true);
  };

  return (
    <header className="bg-gotham-blue p-2 md:p-4 border-b border-gray-700">
      <div className="container mx-auto flex flex-row justify-between items-center">
        <div className="flex items-center">
          <svg
            className="w-8 h-8 md:w-10 md:h-10 mr-2 md:mr-3"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
          >
            <circle cx="50" cy="50" r="45" fill="#1a222c" />
            <path
              d="M50 10 C40 25 20 40 15 60 C25 55 35 55 50 70 C65 55 75 55 85 60 C80 40 60 25 50 10"
              fill="#ffdf00"
              className="animate-pulse-glow"
            />
          </svg>
          <h1 className="hidden md:block text-lg md:text-xl font-bold text-white truncate">
            Gotham Animation
          </h1>
        </div>
        <div className="flex items-center space-x-2">
          <div className="flex space-x-1 md:space-x-2">
            <button
              className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-2 md:px-4"
              onClick={() => setShowResetModal(true)}
              aria-label="Reset"
            >
              <svg
                className="w-4 h-4 md:mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15"
                />
              </svg>
              <span className="hidden md:inline">Reset</span>
            </button>
            <button
              className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-2 md:px-4"
              onClick={() => loadPreset('batSignal')}
              aria-label="Bat Signal"
            >
              <svg
                className="w-4 h-4 md:mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M14.828 14.828a4 4 0 01-5.656 0M9 10h.01M15 10h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                />
              </svg>
              <span className="hidden md:inline">Bat Signal</span>
            </button>

            {/* Save Button */}
            <button
              className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-2 md:px-4"
              onClick={() => setShowSaveModal(true)}
              disabled={!svgContent}
              aria-label="Save"
            >
              <svg
                className="w-4 h-4 md:mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4"
                />
              </svg>
              <span className="hidden md:inline">Save</span>
            </button>

            {/* Load Dropdown */}
            <div className="relative" ref={dropdownRef}>
              <button
                className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-2 md:px-4"
                onClick={() => setDropdownOpen(!dropdownOpen)}
                disabled={savedAnimations.length === 0}
                aria-label="Load"
              >
                <svg
                  className="w-4 h-4 md:mr-1"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4 4m0 0l-4-4m4 4V4"
                  />
                </svg>
                <span className="hidden md:inline">Load</span>
              </button>

              {dropdownOpen && (
                <div className="absolute right-0 mt-2 w-48 bg-gray-800 border border-gray-700 rounded-md shadow-lg z-10">
                  <ul className="py-1">
                    {savedAnimations.length > 0 ? (
                      savedAnimations.map((name) => (
                        <li key={name}>
                          <button
                            className="block w-full text-left px-4 py-2 text-sm text-gray-200 hover:bg-gray-700"
                            onClick={() => {
                              loadAnimation(name);
                              setDropdownOpen(false);
                            }}
                          >
                            {name}
                          </button>
                        </li>
                      ))
                    ) : (
                      <li className="px-4 py-2 text-sm text-gray-400">No saved animations</li>
                    )}
                  </ul>
                </div>
              )}
            </div>

            <button
              className="btn btn-primary flex items-center justify-center p-2 md:py-1 md:px-2 md:px-4"
              onClick={handleExportClick}
              disabled={!svgContent}
              aria-label="Export"
            >
              <svg
                className="w-4 h-4 md:mr-1"
                fill="none"
                stroke="currentColor"
                viewBox="0 0 24 24"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
                />
              </svg>
              <span className="hidden md:inline">Export</span>
            </button>
          </div>
        </div>
      </div>

      {/* Reset Confirmation Modal */}
      <ConfirmationModal
        isOpen={showResetModal}
        title="Reset Everything?"
        message="This will clear the current animation and chat history. Are you sure you want to continue?"
        confirmText="Reset"
        cancelText="Cancel"
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetModal(false)}
      />

      {/* Save Animation Modal */}
      <ConfirmationModal
        isOpen={showSaveModal}
        title="Save Animation"
        message={
          <div className="mt-2">
            <label htmlFor="animationName" className="block text-sm font-medium text-gray-300">
              Animation Name
            </label>
            <input
              type="text"
              id="animationName"
              className="mt-1 block w-full rounded-md bg-gray-700 border-gray-600 text-white focus:border-blue-500 focus:ring-blue-500"
              placeholder="Enter a name for your animation"
              value={animationName}
              onChange={(e) => setAnimationName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <p className="mt-2 text-sm text-gray-400">
              This will save both the animation and the current chat history.
            </p>
          </div>
        }
        confirmText="Save"
        cancelText="Cancel"
        onConfirm={handleSave}
        onCancel={() => {
          setShowSaveModal(false);
          setAnimationName('');
        }}
      />

      {/* Export Modal */}
      <ExportModal
        isOpen={showExportModal}
        onCancel={() => setShowExportModal(false)}
        onExport={handleExport}
        svgContent={svgContent}
      />
    </header>
  );
};

export default Header;
