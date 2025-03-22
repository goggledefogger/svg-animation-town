import React, { useState, useEffect, useRef, KeyboardEvent, useCallback, CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAnimation } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import ConfirmationModal from './ConfirmationModal';
import ExportModal from './ExportModal';
import AnimationList, { AnimationItem } from './AnimationList';
import './Header.css'; // Import custom CSS for shimmer effect
import { Icon } from './ui/Icon';
import { ActionButton } from './ui/ActionButton';
import { EditorDropdown } from './ui/EditorDropdown';

interface HeaderProps {
  onExport?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onGenerate?: () => void;
  onRename?: () => void;
  storyboardName?: string;
  onReset?: () => void;
}

const Header: React.FC<HeaderProps> = ({
  onExport,
  onSave,
  onLoad,
  onGenerate,
  onRename,
  storyboardName,
  onReset
}) => {
  const { resetEverything, saveAnimation, loadAnimation, deleteAnimation, exportAnimation, svgContent, chatHistory } = useAnimation();
  const location = useLocation();
  const [showResetModal, setShowResetModal] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [showExportModal, setShowExportModal] = useState(false);
  const [animationName, setAnimationName] = useState('');
  const [showNavDropdown, setShowNavDropdown] = useState(false);
  const [showAnimationList, setShowAnimationList] = useState(false);
  const mobileNavRef = useRef<HTMLDivElement>(null);
  const desktopNavRef = useRef<HTMLDivElement>(null);
  const animationListButtonRef = useRef<HTMLButtonElement>(null);
  const isMovieEditorPage = location.pathname === '/movie-editor';
  const isMobile = window.innerWidth < 768;

  // Reset - refresh from server and clear session state
  const resetPage = useCallback(() => {
    // Clear all animation state from sessionStorage
    sessionStorage.removeItem('current_animation_state');
    sessionStorage.removeItem('page_just_loaded');
    sessionStorage.setItem('force_server_refresh', 'true');
    resetEverything();
    window.location.reload();
  }, [resetEverything]);

  // Handle confirmation for reset
  const handleResetConfirm = () => {
    setShowResetModal(false);
    if (isMovieEditorPage && onReset) {
      onReset();
    } else {
      resetPage();
    }
  };

  // Close nav when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        (mobileNavRef.current && !mobileNavRef.current.contains(event.target as Node)) &&
        (desktopNavRef.current && !desktopNavRef.current.contains(event.target as Node))
      ) {
        setShowNavDropdown(false);
      }
    }

    document.addEventListener('mousedown', handleClickOutside);
    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [mobileNavRef, desktopNavRef]);

  const handleSave = async () => {
    if (animationName.trim()) {
      await saveAnimation(animationName.trim(), chatHistory);
      setShowSaveModal(false);
      setAnimationName('');
    }
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLInputElement>) => {
    if (e.key === 'Enter') {
      handleSave();
    }
  };

  const handleExport = (filename: string, format: 'svg' | 'json') => {
    exportAnimation(filename, format);
    setShowExportModal(false);
  };

  const handleSelectAnimation = async (animation: AnimationItem) => {
    if (onLoad) {
      setShowAnimationList(false);
      onLoad();
    } else {
      await loadAnimation(animation.id);
      setShowAnimationList(false);
    }
  };

  const handleDeleteAnimation = async (animation: AnimationItem): Promise<boolean> => {
    const success = await deleteAnimation(animation.id);
    if (success) {
      return true;
    }
    return false;
  };

  const getAnimationListPosition = (): CSSProperties => {
    if (!animationListButtonRef.current) return {};

    const rect = animationListButtonRef.current.getBoundingClientRect();
    
    if (window.innerWidth < 768) {  // Mobile view
      return {
        position: 'fixed',
        top: 'auto',
        bottom: '0',
        left: '0',
        right: '0',
        maxHeight: '80vh',
        borderRadius: '16px 16px 0 0'
      };
    }
    
    // Desktop view - position under the button
    return {
      position: 'absolute',
      top: `${rect.bottom + 5}px`,
      right: '0',
      maxHeight: '70vh',
      zIndex: 50
    };
  };

  const createIcon = (path: string) => (
    <Icon path={path} />
  );

  const renderLoadButton = () => {
    const icon = createIcon("M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12");
    
    return (
      <div className="relative">
        <button
          ref={animationListButtonRef}
          onClick={() => setShowAnimationList(!showAnimationList)}
          className={`px-4 py-2.5 rounded-md flex items-center justify-center bg-gray-800 text-white hover:bg-gray-700 focus:outline-none ${showAnimationList ? 'bg-gray-700' : ''}`}
          aria-label="Load Animation"
          title="Load Animation"
        >
          <span className="flex items-center">
            {icon}
            {!isMobile && <span className="ml-2">Load</span>}
          </span>
        </button>

        {showAnimationList && (
          <div 
            style={getAnimationListPosition()}
            className="bg-gotham-blue border border-gray-700 rounded-md shadow-2xl z-50 w-[400px] overflow-auto"
          >
            <AnimationList 
              onSelectAnimation={handleSelectAnimation} 
              onClose={() => setShowAnimationList(false)}
              onDeleteAnimation={handleDeleteAnimation}
              showThumbnails={true}
              maxHeight="max-h-80vh"
              title="Load Animation"
              showSearchFilter={true}
            />
          </div>
        )}
      </div>
    );
  };

  return (
    <header className="relative z-40 bg-gotham-blue border-b border-gray-800 shadow-lg py-3">
      <div className="container px-4 mx-auto flex flex-wrap justify-between items-center gap-2">
        {/* Logo + Dropdown Section */}
        <div className="flex items-center space-x-4">
          <div className="flex items-center">
            <Link to="/" className="mr-3">
              <div className="flex items-center">
                <svg
                  className="w-8 h-8 text-bat-yellow mr-2"
                  fill="currentColor"
                  viewBox="0 0 20 20"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    fillRule="evenodd"
                    d="M10 18a8 8 0 100-16 8 8 0 000 16zM9.555 7.168A1 1 0 008 8v4a1 1 0 001.555.832l3-2a1 1 0 000-1.664l-3-2z"
                    clipRule="evenodd"
                  />
                </svg>
                <span className="font-extrabold text-xl text-white">
                  SVG Animation Town
                </span>
              </div>
            </Link>
          </div>

          {/* Desktop Nav Dropdown */}
          <div className="hidden md:block">
            <EditorDropdown
              isMovieEditorPage={isMovieEditorPage}
              showNav={showNavDropdown}
              setShowNav={setShowNavDropdown}
              dropdownRef={desktopNavRef}
            />
          </div>
        </div>

        {/* Mobile Nav Toggle - shown on small screens */}
        <div className="md:hidden order-1">
          <EditorDropdown
            isMovieEditorPage={isMovieEditorPage}
            showNav={showNavDropdown}
            setShowNav={setShowNavDropdown}
            forMobile={true}
            dropdownRef={mobileNavRef}
          />
        </div>

        {/* Storyboard Name Display - Only show in movie editor */}
        {isMovieEditorPage && storyboardName && (
          <div className="hidden md:flex items-center order-2 md:order-none mx-auto">
            <h2 className="text-white text-lg font-medium flex items-center">
              <svg
                className="w-5 h-5 mr-2 text-bat-yellow"
                fill="currentColor"
                viewBox="0 0 20 20"
                xmlns="http://www.w3.org/2000/svg"
              >
                <path d="M7 3a1 1 0 000 2h6a1 1 0 100-2H7zM4 7a1 1 0 011-1h10a1 1 0 110 2H5a1 1 0 01-1-1zM2 11a2 2 0 012-2h12a2 2 0 012 2v4a2 2 0 01-2 2H4a2 2 0 01-2-2v-4z"></path>
              </svg>
              {storyboardName}
            </h2>
            {onRename && (
              <button
                onClick={onRename}
                className="ml-2 text-gray-400 hover:text-white"
                title="Rename Storyboard"
              >
                <svg
                  className="w-4 h-4"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M11 5H6a2 2 0 00-2 2v11a2 2 0 002 2h11a2 2 0 002-2v-5m-1.414-9.414a2 2 0 112.828 2.828L11.828 15H9v-2.828l8.586-8.586z"
                  ></path>
                </svg>
              </button>
            )}
          </div>
        )}

        {/* Main Actions Section */}
        <div className="flex items-center justify-end space-x-2">
          {/* Conditional Generate Button - Only show in movie editor */}
          {isMovieEditorPage && onGenerate && (
            <ActionButton
              onClick={onGenerate}
              ariaLabel="Generate Storyboard"
              title="Generate Storyboard"
              magical={true}
              icon={
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                  xmlns="http://www.w3.org/2000/svg"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth="2"
                    d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z"
                  ></path>
                </svg>
              }
              text="Generate"
            />
          )}

          {/* Show Save button in animation editor */}
          {!isMovieEditorPage && (
            <ActionButton
              onClick={() => setShowSaveModal(true)}
              ariaLabel="Save Animation"
              title="Save Animation"
              icon={createIcon("M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4")}
              text="Save"
            />
          )}

          {/* Load button in animation editor */}
          {!isMovieEditorPage && renderLoadButton()}

          {/* Export button */}
          <ActionButton
            onClick={() => setShowExportModal(true)}
            ariaLabel="Export Animation"
            title="Export Animation"
            icon={createIcon("M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4")}
            text="Export"
            disabled={!svgContent && !isMovieEditorPage}
          />

          {/* Reset button */}
          <ActionButton
            onClick={() => setShowResetModal(true)}
            ariaLabel="Reset Animation"
            title="Reset Animation"
            icon={createIcon("M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15")}
            text="Reset"
            yellow={true}
          />
        </div>
      </div>

      {/* Modals - conditionally rendered */}
      {showResetModal && (
        <ConfirmationModal
          isOpen={showResetModal}
          title="Reset Animation"
          message={`Are you sure you want to reset the ${isMovieEditorPage ? 'storyboard' : 'animation'}? This will clear all your work.`}
          confirmText="Reset"
          cancelText="Cancel"
          onConfirm={handleResetConfirm}
          onCancel={() => setShowResetModal(false)}
        />
      )}

      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-gotham-blue p-6 rounded-lg shadow-xl max-w-md w-full">
            <h3 className="text-xl font-semibold text-white mb-4">Save Animation</h3>
            <input
              type="text"
              className="w-full px-4 py-2 rounded bg-gray-800 text-white border border-gray-700 focus:outline-none focus:border-bat-yellow"
              placeholder="Enter animation name"
              value={animationName}
              onChange={(e) => setAnimationName(e.target.value)}
              onKeyDown={handleKeyDown}
              autoFocus
            />
            <div className="flex justify-end mt-4 space-x-2">
              <button
                className="px-4 py-2 bg-gray-700 text-white rounded hover:bg-gray-600"
                onClick={() => setShowSaveModal(false)}
              >
                Cancel
              </button>
              <button
                className="px-4 py-2 bg-bat-yellow text-black rounded hover:opacity-90 disabled:opacity-50"
                onClick={handleSave}
                disabled={!animationName.trim()}
              >
                Save
              </button>
            </div>
          </div>
        </div>
      )}

      {showExportModal && (
        <ExportModal
          isOpen={showExportModal}
          onExport={handleExport}
          onCancel={() => setShowExportModal(false)}
          svgContent={svgContent || ''}
        />
      )}
    </header>
  );
};

export default Header;
