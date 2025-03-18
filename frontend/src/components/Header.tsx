import React, { useState, useEffect, useRef, KeyboardEvent, useCallback } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAnimation } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import ConfirmationModal from './ConfirmationModal';
import ExportModal from './ExportModal';

// Define the animation object type
interface AnimationItem {
  id: string;
  name: string;
  timestamp?: string;
  [key: string]: any; // Allow for other properties
}

interface HeaderProps {
  onExport?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onGenerate?: () => void;
  storyboardName?: string;
}

const Header: React.FC<HeaderProps> = ({
  onExport,
  onSave,
  onLoad,
  onGenerate,
  storyboardName
}) => {
  const { loadPreset, resetEverything, saveAnimation, loadAnimation, deleteAnimation, getSavedAnimations, exportAnimation, svgContent, chatHistory } = useAnimation();
  const navigate = useNavigate();
  const location = useLocation();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [animationName, setAnimationName] = useState('');
  const [savedAnimations, setSavedAnimations] = useState<(string | AnimationItem)[]>([]);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const [showMobileNav, setShowMobileNav] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false); // Track loading state to prevent duplicate calls
  const isMovieEditorPage = location.pathname === '/movie-editor';

  // Reset - refresh from server and clear session state
  const resetPage = useCallback(() => {
    // Clear all animation state from sessionStorage
    sessionStorage.removeItem('current_animation_state');

    // Also clear page_just_loaded flag so the state isn't restored
    sessionStorage.removeItem('page_just_loaded');

    // Set a flag in sessionStorage to indicate we want fresh data from server
    sessionStorage.setItem('force_server_refresh', 'true');

    // Call the resetEverything function to clear in-memory state
    resetEverything();

    // Refresh the page to load fresh data from server
    window.location.reload();
  }, [resetEverything]);

  // Handle confirmation for reset
  const handleResetConfirm = () => {
    setShowResetModal(false);
    resetPage();
  };

  // Load the list of saved animations when the component mounts or when a new animation is saved
  useEffect(() => {
    // Skip if already loading to prevent duplicate API calls
    if (isLoadingRef.current) return;

    const fetchAnimations = async () => {
      try {
        isLoadingRef.current = true; // Set loading flag
        const animationsList = await getSavedAnimations();
        setSavedAnimations(animationsList);
      } catch (error) {
        console.error('Error fetching saved animations:', error);
        setSavedAnimations([]); // Set to empty array if there's an error
      } finally {
        isLoadingRef.current = false; // Clear loading flag
      }
    };

    fetchAnimations();
  }, [getSavedAnimations]);

  // Close dropdown when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (dropdownRef.current && !dropdownRef.current.contains(event.target as Node)) {
        setDropdownOpen(false);
      }
      if (mobileNavRef.current && !mobileNavRef.current.contains(event.target as Node)) {
        setShowMobileNav(false);
      }
    }

    // Add event listener
    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      // Remove event listener on cleanup
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [dropdownRef, mobileNavRef]);

  const handleSave = async () => {
    if (animationName.trim()) {
      // Use chatHistory directly from AnimationContext
      await saveAnimation(animationName.trim(), chatHistory);
      setShowSaveModal(false);
      setAnimationName('');

      // Update the list of saved animations
      try {
        const animationsList = await getSavedAnimations();
        setSavedAnimations(animationsList);
      } catch (error) {
        console.error('Error updating saved animations list:', error);
      }
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

  return (
    <header className="bg-gotham-black p-4 shadow-lg border-b border-gray-700 flex justify-between items-center">
      <div className="flex items-center">
        <div className="flex items-center">
          <img
            src="/favicon.svg"
            alt="Gotham Logo"
            className="h-6 md:h-8 mr-2"
          />
        </div>

        {/* Mobile Editor Selector Dropdown */}
        <div className="md:hidden relative" ref={mobileNavRef}>
          <button
            className="flex items-center space-x-1 px-3 py-1 border border-gray-700 rounded-md bg-gotham-blue text-gray-300 hover:bg-gray-700 focus:outline-none"
            onClick={() => setShowMobileNav(!showMobileNav)}
          >
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-5 w-5"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              {isMovieEditorPage ? (
                // Movie icon
                <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z" />
              ) : (
                // Animation icon
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z" />
              )}
            </svg>
            <svg
              xmlns="http://www.w3.org/2000/svg"
              className="h-4 w-4"
              viewBox="0 0 20 20"
              fill="currentColor"
            >
              <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
            </svg>
          </button>

          {showMobileNav && (
            <div className="absolute top-full left-0 mt-1 bg-gotham-blue border border-gray-700 rounded-md shadow-lg z-50 w-48">
              <div className="py-1">
                <Link
                  to="/"
                  className={`flex items-center px-4 py-2 ${
                    !isMovieEditorPage ? 'bg-gray-700 text-bat-yellow' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  onClick={() => setShowMobileNav(false)}
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
                  </svg>
                  Animation
                </Link>
                <Link
                  to="/movie-editor"
                  className={`flex items-center px-4 py-2 ${
                    isMovieEditorPage ? 'bg-gray-700 text-bat-yellow' : 'text-gray-300 hover:bg-gray-700'
                  }`}
                  onClick={() => setShowMobileNav(false)}
                >
                  <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                    <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
                  </svg>
                  Movie
                </Link>
              </div>
            </div>
          )}
        </div>

        {/* Desktop Navigation Links */}
        <nav className="hidden md:flex space-x-4">
          <Link
            to="/"
            className={`transition-colors ${
              location.pathname === '/'
                ? 'text-bat-yellow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Animation Editor
          </Link>
          <Link
            to="/movie-editor"
            className={`transition-colors ${
              location.pathname === '/movie-editor'
                ? 'text-bat-yellow'
                : 'text-gray-400 hover:text-white'
            }`}
          >
            Movie Editor
          </Link>
        </nav>
      </div>

      {/* Controls section - shows different controls based on page */}
      <div className="flex space-x-2">
        {/* Storyboard name - only shown on movie editor page */}
        {isMovieEditorPage && storyboardName && (
          <span className="hidden md:flex items-center text-sm text-gray-300 mr-4">
            <span className="text-xs text-gray-400 mr-1">Storyboard:</span>
            {storyboardName}
          </span>
        )}

        {/* Generate button - only shown on movie editor page */}
        {isMovieEditorPage && onGenerate && (
          <button
            className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
            onClick={onGenerate}
            aria-label="Generate"
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
                d="M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z"
              />
            </svg>
            <span className="hidden md:inline">Generate with AI</span>
          </button>
        )}

        {/* Reset Button - only shown on animation editor page */}
        {!isMovieEditorPage && (
          <button
            className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
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
        )}

        {/* Save Button */}
        <button
          className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
          onClick={isMovieEditorPage && onSave ? onSave : () => setShowSaveModal(true)}
          disabled={!isMovieEditorPage && !svgContent}
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

        {/* Load Button - Either dropdown for Animation Editor or modal trigger for Movie Editor */}
        {isMovieEditorPage && onLoad ? (
          <button
            className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
            onClick={onLoad}
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
                d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12"
              />
            </svg>
            <span className="hidden md:inline">Load</span>
          </button>
        ) : (
          <div className="relative" ref={dropdownRef}>
            <button
              className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
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
                    savedAnimations.map((animation) => {
                      // Handle both string names and object structures
                      const name = typeof animation === 'string' ? animation : animation.name;
                      const id = typeof animation === 'string' ? null : animation.id;

                      return (
                        <li key={id || name} className="border-b border-gray-700 last:border-b-0">
                          <div className="flex justify-between items-center px-4 py-2">
                            <button
                              className="text-left text-sm text-gray-200 hover:text-bat-yellow flex-grow truncate pr-2"
                              onClick={async () => {
                                try {
                                  // Prefer to load by ID for server-saved animations
                                  const loadId = id || name;
                                  console.log(`Loading animation: ${name} with ID: ${loadId}`);
                                  await loadAnimation(loadId);
                                  setDropdownOpen(false);
                                } catch (error) {
                                  console.error(`Error loading animation "${name}":`, error);
                                  alert(`Failed to load animation "${name}". Check console for details.`);
                                }
                              }}
                            >
                              {name}
                            </button>
                            <button
                              className="text-red-400 hover:text-red-300 text-xs"
                              onClick={async (e) => {
                                e.stopPropagation();
                                if (window.confirm(`Delete animation "${name}"?`)) {
                                  try {
                                    const success = await deleteAnimation(name);
                                    if (success) {
                                      // Refresh the list
                                      const animationsList = await getSavedAnimations();
                                      setSavedAnimations(animationsList);
                                    } else {
                                      alert(`Failed to delete animation "${name}".`);
                                    }
                                  } catch (error) {
                                    console.error(`Error deleting animation "${name}":`, error);
                                    alert(`Error deleting animation "${name}". Check console for details.`);
                                  }
                                }
                              }}
                            >
                              Delete
                            </button>
                          </div>
                        </li>
                      );
                    })
                  ) : (
                    <li className="px-4 py-2 text-sm text-gray-400">No saved animations</li>
                  )}
                </ul>
              </div>
            )}
          </div>
        )}

        {/* Export Button */}
        <button
          className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
          onClick={isMovieEditorPage && onExport ? onExport : () => setShowExportModal(true)}
          disabled={!isMovieEditorPage && !svgContent}
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
              d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
            />
          </svg>
          <span className="hidden md:inline">Export</span>
        </button>
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
              className="input"
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
