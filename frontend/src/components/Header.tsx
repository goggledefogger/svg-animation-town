import React, { useState } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import ConfirmationModal from './ConfirmationModal';

const Header: React.FC = () => {
  const { loadPreset, resetEverything } = useAnimation();
  const [showResetModal, setShowResetModal] = useState(false);

  const handleResetConfirm = () => {
    resetEverything();
    setShowResetModal(false);
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
          <h1 className="text-lg md:text-xl font-bold text-white truncate">
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
            <button
              className="btn btn-primary flex items-center justify-center p-2 md:py-1 md:px-2 md:px-4"
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

      {/* Confirmation Modal */}
      <ConfirmationModal
        isOpen={showResetModal}
        title="Reset Everything?"
        message="This will clear the current animation and chat history. Are you sure you want to continue?"
        confirmText="Reset"
        cancelText="Cancel"
        onConfirm={handleResetConfirm}
        onCancel={() => setShowResetModal(false)}
      />
    </header>
  );
};

export default Header;
