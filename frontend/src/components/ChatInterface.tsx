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
  const [messages, setMessages] = useState<Message[]>([DEFAULT_WELCOME_MESSAGE]);
  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    svgContent,
    setSvgContent,
    generateAnimationFromPrompt,
    updateAnimationFromPrompt,
    saveAnimation
  } = useAnimation();

  // Reset chat to initial state
  const resetChat = () => {
    setMessages([DEFAULT_WELCOME_MESSAGE]);
    setIsProcessing(false);
  };

  // Listen for animation reset event
  useEffect(() => {
    const handleAnimationReset = () => {
      resetChat();
    };

    const handleAnimationLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const chatHistory = customEvent.detail?.chatHistory;

      if (chatHistory && Array.isArray(chatHistory)) {
        // Set the loaded chat history
        setMessages(chatHistory);
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
  }, []);

  // Scroll to bottom of chat
  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  // Handle form submission
  const handleSubmit = async (text: string) => {
    if (!text.trim() || isProcessing) return;

    const userMessage: Message = {
      id: generateId(),
      sender: 'user',
      text,
      timestamp: new Date()
    };

    const updatedMessages = [...messages, userMessage];
    setMessages(updatedMessages);
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
      setMessages(finalMessages);

      // Auto-save the animation with chat history after each update
      // This ensures chat history is preserved on manual save
      sessionStorage.setItem('currentChatHistory', JSON.stringify(finalMessages));

    } catch (error: any) {
      // Handle error
      const errorMessage: Message = {
        id: generateId(),
        sender: 'ai',
        text: `I'm sorry, I couldn't process that request. ${error.message}`,
        timestamp: new Date()
      };

      setMessages(prev => [...prev, errorMessage]);
      console.error('Error processing animation request:', error);
    } finally {
      setIsProcessing(false);
      // Ensure we scroll to the bottom after processing is complete
      setTimeout(scrollToBottom, 100);
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

      <div className="flex-1 overflow-y-auto p-2 md:p-4 pb-1 bg-gotham-dark">
        <MessageList
          messages={messages}
          isTyping={isProcessing}
          messagesEndRef={messagesEndRef}
        />
      </div>

      <div className="p-2 md:p-4 pt-1 border-t border-gray-700 flex-shrink-0 sticky bottom-0 bg-gotham-dark">
        <MessageInput onSubmit={handleSubmit} isProcessing={isProcessing} />
      </div>
    </div>
  );
};

export default ChatInterface;
