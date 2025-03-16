import React, { useState, useRef, useEffect } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { Message } from '../contexts/AnimationContext';
import { generateId } from '../utils/helpers';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import AIProviderSelector from './AIProviderSelector';

interface ChatInterfaceProps {
  onClose?: () => void;
}

const DEFAULT_WELCOME_MESSAGE: Message = {
  id: generateId(),
  sender: 'ai',
  text: "Welcome to Gotham Animation Studio! I'm your animation assistant. Describe what you'd like to create, and I'll help bring it to life. Try saying 'Create a bat signal in the night sky' or 'Make stars twinkle in the background'.",
  timestamp: new Date()
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    svgContent,
    setSvgContent,
    generateAnimationFromPrompt,
    updateAnimationFromPrompt,
    saveAnimation,
    chatHistory,
    setChatHistory
  } = useAnimation();

  // Initialize chat with welcome message if empty
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([DEFAULT_WELCOME_MESSAGE]);
    }
  }, [chatHistory.length, setChatHistory]);

  // Reset chat to initial state
  const resetChat = () => {
    setChatHistory([DEFAULT_WELCOME_MESSAGE]);
    setIsProcessing(false);
  };

  // Listen for animation reset event
  useEffect(() => {
    const handleAnimationReset = () => {
      resetChat();
    };

    const handleAnimationLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const loadedChatHistory = customEvent.detail?.chatHistory;

      if (loadedChatHistory && Array.isArray(loadedChatHistory)) {
        // Set the loaded chat history
        setChatHistory(loadedChatHistory);
      } else {
        // If no chat history, set default welcome message
        resetChat();
      }
    };

    window.addEventListener('animation-reset', handleAnimationReset);
    window.addEventListener('animation-loaded', handleAnimationLoaded);

    return () => {
      window.removeEventListener('animation-reset', handleAnimationReset);
      window.removeEventListener('animation-loaded', handleAnimationLoaded);
    };
  }, [setChatHistory]);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [chatHistory]);

  // Handle form submission
  const handleSubmit = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMessage: Message = {
      id: generateId(),
      sender: 'user',
      text,
      timestamp: new Date()
    };

    const updatedMessages = [...chatHistory, userMessage];
    setChatHistory(updatedMessages);
    setIsProcessing(true);

    try {
      // Determine if this is a new animation or an update
      const isUpdate = !!svgContent;
      let responseMessage: string;

      // Generate or update animation based on whether there is existing content
      if (isUpdate) {
        responseMessage = await updateAnimationFromPrompt(text);
      } else {
        responseMessage = await generateAnimationFromPrompt(text);
      }

      // Extract only the user-friendly part of the message
      // The server response typically includes SVG implementation details after certain markers
      const userFriendlyMessage = responseMessage.split(/Here's the (updated )?SVG:|\n\n###|\n###|You can directly insert/)[0].trim();

      // Add AI response
      const aiMessage: Message = {
        id: generateId(),
        sender: 'ai',
        text: userFriendlyMessage,
        timestamp: new Date()
      };

      const finalMessages = [...updatedMessages, aiMessage];
      setChatHistory(finalMessages);

      // No need to manually store in sessionStorage anymore
      // as AnimationContext handles this automatically
    } catch (error) {
      // Handle error
      const errorMessage: Message = {
        id: generateId(),
        sender: 'ai',
        text: 'Sorry, I encountered an error while processing your request. Please try again.',
        timestamp: new Date()
      };
      setChatHistory([...updatedMessages, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 md:p-4 bg-gotham-blue border-b border-gray-700 flex-shrink-0 flex items-center justify-between">
        <h2 className="text-lg font-medium text-white">Chat</h2>
        <div className="flex items-center space-x-2">
          <AIProviderSelector className="block" />
          {onClose && (
            <button
              onClick={onClose}
              className="text-gray-300 hover:text-white ml-2 md:hidden"
              aria-label="Close chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      <div className="flex-grow overflow-y-auto p-4 space-y-4">
        <MessageList
          messages={chatHistory}
          isTyping={isProcessing}
          messagesEndRef={messagesEndRef}
        />
      </div>

      <div className="border-t p-4">
        <MessageInput
          onSubmit={handleSubmit}
          isProcessing={isProcessing}
        />
      </div>
    </div>
  );
};

export default ChatInterface;
