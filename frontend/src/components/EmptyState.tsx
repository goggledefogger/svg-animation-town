import React from 'react';
import { useViewerPreferences } from '../contexts/ViewerPreferencesContext';

interface EmptyStateProps {
  loading?: boolean;
  message?: string;
}

const EmptyState: React.FC<EmptyStateProps> = ({
  loading = false,
  message = 'Start by sending a prompt in the chat'
}) => {
  const { currentBackground } = useViewerPreferences();
  const isDarkMode = currentBackground.isDark;

  return (
    <div className="w-full max-w-full flex flex-col items-center justify-center p-4 text-center overflow-hidden">
      {loading ? (
        <div className="flex flex-col items-center justify-center space-y-4">
          <div className="w-20 h-20 relative">
            <div className="absolute inset-0 flex items-center justify-center">
              <svg className="w-16 h-16 sm:w-20 sm:h-20 animate-spin-slow" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
                <circle
                  cx="50"
                  cy="50"
                  r="40"
                  stroke={isDarkMode ? "#ffdf00" : "#121212"}
                  strokeWidth="4"
                  strokeDasharray="60 30"
                  fill="none"
                />
              </svg>
            </div>
            <div className="absolute inset-0 flex items-center justify-center">
              <svg
                xmlns="http://www.w3.org/2000/svg"
                width="32"
                height="32"
                viewBox="0 0 24 24"
                fill="none"
                stroke={isDarkMode ? "#ffdf00" : "#121212"}
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              >
                <path d="M18 3a3 3 0 0 0-3 3v12a3 3 0 0 0 3 3 3 3 0 0 0 3-3 3 3 0 0 0-3-3H6a3 3 0 0 0-3 3 3 3 0 0 0 3 3 3 3 0 0 0 3-3V6a3 3 0 0 0-3-3 3 3 0 0 0-3 3 3 3 0 0 0 3 3h12a3 3 0 0 0 3-3 3 3 0 0 0-3-3z"></path>
              </svg>
            </div>
          </div>
          <p className={`text-xs sm:text-sm md:text-base ${isDarkMode ? 'text-white' : 'text-gray-800'} opacity-80 mt-3`}>
            Generating animation...
          </p>
        </div>
      ) : (
        <>
          <div className="w-12 h-12 sm:w-16 sm:h-16 mb-3 sm:mb-4 rounded-full flex items-center justify-center">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="32"
              height="32"
              viewBox="0 0 24 24"
              fill="none"
              stroke={isDarkMode ? "#9ca3af" : "#4b5563"}
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
            >
              <path d="M5 5.5A3.5 3.5 0 0 1 8.5 2H12v7H8.5A3.5 3.5 0 0 1 5 5.5z"></path>
              <path d="M12 2h3.5a3.5 3.5 0 1 1 0 7H12V2z"></path>
              <path d="M12 12.5a3.5 3.5 0 1 1 7 0 3.5 3.5 0 1 1-7 0z"></path>
              <path d="M5 19.5A3.5 3.5 0 0 1 8.5 16H12v3.5a3.5 3.5 0 1 1-7 0z"></path>
              <path d="M5 12.5A3.5 3.5 0 0 1 8.5 9H12v7H8.5A3.5 3.5 0 0 1 5 12.5z"></path>
            </svg>
          </div>
          <h3 className={`text-base sm:text-lg md:text-xl font-bold mb-1 sm:mb-2 ${isDarkMode ? 'text-white' : 'text-gray-800'}`}>
            No Animation Yet
          </h3>
          <p className={`text-xs sm:text-sm md:text-base ${isDarkMode ? 'text-gray-300' : 'text-gray-600'} max-w-[90%] sm:max-w-xs`}>
            {message}
          </p>
        </>
      )}
    </div>
  );
};

export default EmptyState;
