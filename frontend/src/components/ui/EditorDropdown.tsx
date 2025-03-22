import React from 'react';
import { Link } from 'react-router-dom';

interface EditorDropdownProps {
  isMovieEditorPage: boolean;
  showNav: boolean;
  setShowNav: (show: boolean) => void;
  forMobile?: boolean;
  dropdownRef: React.RefObject<HTMLDivElement>;
}

export const EditorDropdown: React.FC<EditorDropdownProps> = ({
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