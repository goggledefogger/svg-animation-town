import React, { useState, useRef, useEffect } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { generateId } from '../utils/helpers';
import { AnimationApi } from '../services/api';
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
    elements,
    setElements,
    loadPreset
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
      // Check for preset keywords
      if (text.toLowerCase().includes('bat signal') ||
          text.toLowerCase().includes('batman')) {
        try {
          const presetData = await AnimationApi.getPreset('batSignal');
          setElements(presetData.elements);

          // Add AI response with the preset message
          const aiMessage: Message = {
            id: generateId(),
            sender: 'ai',
            text: presetData.message,
            timestamp: new Date()
          };

          setMessages(prev => [...prev, aiMessage]);
        } catch (error) {
          console.error('Error loading preset:', error);
          // Fallback to local preset
          loadPreset('batSignal');

          // Add AI response
          const aiMessage: Message = {
            id: generateId(),
            sender: 'ai',
            text: "I've created the bat signal with a dramatic reveal. The spotlight grows from the center, then the bat symbol fades in with a pulsing glow effect.",
            timestamp: new Date()
          };

          setMessages(prev => [...prev, aiMessage]);
        }
      } else {
        // Generate or update animation based on whether there are existing elements
        const result = elements.length === 0
          ? await AnimationApi.generate(text)
          : await AnimationApi.update(text, elements);

        // Debug the received response
        console.log('Received API response for animation:', JSON.stringify(result, null, 2));
        console.log('Setting elements to:', result.elements);
        console.log('Element count:', result.elements.length);

        // Add extra validation for the elements
        if (result.elements.length > 0) {
          // Log the structure of each element
          result.elements.forEach((element, index) => {
            console.log(`Element ${index + 1}:`, element);

            // Check if the element has the required properties
            if (!element.id || !element.type || !element.attributes) {
              console.warn(`Element ${index + 1} is missing required properties:`, element);
            }

            // Check animations
            if (!element.animations || !Array.isArray(element.animations)) {
              console.warn(`Element ${index + 1} has invalid animations:`, element.animations);
              // Ensure animations is an array
              element.animations = [];
            }
          });
        } else {
          console.warn('No elements received from API');
        }

        // Update the animation elements - log before and after for debugging
        console.log('Setting elements in context, before:', elements);
        setElements(result.elements);
        console.log('Elements should be set in context');

        // Add AI response
        const aiMessage: Message = {
          id: generateId(),
          sender: 'ai',
          text: result.message,
          timestamp: new Date()
        };

        setMessages(prev => [...prev, aiMessage]);
      }
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
      <div className="p-3 border-b border-gray-700 bg-gotham-blue">
        <h2 className="text-lg font-semibold">Animation Assistant</h2>
      </div>

      <MessageList
        messages={messages}
        isTyping={isProcessing}
        messagesEndRef={messagesEndRef}
      />

      <MessageInput
        onSubmit={handleSubmit}
        isProcessing={isProcessing}
      />
    </div>
  );
};

export default ChatInterface;
