import React, { useEffect, useRef } from 'react';

export interface ToastProps {
  /**
   * The message to display in the toast
   */
  message: string;

  /**
   * The type of toast to display (affects color and icon)
   */
  type?: 'success' | 'error' | 'info';

  /**
   * Whether to show the toast
   */
  show: boolean;

  /**
   * Duration in milliseconds before the toast auto-hides
   * Default: 3000ms (3 seconds)
   */
  duration?: number;

  /**
   * Position of the toast on the screen
   * Default: 'top-right'
   */
  position?: 'top-right' | 'top-left' | 'bottom-right' | 'bottom-left' | 'top-center' | 'bottom-center';
}

/**
 * Toast notification component that displays a message with an icon
 * and automatically hides after a specified duration.
 */
const Toast: React.FC<ToastProps> = ({
  message,
  type = 'success',
  show,
  duration = 3000,
  position = 'top-right'
}) => {
  // Use refs to track visibility and timer
  const timerRef = useRef<NodeJS.Timeout | null>(null);
  const visibleRef = useRef<boolean>(false);
  const [visible, setVisible] = React.useState(false);

  // When show changes, update visibility
  useEffect(() => {
    if (show && !visible) {
      // Show the toast
      setVisible(true);
      visibleRef.current = true;

      // Clear any existing timer
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }

      // Set up a new timer to hide the toast
      timerRef.current = setTimeout(() => {
        setVisible(false);
        visibleRef.current = false;
      }, duration);
    } else if (!show && visible) {
      // Hide the toast
      setVisible(false);
      visibleRef.current = false;
    }

    // Cleanup on unmount
    return () => {
      if (timerRef.current) {
        clearTimeout(timerRef.current);
      }
    };
  }, [show, duration]);

  // Don't render if not visible
  if (!visible) return null;

  // Determine styles based on type
  const bgColor = type === 'success' ? 'bg-green-800' :
                  type === 'error' ? 'bg-red-800' :
                  'bg-blue-800';

  const iconColor = type === 'success' ? 'text-green-400' :
                    type === 'error' ? 'text-red-400' :
                    'text-blue-400';

  // Determine position classes
  const positionClasses = {
    'top-right': 'top-4 right-4',
    'top-left': 'top-4 left-4',
    'bottom-right': 'bottom-4 right-4',
    'bottom-left': 'bottom-4 left-4',
    'top-center': 'top-4 left-1/2 transform -translate-x-1/2',
    'bottom-center': 'bottom-4 left-1/2 transform -translate-x-1/2'
  }[position];

  return (
    <div className={`fixed ${positionClasses} z-50 shadow-lg`}>
      <div className={`${bgColor} border border-gray-700 rounded-md flex items-center p-3 shadow-lg max-w-md`}>
        <div className={`${iconColor} mr-2 flex-shrink-0`}>
          {type === 'success' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
            </svg>
          )}
          {type === 'error' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          )}
          {type === 'info' && (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" />
            </svg>
          )}
        </div>
        <span className="text-white text-sm">{message}</span>
        <button
          onClick={() => setVisible(false)}
          className="ml-3 text-gray-400 hover:text-white flex-shrink-0"
          aria-label="Close"
        >
          <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
          </svg>
        </button>
      </div>
    </div>
  );
};

export default Toast;
