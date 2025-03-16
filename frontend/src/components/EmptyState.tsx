import React, { memo } from 'react';

// Using React.memo to prevent unnecessary re-renders
const EmptyState: React.FC = memo(() => {
  return (
    <div className="absolute inset-0 flex flex-col items-center justify-center text-gray-500 p-4">
      <svg
        className="w-16 h-16 mb-4"
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
      <p className="text-lg text-center">Start a conversation to create animations</p>
      <p className="text-sm mt-2 text-center">Vectorize your life</p>
    </div>
  );
});

// Add a display name for debugging
EmptyState.displayName = 'EmptyState';

export default EmptyState;
