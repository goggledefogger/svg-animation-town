import React, { useState, useRef, useEffect } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { Message } from '../contexts/AnimationContext';
import { generateId } from '../utils/helpers';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import AIProviderSelector from './AIProviderSelector';
import { useMovie } from '../contexts/MovieContext';
import { useNavigate } from 'react-router-dom';

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
  const [pendingPrompt, setPendingPrompt] = useState<string | null>(null);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [clipName, setClipName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();

  const {
    svgContent,
    setSvgContent,
    generateAnimationFromPrompt,
    updateAnimationFromPrompt,
    saveAnimation,
    chatHistory,
    setChatHistory
  } = useAnimation();
  
  const { saveCurrentAnimationAsClip } = useMovie();

  // Initialize chat with welcome message if empty
  useEffect(() => {
    if (chatHistory.length === 0) {
      setChatHistory([DEFAULT_WELCOME_MESSAGE]);
    }
  }, [chatHistory.length, setChatHistory]);

  // Check for pending prompt from movie editor
  useEffect(() => {
    const storedPrompt = sessionStorage.getItem('pending_prompt');
    if (storedPrompt) {
      setPendingPrompt(storedPrompt);
      // Clear the session storage to prevent it from being used again
      sessionStorage.removeItem('pending_prompt');
    }
  }, []);

  // Reset chat to initial state
  const resetChat = () => {
    setChatHistory([DEFAULT_WELCOME_MESSAGE]);
    setIsProcessing(false);
    setPendingPrompt(null);
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

  // Save animation as clip and navigate to movie editor
  const handleSaveToMovieEditor = () => {
    setShowSaveModal(true);
  };

  // Handle save confirmation
  const handleSaveClip = () => {
    if (clipName.trim() && svgContent) {
      const clipId = saveCurrentAnimationAsClip(clipName.trim());
      if (clipId) {
        // Navigate to movie editor page
        navigate('/movie-editor');
      }
      setShowSaveModal(false);
    }
  };

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-gray-700 bg-gotham-black">
        <div className="flex items-center">
          <h2 className="text-lg font-semibold text-white">Animation Chat</h2>
          <AIProviderSelector className="ml-4" />
        </div>
        <div className="flex items-center">
          {/* Add save button */}
          {svgContent && (
            <button
              onClick={handleSaveToMovieEditor}
              className="p-1.5 mr-2 rounded-md text-white bg-green-600 hover:bg-green-500"
              title="Save to Movie Editor"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
              </svg>
            </button>
          )}
          {/* Mobile close button */}
          {onClose && (
            <button
              onClick={onClose}
              className="md:hidden p-1.5 rounded-md text-white hover:bg-gray-700"
              aria-label="Close Chat"
            >
              <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      </div>

      {/* Chat messages */}
      <div className="flex-1 overflow-y-auto p-4 bg-gotham-dark">
        <MessageList 
          messages={chatHistory} 
          isTyping={isProcessing}
          messagesEndRef={messagesEndRef}
        />
      </div>

      {/* Chat input */}
      <div className="border-t border-gray-700 p-4 bg-gotham-black">
        <MessageInput
          onSubmit={handleSubmit}
          isProcessing={isProcessing}
          pendingPrompt={pendingPrompt}
        />
      </div>

      {/* Save clip modal */}
      {showSaveModal && (
        <div className="fixed inset-0 bg-black bg-opacity-75 flex items-center justify-center p-4 z-50">
          <div className="bg-gotham-black rounded-lg p-6 w-full max-w-md">
            <h3 className="text-xl font-bold mb-4">Save as Movie Clip</h3>
            <p className="text-gray-300 mb-4">
              This will save your animation as a clip in the Movie Editor.
            </p>
            <input
              type="text"
              value={clipName}
              onChange={(e) => setClipName(e.target.value)}
              placeholder="Enter clip name"
              className="w-full p-2 bg-gray-700 rounded border border-gray-600 text-white mb-4"
            />
            <div className="flex justify-end space-x-3">
              <button
                onClick={() => setShowSaveModal(false)}
                className="px-4 py-2 bg-gray-700 hover:bg-gray-600 text-white rounded"
              >
                Cancel
              </button>
              <button
                onClick={handleSaveClip}
                disabled={!clipName.trim() || !svgContent}
                className="px-4 py-2 bg-green-600 hover:bg-green-500 disabled:bg-gray-700 disabled:text-gray-400 text-white rounded"
              >
                Save & Go to Movie Editor
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default ChatInterface;
