import React, { useState, useRef, useEffect } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { generateId } from '../utils/helpers';
import MessageList from './MessageList';
import MessageInput from './MessageInput';

// Message types
export interface Message {
  id: string;
  sender: 'user' | 'ai';
  text: string;
  timestamp: Date;
}

const ChatInterface: React.FC = () => {
  const [messages, setMessages] = useState<Message[]>([
    {
      id: generateId(),
      sender: 'ai',
      text: "Welcome to Gotham Animation Studio! I'm your animation assistant. Describe what you'd like to create, and I'll help bring it to life. Try saying 'Create a bat signal in the night sky' or 'Make stars twinkle in the background'.",
      timestamp: new Date()
    }
  ]);

  const [isProcessing, setIsProcessing] = useState(false);
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const {
    svgContent,
    setSvgContent,
    generateAnimationFromPrompt,
    updateAnimationFromPrompt
  } = useAnimation();

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

    setMessages(prev => [...prev, userMessage]);
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

      setMessages(prev => [...prev, aiMessage]);
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
    }
  };

  return (
    <div className="flex flex-col h-full">
      <div className="p-2 md:p-4 bg-gotham-blue border-b border-gray-700 flex-shrink-0">
        <h2 className="text-lg font-medium text-white">Chat</h2>
      </div>
      
      <div className="flex-1 overflow-y-auto p-2 md:p-4 pb-1">
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
