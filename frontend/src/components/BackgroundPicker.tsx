import React, { useRef, useEffect, useState } from 'react';
import ReactDOM from 'react-dom';
import { BackgroundOption, useViewerPreferences } from '../contexts/ViewerPreferencesContext';

interface BackgroundPickerProps {
  isOpen: boolean;
  onClose: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
}

const BackgroundPicker: React.FC<BackgroundPickerProps> = ({ isOpen, onClose, containerRef }) => {
  const { backgroundOptions, currentBackground, setBackground } = useViewerPreferences();
  const pickerRef = useRef<HTMLDivElement>(null);
  const [position, setPosition] = useState({ top: 0, left: 0, placement: 'top' as 'top' | 'bottom' });

  // Calculate position whenever visibility changes or on window resize
  useEffect(() => {
    if (!isOpen || !containerRef.current) return;

    const updatePosition = () => {
      const buttonRect = containerRef.current?.getBoundingClientRect();
      if (!buttonRect) return;

      // Approximate height of the picker
      const pickerHeight = 250;
      const windowHeight = window.innerHeight;

      // Determine if it should appear above or below
      const placementPosition = buttonRect.top > pickerHeight ? 'top' : 'bottom';

      // Calculate position based on placement
      let top: number;
      if (placementPosition === 'top') {
        top = buttonRect.top - pickerHeight - 8; // Place above with margin
      } else {
        top = buttonRect.bottom + 8; // Place below with margin
      }

      // Ensure the picker stays within the viewport
      if (top < 10) top = 10;
      if (top + pickerHeight > windowHeight - 10) {
        top = windowHeight - pickerHeight - 10;
      }

      // Calculate horizontal position (centered on the button)
      let left = buttonRect.left;

      // Adjust if it would extend outside the right edge of viewport
      const pickerWidth = 224; // Approximate width (56 * 4)
      if (left + pickerWidth > window.innerWidth - 10) {
        left = window.innerWidth - pickerWidth - 10;
      }

      setPosition({
        top,
        left,
        placement: placementPosition
      });
    };

    // Update position immediately and on resize
    updatePosition();
    window.addEventListener('resize', updatePosition);
    window.addEventListener('scroll', updatePosition, true);

    return () => {
      window.removeEventListener('resize', updatePosition);
      window.removeEventListener('scroll', updatePosition, true);
    };
  }, [isOpen, containerRef]);

  // Handle click outside to close the picker
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (
        pickerRef.current &&
        !pickerRef.current.contains(event.target as Node) &&
        containerRef.current &&
        !containerRef.current.contains(event.target as Node)
      ) {
        onClose();
      }
    };

    if (isOpen) {
      document.addEventListener('mousedown', handleClickOutside);
    }

    return () => {
      document.removeEventListener('mousedown', handleClickOutside);
    };
  }, [isOpen, onClose, containerRef]);

  if (!isOpen) return null;

  // Group background options by type
  const solidOptions = backgroundOptions.filter(bg => bg.type === 'solid');
  const darkGradients = backgroundOptions.filter(bg => bg.type === 'gradient' && bg.isDark);
  const lightGradients = backgroundOptions.filter(bg => bg.type === 'gradient' && !bg.isDark);

  const pickerContent = (
    <div
      ref={pickerRef}
      style={{
        position: 'fixed',
        top: `${position.top}px`,
        left: `${position.left}px`,
        zIndex: 9999
      }}
      className="p-2 sm:p-3 bg-gray-900 border border-gray-700 rounded-md shadow-xl w-56 sm:w-64"
      onClick={e => e.stopPropagation()}
    >
      <div className="mb-2">
        <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-1 sm:mb-2">Solid Colors</h3>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {solidOptions.map(option => (
            <button
              key={option.id}
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-md border-2 transition-all ${
                currentBackground.id === option.id
                  ? 'border-bat-yellow scale-110'
                  : 'border-transparent hover:border-gray-500'
              }`}
              style={{ backgroundColor: option.value }}
              onClick={() => {
                setBackground(option);
                onClose();
              }}
              aria-label={option.name}
              title={option.name}
            />
          ))}
        </div>
      </div>

      <div className="mb-2">
        <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-1 sm:mb-2">Dark Gradients</h3>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {darkGradients.map(option => (
            <button
              key={option.id}
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-md border-2 transition-all ${
                currentBackground.id === option.id
                  ? 'border-bat-yellow scale-110'
                  : 'border-transparent hover:border-gray-500'
              }`}
              style={{ background: option.value }}
              onClick={() => {
                setBackground(option);
                onClose();
              }}
              aria-label={option.name}
              title={option.name}
            />
          ))}
        </div>
      </div>

      <div>
        <h3 className="text-xs uppercase tracking-wider text-gray-400 mb-1 sm:mb-2">Light Gradients</h3>
        <div className="flex flex-wrap gap-1.5 sm:gap-2">
          {lightGradients.map(option => (
            <button
              key={option.id}
              className={`w-7 h-7 sm:w-9 sm:h-9 rounded-md border-2 transition-all ${
                currentBackground.id === option.id
                  ? 'border-bat-yellow scale-110'
                  : 'border-transparent hover:border-gray-500'
              }`}
              style={{ background: option.value }}
              onClick={() => {
                setBackground(option);
                onClose();
              }}
              aria-label={option.name}
              title={option.name}
            />
          ))}
        </div>
      </div>
    </div>
  );

  // Use portal to render the picker at the document body level
  return ReactDOM.createPortal(pickerContent, document.body);
};

export default BackgroundPicker;
