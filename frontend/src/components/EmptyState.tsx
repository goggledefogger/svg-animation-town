import React, { memo } from 'react';

interface EmptyStateProps {
  loading?: boolean;
  showMessage?: boolean;
  svgContent?: string;
}

// Using React.memo to prevent unnecessary re-renders
const EmptyState: React.FC<EmptyStateProps> = memo(({
  loading = false,
  showMessage = true,
  svgContent = ''
}) => {
  // Don't show anything if there's SVG content
  if (svgContent) return null;

  return (
    <div className="w-full h-full flex flex-col items-center justify-center text-gray-500 p-4">
      {loading ? (
        <div className="relative flex items-center justify-center transform scale-75 sm:scale-100">
          {/* Pulsing loading indicator */}
          <svg className="w-24 h-24 animate-spin-slow drop-shadow-lg" viewBox="0 0 100 100" xmlns="http://www.w3.org/2000/svg">
            <path
              d="M50,10 C40,25 20,40 15,60 C25,55 35,55 50,70 C65,55 75,55 85,60 C80,40 60,25 50,10"
              fill="none"
              stroke="#ffdf00"
              strokeWidth="3"
              strokeDasharray="240"
              strokeDashoffset="0"
              className="animate-dash-offset-300"
            />
          </svg>
          <div className="absolute inset-0 flex items-center justify-center">
            <div className="w-6 h-6 bg-bat-yellow rounded-full animate-ping opacity-80"></div>
          </div>
        </div>
      ) : (
        <>
          <svg
            className="w-14 h-14 sm:w-16 sm:h-16 mb-3 sm:mb-4 opacity-80"
            viewBox="0 0 100 100"
            xmlns="http://www.w3.org/2000/svg"
            aria-hidden="true"
          >
            <circle cx="50" cy="50" r="45" fill="#1a222c" />
            <path
              d="M50 10 C40 25 20 40 15 60 C25 55 35 55 50 70 C65 55 75 55 85 60 C80 40 60 25 50 10"
              fill="#333"
            />
          </svg>
          {showMessage && (
            <div className="text-center px-2">
              <p className="text-base sm:text-lg font-medium">Start a conversation to create animations</p>
              <p className="text-xs sm:text-sm mt-1 sm:mt-2 text-gray-400">Vectorize your life</p>
            </div>
          )}
        </>
      )}
    </div>
  );
});

// Add a display name for debugging
EmptyState.displayName = 'EmptyState';

export default EmptyState;
