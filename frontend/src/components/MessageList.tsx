import React from 'react';
import { Message } from './ChatInterface';

interface MessageListProps {
  messages: Message[];
  isTyping: boolean;
  messagesEndRef: React.RefObject<HTMLDivElement>;
}

const MessageList: React.FC<MessageListProps> = ({ messages, isTyping, messagesEndRef }) => {
  return (
    <div className="flex-grow overflow-y-auto">
      {messages.map(message => (
        <div
          key={message.id}
          className={`mb-2 md:mb-3 flex ${message.sender === 'user' ? 'justify-end' : 'justify-start'}`}
        >
          <div
            className={`max-w-[75%] rounded-lg p-2 md:p-3 text-sm md:text-base ${
              message.sender === 'user'
                ? 'bg-bat-yellow text-black'
                : 'bg-gotham-blue text-white'
            }`}
          >
            <p>{message.text}</p>
          </div>
        </div>
      ))}

      {isTyping && (
        <div className="flex justify-start mb-2 md:mb-3">
          <div className="bg-gotham-blue text-white rounded-lg p-2 md:p-3">
            <div className="flex space-x-1">
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-pulse"></div>
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-pulse delay-75"></div>
              <div className="w-1.5 h-1.5 md:w-2 md:h-2 bg-gray-400 rounded-full animate-pulse delay-150"></div>
            </div>
          </div>
        </div>
      )}

      <div ref={messagesEndRef} />
    </div>
  );
};

export default MessageList;
