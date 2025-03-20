import React, { useState, useEffect, useRef, KeyboardEvent, useCallback, CSSProperties } from 'react';
import { Link, useLocation, useNavigate } from 'react-router-dom';
import { useAnimation } from '../contexts/AnimationContext';
import { useMovie } from '../contexts/MovieContext';
import ConfirmationModal from './ConfirmationModal';
import ExportModal from './ExportModal';
import AnimationList, { AnimationItem } from './AnimationList';
import './Header.css'; // Import custom CSS for shimmer effect

interface HeaderProps {
  onExport?: () => void;
  onSave?: () => void;
  onLoad?: () => void;
  onGenerate?: () => void;
  storyboardName?: string;
  onReset?: () => void;
}

// Icon component for reusability
interface IconProps {
  path: string;
  className?: string;
}

const Icon: React.FC<IconProps> = ({ path, className = "w-5 h-5" }) => (
  <svg
    className={className}
    fill="none"
    stroke="currentColor"
    viewBox="0 0 24 24"
    xmlns="http://www.w3.org/2000/svg"
  >
    <path
      strokeLinecap="round"
      strokeLinejoin="round"
      strokeWidth={2}
      d={path}
    />
  </svg>
);

// Reusable action button component
interface ActionButtonProps {
  onClick: () => void;
  ariaLabel: string;
  title: string;
  icon: React.ReactNode;
  text?: string;
  yellow?: boolean;
  disabled?: boolean;
  magical?: boolean;
}

const ActionButton: React.FC<ActionButtonProps> = ({
  onClick,
  ariaLabel,
  title,
  icon,
  text,
  yellow = false,
  disabled = false,
  magical = false
}) => {
  const isMobile = window.innerWidth < 768;
  const [animate, setAnimate] = useState(false);
  const baseClasses = "rounded-md flex items-center justify-center";
  const colorClasses = magical
    ? "magical-button text-white"
    : yellow
      ? "bg-bat-yellow text-black hover:opacity-90"
      : "bg-gray-800 text-white hover:bg-gray-700";
  const sizeClasses = isMobile ? "p-2.5 w-12 h-12" : "px-5 py-2";

  // Add animation class periodically if magical
  useEffect(() => {
    if (!magical) return;

    // Initial animation on mount
    setAnimate(true);
    const initialTimeout = setTimeout(() => setAnimate(false), 2000);

    // Set up interval to animate every 20 seconds
    const interval = setInterval(() => {
      setAnimate(true);
      setTimeout(() => setAnimate(false), 2000);
    }, 20000);

    // Clean up
    return () => {
      clearTimeout(initialTimeout);
      clearInterval(interval);
    };
  }, [magical]);

  return (
    <button
      className={`${baseClasses} ${colorClasses} ${sizeClasses} ${magical && animate ? 'animate' : ''}`}
      onClick={onClick}
      aria-label={ariaLabel}
      title={title}
      disabled={disabled}
    >
      <span className={magical ? `magical-content ${animate ? 'animate' : ''}` : ""}>{icon}</span>
      {!isMobile && text && <span className={magical ? `magical-content ${animate ? 'animate' : ''} ml-2` : ""}>{text}</span>}
    </button>
  );
};

// Dropdown menu component
interface EditorDropdownProps {
  isMovieEditorPage: boolean;
  showNav: boolean;
  setShowNav: (show: boolean) => void;
  forMobile?: boolean;
  dropdownRef: React.RefObject<HTMLDivElement>;
}

