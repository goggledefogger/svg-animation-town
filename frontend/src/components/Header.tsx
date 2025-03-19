import React, { useState, useEffect, useRef, KeyboardEvent, useCallback, CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAnimation } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import ConfirmationModal from './ConfirmationModal';
import ExportModal from './ExportModal';
import AnimationList, { AnimationItem } from './AnimationList';

interface HeaderProps {
  onExport?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onGenerate?: () => void;
  storyboardName?: string;
  onReset?: () => void; // Add new reset prop for movie editor
}

const Header: React.FC<HeaderProps> = ({
  onExport,
  onSave,
  onLoad,
  onGenerate,
  storyboardName,
  onReset
}) => {
  const { loadPreset, resetEverything, saveAnimation, loadAnimation, deleteAnimation, getSavedAnimations, exportAnimation, svgContent, chatHistory } = useAnimation();
  const navigate = useNavigate();
  const location = useLocation();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [animationName, setAnimationName] = useState('');
  const [showMobileNav, setShowMobileNav] = useState(false);
  const [showAnimationList, setShowAnimationList] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const isLoadingRef = useRef(false); // Track loading state to prevent duplicate calls
  const animationListButtonRef = useRef<HTMLButtonElement>(null);
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
    if (isMovieEditorPage && onReset) {
      // Use the movie editor reset function if we're on that page
      onReset();
    } else {
      // Use animation editor reset otherwise
      resetPage();
    }
  };

  // Close mobile nav when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
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
  }, [mobileNavRef]);

  const handleSave = async () => {
    if (animationName.trim()) {
      // Use chatHistory directly from AnimationContext
      await saveAnimation(animationName.trim(), chatHistory);
      setShowSaveModal(false);
      setAnimationName('');
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

  // Handle animation selection
  const handleSelectAnimation = async (animation: AnimationItem) => {
    try {
      console.log(`Loading animation: ${animation.name} with ID: ${animation.id}`);
      await loadAnimation(animation.id);
      setShowAnimationList(false);
    } catch (error) {
      console.error(`Error loading animation "${animation.name}":`, error);
      alert(`Failed to load animation "${animation.name}". Check console for details.`);
    }
  };

  // Handle animation deletion
  const handleDeleteAnimation = async (animation: AnimationItem): Promise<boolean> => {
    try {
      console.log(`Attempting to delete animation: ${animation.name} (${animation.id})`);
      const success = await deleteAnimation(animation.id);
      return success;
    } catch (error) {
      console.error(`Error deleting animation "${animation.name}":`, error);
      return false;
    }
  };

  // Position the animation list relative to the button
  const getAnimationListPosition = (): CSSProperties => {
    if (!animationListButtonRef.current) return {};
    
    const buttonRect = animationListButtonRef.current.getBoundingClientRect();
    const viewportWidth = window.innerWidth;
    
    // Determine if we should align to the right (if near right edge)
    const alignRight = buttonRect.right > viewportWidth - 250;
    
    if (alignRight) {
      return {
        position: 'absolute' as const,
        right: '0',
        top: `${buttonRect.height + 8}px`,
        width: '240px',
        zIndex: 50,
      };
    } else {
      return {
        position: 'absolute' as const, 
        left: '0',
        top: `${buttonRect.height + 8}px`,
        width: '240px',
        zIndex: 50,
      };
    }
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

        {/* Reset Button - Movie Editor */}
        {isMovieEditorPage && (
          <button
            className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
            onClick={() => setShowResetModal(true)}
            aria-label="Reset Movie Editor"
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

        {/* Load Button - Either modal for Movie Editor or animation list for Animation Editor */}
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
          <div className="relative">
            <button
              ref={animationListButtonRef}
              className="btn btn-outline flex items-center justify-center p-2 md:py-1 md:px-4"
              onClick={() => setShowAnimationList(!showAnimationList)}
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

            {showAnimationList && (
              <div style={getAnimationListPosition()}>
                <AnimationList 
                  onSelectAnimation={handleSelectAnimation}
                  onDeleteAnimation={handleDeleteAnimation}
                  onClose={() => setShowAnimationList(false)}
                  title="Load Animation"
                  showThumbnails={true}
                  maxHeight="max-h-96"
                  showSearchFilter={true}
                />
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
