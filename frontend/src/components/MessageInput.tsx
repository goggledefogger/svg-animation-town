import React, { useState, useEffect } from 'react';

interface MessageInputProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSubmit, isProcessing }) => {
  const [inputValue, setInputValue] = useState('');
  const [isKeyboardVisible, setIsKeyboardVisible] = useState(false);

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || isProcessing) return;

    onSubmit(inputValue);
    setInputValue('');
  };

  // Detect possible keyboard visibility on mobile
  useEffect(() => {
    const handleResize = () => {
      // Simple heuristic - if viewport height changes significantly, keyboard may be visible
      const viewportHeight = window.visualViewport?.height || window.innerHeight;
      const windowHeight = window.innerHeight;
      setIsKeyboardVisible(windowHeight - viewportHeight > 150);
    };

    // Use visualViewport API if available
    if (window.visualViewport) {
      window.visualViewport.addEventListener('resize', handleResize);
    } else {
      window.addEventListener('resize', handleResize);
    }

    return () => {
      if (window.visualViewport) {
        window.visualViewport.removeEventListener('resize', handleResize);
      } else {
        window.removeEventListener('resize', handleResize);
      }
    };
  }, []);

  return (
    <form onSubmit={handleSubmit} className="flex">
      <input
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        placeholder="Describe animation..."
        className={`input flex-grow text-sm md:text-base ${isKeyboardVisible ? 'pb-8' : ''}`}
        disabled={isProcessing}
      />
      <button
        type="submit"
        className="btn btn-primary ml-2 p-2"
        disabled={!inputValue.trim() || isProcessing}
      >
        {isProcessing ? (
          <div className="w-4 h-4 md:w-5 md:h-5 border-2 border-transparent border-t-current border-l-current rounded-full animate-spin"></div>
        ) : (
          <svg className="w-4 h-4 md:w-5 md:h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
          </svg>
        )}
      </button>
    </form>
  );
};

export default MessageInput;