const EditorDropdown: React.FC<EditorDropdownProps> = ({
  isMovieEditorPage,
  showNav,
  setShowNav,
  forMobile = false,
  dropdownRef
}) => {
  const buttonClasses = forMobile
    ? "px-4 py-2.5 rounded-lg bg-gray-800 text-white hover:bg-gray-700 focus:outline-none"
    : "px-4 py-2 rounded-lg bg-gray-800 text-white hover:bg-gray-700 focus:outline-none";

  return (
    <div className="relative" ref={dropdownRef}>
      <button
        className={`flex items-center gap-2 ${buttonClasses}`}
        onClick={() => setShowNav(!showNav)}
        aria-label="Navigation menu"
      >
        <span className="font-medium">
          {isMovieEditorPage ? 'Movie' : 'Animation'}
        </span>
        <svg
          xmlns="http://www.w3.org/2000/svg"
          className="h-4 w-4"
          viewBox="0 0 20 20"
          fill="currentColor"
        >
          <path fillRule="evenodd" d="M5.293 7.293a1 1 0 011.414 0L10 10.586l3.293-3.293a1 1 0 111.414 1.414l-4 4a1 1 0 01-1.414 0l-4-4a1 1 0 010-1.414z" clipRule="evenodd" />
        </svg>
      </button>

      {showNav && (
        <div className="absolute top-full right-0 mt-1 bg-gotham-blue border border-gray-700 rounded-md shadow-lg z-50 w-48">
          <div className="py-1">
            <Link
              to="/"
              className={`flex items-center px-4 py-2 ${
                !isMovieEditorPage ? 'bg-gray-700 text-bat-yellow' : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => setShowNav(false)}
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M13.586 3.586a2 2 0 112.828 2.828l-.793.793-2.828-2.828.793-.793zM11.379 5.793L3 14.172V17h2.828l8.38-8.379-2.83-2.828z"></path>
              </svg>
              Animation Editor
            </Link>
            <Link
              to="/movie-editor"
              className={`flex items-center px-4 py-2 ${
                isMovieEditorPage ? 'bg-gray-700 text-bat-yellow' : 'text-gray-300 hover:bg-gray-700'
              }`}
              onClick={() => setShowNav(false)}
            >
              <svg className="w-5 h-5 mr-2" fill="currentColor" viewBox="0 0 20 20" xmlns="http://www.w3.org/2000/svg">
                <path d="M2 6a2 2 0 012-2h12a2 2 0 012 2v8a2 2 0 01-2 2H4a2 2 0 01-2-2V6z"></path>
              </svg>
              Movie Editor
            </Link>
          </div>
        </div>
      )}
    </div>
  );
};

const Header: React.FC<HeaderProps> = ({
  onExport,
  onSave,
  onLoad,
  onGenerate,
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
    const alignRight = buttonRect.right > viewportWidth - 250;

    return {
      position: 'absolute',
      right: alignRight ? '0' : 'auto',
      left: alignRight ? 'auto' : '0',
      top: `${buttonRect.height + 8}px`,
      width: '240px',
      zIndex: 50,
    };
  };

  // Icon paths
  const iconPaths = {
    reset: "M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15",
    generate: "M19.428 15.428a2 2 0 00-1.022-.547l-2.387-.477a6 6 0 00-3.86.517l-.318.158a6 6 0 01-3.86.517L6.05 15.21a2 2 0 00-1.806.547M8 4h8l-1 1v5.172a2 2 0 00.586 1.414l5 5c1.26 1.26.367 3.414-1.415 3.414H4.828c-1.782 0-2.674-2.154-1.414-3.414l5-5A2 2 0 009 10.172V5L8 4z",
    load: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-8l-4-4m0 0L8 8m4-4v12",
    save: "M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4v8m-6-8v8m1-10V4a1 1 0 011-1h4a1 1 0 011 1v4",
    export: "M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"
  };

  // Create icon components with the right class based on mobile or not
  const createIcon = (path: string) => (
    <Icon path={path} className={`w-5 h-5 ${!isMobile && "mr-2"}`} />
  );

  // Render the Load button (slightly different behavior based on mode)
  const renderLoadButton = () => {
    if (isMovieEditorPage && onLoad) {
      return (
        <ActionButton
          onClick={onLoad}
          ariaLabel="Load"
          title="Load"
          icon={createIcon(iconPaths.load)}
          text="Load"
        />
      );
    }

    return (
      <div className="relative">
        <button
          ref={animationListButtonRef}
          className={`rounded-md bg-gray-800 text-white hover:bg-gray-700 flex items-center justify-center ${isMobile ? "p-2.5 w-12 h-12" : "px-5 py-2"}`}
          onClick={() => setShowAnimationList(!showAnimationList)}
          aria-label="Load"
          title="Load"
        >
          {createIcon(iconPaths.load)}
          {!isMobile && <span>Load</span>}
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
    );
  };

  return (
    <header className="bg-gotham-black shadow-lg border-b border-gray-700">
      {/* Desktop layout - single row */}
      <div className="hidden md:flex justify-between items-center px-4 py-3">
        {/* Left section - logo */}
        <div className="flex items-center">
          <img
            src="/favicon.svg"
            alt="Gotham Logo"
            className="h-7 w-7"
          />
        </div>

        {/* Center section - buttons */}
        <div className="flex items-center gap-3">
          {/* Generate button - only shown on movie editor page */}
          {isMovieEditorPage && onGenerate && (
            <ActionButton
              onClick={onGenerate}
              ariaLabel="Generate"
              title="Generate with AI"
              icon={createIcon(iconPaths.generate)}
              text="Generate"
              magical={true}
            />
          )}

          {/* Reset Button */}
          <ActionButton
            onClick={() => setShowResetModal(true)}
            ariaLabel="Reset"
            title="Reset"
            icon={createIcon(iconPaths.reset)}
            text="Reset"
          />

          {/* Load Button */}
          {renderLoadButton()}

          {/* Save Button */}
          <ActionButton
            onClick={isMovieEditorPage && onSave ? onSave : () => setShowSaveModal(true)}
            disabled={!isMovieEditorPage && !svgContent}
            ariaLabel="Save"
            title="Save"
            icon={createIcon(iconPaths.save)}
            text="Save"
          />

          {/* Export Button - Yellow button */}
          <ActionButton
            onClick={isMovieEditorPage && onExport ? onExport : () => setShowExportModal(true)}
            disabled={!isMovieEditorPage && !svgContent}
            ariaLabel="Export"
            title="Export"
            icon={createIcon(iconPaths.export)}
            text="Export"
            yellow={true}
          />
        </div>

        {/* Right section - dropdown */}
        <EditorDropdown
          isMovieEditorPage={isMovieEditorPage}
          showNav={showNavDropdown}
          setShowNav={setShowNavDropdown}
          dropdownRef={desktopNavRef}
        />
      </div>

      {/* Mobile layout - two rows */}
      <div className="md:hidden flex flex-col space-y-2 p-2">
        {/* Top row with main navigation */}
        <div className="flex justify-between items-center px-2">
          {/* Left side with logo */}
          <div className="flex items-center">
            <img
              src="/favicon.svg"
              alt="Gotham Logo"
              className="h-6 w-6"
            />
          </div>

          {/* Center - storyboard name when in movie mode */}
          {isMovieEditorPage && storyboardName && (
            <span className="text-sm text-gray-300 flex-grow mx-4 text-center">
              <span className="text-gray-400 mr-1">Storyboard:</span>
              {storyboardName}
            </span>
          )}

          {/* Right side with editor dropdown */}
          <EditorDropdown
            isMovieEditorPage={isMovieEditorPage}
            showNav={showNavDropdown}
            setShowNav={setShowNavDropdown}
            forMobile={true}
            dropdownRef={mobileNavRef}
          />
        </div>

        {/* Bottom row with action buttons - left aligned with consistent gap */}
        <div className="flex justify-start gap-3 px-2 overflow-x-auto">
          {/* Generate button - only shown on movie editor page */}
          {isMovieEditorPage && onGenerate && (
            <ActionButton
              onClick={onGenerate}
              ariaLabel="Generate"
              title="Generate with AI"
              icon={createIcon(iconPaths.generate)}
              magical={true}
            />
          )}

          {/* Reset Button */}
          <ActionButton
            onClick={() => setShowResetModal(true)}
            ariaLabel="Reset"
            title="Reset"
            icon={createIcon(iconPaths.reset)}
          />

          {/* Load Button */}
          {renderLoadButton()}

          {/* Save Button */}
          <ActionButton
            onClick={isMovieEditorPage && onSave ? onSave : () => setShowSaveModal(true)}
            disabled={!isMovieEditorPage && !svgContent}
            ariaLabel="Save"
            title="Save"
            icon={createIcon(iconPaths.save)}
          />

          {/* Export Button - Yellow button */}
          <ActionButton
            onClick={isMovieEditorPage && onExport ? onExport : () => setShowExportModal(true)}
            disabled={!isMovieEditorPage && !svgContent}
            ariaLabel="Export"
            title="Export"
            icon={createIcon(iconPaths.export)}
            yellow={true}
          />
        </div>
      </div>

      {/* Modals */}
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
