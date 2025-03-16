import React, { useState, useRef } from 'react';

interface MessageInputProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSubmit, isProcessing }) => {
  const [inputValue, setInputValue] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  // Handle submit
  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || isProcessing) return;

    onSubmit(inputValue);
    setInputValue('');
  };

  // Simple focus handler to ensure the input is visible when the keyboard appears
  const handleFocus = () => {
    // Ensure the input is visible by scrolling to it after a short delay
    // to let the keyboard appear first
    setTimeout(() => {
      // Use simple window.scrollTo to ensure the input is visible
      window.scrollTo(0, document.body.scrollHeight);
    }, 300);
  };

  return (
    <form onSubmit={handleSubmit} className="flex">
      <input
        ref={inputRef}
        type="text"
        value={inputValue}
        onChange={(e) => setInputValue(e.target.value)}
        onFocus={handleFocus}
        placeholder="Describe animation..."
        className="input flex-grow text-sm md:text-base"
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
