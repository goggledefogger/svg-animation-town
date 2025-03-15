import React from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import AIProviderSelector from './AIProviderSelector';

const Header: React.FC = () => {
  const { loadPreset } = useAnimation();

  return (
    <header className="bg-gotham-blue p-4 border-b border-gray-700">
      <div className="container mx-auto flex flex-col md:flex-row justify-between items-center">
        <div className="flex items-center mb-4 md:mb-0">
          <svg
            className="w-10 h-10 mr-3"
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
          <h1 className="text-xl md:text-2xl font-bold text-white">
            Gotham Animation Studio
          </h1>
        </div>
        <div className="flex flex-col md:flex-row items-center space-y-2 md:space-y-0 md:space-x-4">
          <AIProviderSelector className="mb-2 md:mb-0" />
          <div className="flex space-x-2">
            <button
              className="btn btn-outline text-sm"
              onClick={() => loadPreset('batSignal')}
            >
              Bat Signal
            </button>
            <button className="btn btn-primary text-sm">
              <svg
                className="w-4 h-4 mr-1 inline"
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
              Export
            </button>
          </div>
        </div>
      </div>
    </header>
  );
};

export default Header;
