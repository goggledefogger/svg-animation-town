import React, { useState } from 'react';

interface MessageInputProps {
  onSubmit: (text: string) => void;
  isProcessing: boolean;
}

const MessageInput: React.FC<MessageInputProps> = ({ onSubmit, isProcessing }) => {
  const [inputValue, setInputValue] = useState('');

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();

    if (!inputValue.trim() || isProcessing) return;

    onSubmit(inputValue);
    setInputValue('');
  };

  return (
    <div className="p-3 border-t border-gray-700">
      <form onSubmit={handleSubmit} className="flex">
        <input
          type="text"
          value={inputValue}
          onChange={(e) => setInputValue(e.target.value)}
          placeholder="Describe the animation you want to create..."
          className="input flex-grow"
          disabled={isProcessing}
        />
        <button
          type="submit"
          className="btn btn-primary ml-2"
          disabled={!inputValue.trim() || isProcessing}
        >
          {isProcessing ? (
            <div className="w-5 h-5 border-2 border-transparent border-t-current border-l-current rounded-full animate-spin"></div>
          ) : (
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 5l7 7-7 7M5 5l7 7-7 7" />
            </svg>
          )}
        </button>
      </form>
    </div>
  );
};

export default MessageInput;
