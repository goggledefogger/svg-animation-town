import React, { useState, useRef, useEffect } from 'react';
import { useAnimation } from '../contexts/AnimationContext';
import { Message } from '../contexts/AnimationContext';
import { generateId } from '../utils/helpers';
import MessageList from './MessageList';
import MessageInput from './MessageInput';
import AIProviderSelector from './AIProviderSelector';
import { useMovie } from '../contexts/MovieContext';
import { useNavigate } from 'react-router-dom';
import type { AIProviderId } from '@/types/ai';

interface ChatInterfaceProps {
  onClose?: () => void;
  pendingClipName?: string | null;
}

const DEFAULT_WELCOME_MESSAGE: Message = {
  id: generateId(),
  sender: 'ai',
  text: "Welcome to Gotham Animation Studio! I'm your animation assistant. Describe what you'd like to create, and I'll help bring it to life. Try saying 'Create a bat signal in the night sky' or 'Make stars twinkle in the background'.",
  timestamp: new Date()
};

const ChatInterface: React.FC<ChatInterfaceProps> = ({ onClose, pendingClipName }) => {
  const [isProcessing, setIsProcessing] = useState(false);
  const [showSaveModal, setShowSaveModal] = useState(false);
  const [clipName, setClipName] = useState('');
  const messagesEndRef = useRef<HTMLDivElement>(null);
  const navigate = useNavigate();
  const [isEditingFromMovie, setIsEditingFromMovie] = useState(false);

  const {
    svgContent,
    setSvgContent,
    setSvgContentWithBroadcast,
    generateAnimationFromPrompt,
    updateAnimationFromPrompt,
    saveAnimation,
    chatHistory,
    setChatHistory,
    loadAnimation,
    getSavedAnimations,
    setAIProvider,
    setAIModel,
  } = useAnimation();

  const { saveCurrentAnimationAsClip, updateClip } = useMovie();

  // Initialize with pending clip name if provided
  useEffect(() => {
    if (pendingClipName) {
      setClipName(pendingClipName);
    }
  }, [pendingClipName]);

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

  // Check for animation load event and set chat history from stored animation data
  useEffect(() => {
    const handleAnimationLoaded = (event: Event) => {
      const customEvent = event as CustomEvent;
      const loadedChatHistory = customEvent.detail?.chatHistory;

      console.log('Animation loaded event received');

      // Function to check if chat history is valid and non-empty
      const isValidChatHistory = (history: any): boolean => {
        return history && Array.isArray(history) && history.length > 0 &&
          // Make sure at least one message is from the user (not just the welcome message)
          history.some(msg => msg.sender === 'user');
      };

      if (isValidChatHistory(loadedChatHistory)) {
        // Set the loaded chat history
        setChatHistory(loadedChatHistory);
        console.log('Setting chat history from loaded animation:', loadedChatHistory.length, 'messages');
      } else {
        console.log('No valid chat history found in loaded animation');

        // The animation doesn't have valid chat history, check if there's a pending prompt
        const storedPrompt = sessionStorage.getItem('pending_prompt');
        const clipId = localStorage.getItem('editing_clip_id');

        if (storedPrompt) {
          console.log('Found pending prompt:', storedPrompt);

          // Create new messages for the stored prompt
          const userMessage: Message = {
            id: generateId(),
            sender: 'user',
            text: storedPrompt,
            timestamp: new Date()
          };

          // Add a simulated AI response to show that this prompt generated the current animation
          const aiMessage: Message = {
            id: generateId(),
            sender: 'ai',
            text: clipId
              ? `I created this animation based on your prompt for the movie clip. You can see it in the preview above. Let me know if you want me to modify it!`
              : `I created this animation based on your prompt. You can see it in the preview above. Let me know if you want me to modify it!`,
            timestamp: new Date(new Date().getTime() + 1000) // 1 second after to maintain chronological order
          };

          // Set the new chat history
          setChatHistory([userMessage, aiMessage]);
          console.log('Created new chat history from pending prompt');

          // Clear the session storage to prevent it from being used again
          sessionStorage.removeItem('pending_prompt');
          localStorage.removeItem('editing_clip_id');
        } else {
          // If no chat history and no pending prompt, set default welcome message
          setChatHistory([DEFAULT_WELCOME_MESSAGE]);
          console.log('Setting default welcome message');
        }
      }
    };

    const handleAnimationReset = () => {
      resetChat();
    };

    window.addEventListener('animation-loaded', handleAnimationLoaded);
    window.addEventListener('animation-reset', handleAnimationReset);

    return () => {
      window.removeEventListener('animation-loaded', handleAnimationLoaded);
      window.removeEventListener('animation-reset', handleAnimationReset);
    };
  }, [setChatHistory, resetChat]);

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

    // Log current SVG state before update
    console.log('Before update - SVG content exists:', !!svgContent,
               svgContent ? `length: ${svgContent.length}` : '');

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

      console.log('Submitting prompt to', isUpdate ? 'update' : 'generate', 'animation:', text);

      // Generate or update animation based on whether there is existing content
      if (isUpdate) {
        // Store starting content for comparison
        const startingSvgContent = svgContent;

        // Do the update
        responseMessage = await updateAnimationFromPrompt(text);

        // Verify the update worked by checking if the SVG changed
        console.log('After update - Current SVG length:', svgContent?.length || 0);
        if (svgContent === startingSvgContent) {
          console.warn('SVG content did not change after update operation - this may indicate a problem');
        } else {
          console.log('SVG content was successfully updated');
        }
      } else {
        responseMessage = await generateAnimationFromPrompt(text);
        console.log('New animation was successfully generated');
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

      console.log('Chat message processed successfully');
    } catch (error) {
      console.error('Error processing chat message:', error);

      // Handle error with more details
      const errorMessage: Message = {
        id: generateId(),
        sender: 'ai',
        text: `Sorry, I encountered an error while ${svgContent ? 'updating' : 'generating'} the animation: ${error instanceof Error ? error.message : 'Unknown error'}. Please try again.`,
        timestamp: new Date()
      };
      setChatHistory([...updatedMessages, errorMessage]);
    } finally {
      setIsProcessing(false);
    }
  };

  // Handle saving to Movie Editor
  const handleSaveToMovieEditor = async () => {
    // Check if we're editing an existing clip
    const editingClipId = localStorage.getItem('editing_clip_id');

    if (editingClipId && svgContent) {
      // We're editing an existing clip, so update it with the new SVG content
      console.log('Updating existing clip with ID:', editingClipId);

      try {
        // First save the animation to the server to get a permanent ID
        // This ensures the clip references a saved animation for future loading
        const animationName = `clip-${editingClipId}-${Date.now()}`;
        await saveAnimation(animationName, chatHistory);

        // Find saved animation to get its ID
        const animations = await getSavedAnimations();
        const savedAnimation = animations.find((a: { name: string; id: string }) => a.name === animationName);

        // Update the clip with the new content, chat history, and animation ID
        updateClip(editingClipId, {
          svgContent,
          chatHistory,
          // Add animation ID if we have one
          ...(savedAnimation ? { animationId: savedAnimation.id } : {})
        });

        console.log('Clip updated successfully with new animation content');

        // Store the fact that we're returning with updated content
        sessionStorage.setItem('clip_just_updated', editingClipId);
      } catch (error) {
        console.error('Error saving animation for clip:', error);
        // Still update the clip with SVG content even if saving to server fails
        updateClip(editingClipId, {
          svgContent,
          chatHistory
        });

        // Still mark as updated even if server save failed
        sessionStorage.setItem('clip_just_updated', editingClipId);
      }

      // Clear the editing state
      localStorage.removeItem('editing_clip_id');
      sessionStorage.removeItem('editing_from_movie');

      // Navigate back to movie editor
      navigate('/movie-editor');
    }
    // If we have a pending clip name from the movie editor but not an editing ID,
    // this is a new clip being created from the movie editor
    else if (pendingClipName) {
      const clipId = saveCurrentAnimationAsClip(pendingClipName);
      if (clipId) {
        // Mark the newly created clip so it can be selected in the movie editor
        sessionStorage.setItem('clip_just_created', clipId);
        // Navigate back to movie editor with the new clip
        navigate('/movie-editor');
      }
    }
    // Otherwise, this is a standalone animation we want to save as a new clip
    else {
      // Show the save modal to enter a name
      setClipName('');
      setShowSaveModal(true);
    }
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

  // Check for animation ID to load when navigating from a clip
  useEffect(() => {
    const loadAnimationId = sessionStorage.getItem('load_animation_id');
    const isEditingFromMovie = sessionStorage.getItem('editing_from_movie') === 'true';
    const storedProvider = sessionStorage.getItem('animation_provider') as AIProviderId | null;
    const storedModel = sessionStorage.getItem('animation_model');

    // Set state based on session storage
    setIsEditingFromMovie(isEditingFromMovie);

    // If a specific AI provider was requested and we're editing from movie, set it
    if (storedProvider && isEditingFromMovie) {
      console.log(`Setting AI provider to: ${storedProvider} (from movie clip)`);
      setAIProvider(storedProvider);
      if (storedModel) {
        setAIModel(storedModel);
      }
    }

    if (loadAnimationId) {
      console.log(`Loading animation with ID: ${loadAnimationId} (from movie editor: ${isEditingFromMovie})`);

      // Load the animation using the context function
      const loadAnimationFromId = async () => {
        try {
          // Use the loadAnimation function from the animation context
          const result = await loadAnimation(loadAnimationId);
          if (result) {
            console.log(`Animation loaded successfully`);

            // If editing from movie editor, no need to force a broadcast update
            // The loadAnimation function already handles the broadcast
            if (isEditingFromMovie) {
              console.log('Editing from movie - broadcast handled by AnimationContext');
            }

            // If there's a pending prompt but the animation already has chat history,
            // we want to keep the existing chat history rather than replace it
            const storedPrompt = sessionStorage.getItem('pending_prompt');
            if (storedPrompt && result.chatHistory && result.chatHistory.length > 0) {
              console.log('Animation has existing chat history, keeping it instead of creating new from prompt');
            }
          } else {
            console.error(`Failed to load animation with ID: ${loadAnimationId}`);

            // If we couldn't load the animation but have a prompt, let the animation loaded event handler create chat history
            console.log('Will try to create chat history from pending prompt if available');
          }
        } catch (error) {
          console.error(`Error loading animation: ${error}`);
        } finally {
          // Clear the storage to prevent reloading
          sessionStorage.removeItem('load_animation_id');
          sessionStorage.removeItem('editing_from_movie');
        }
      };

      loadAnimationFromId();
    } else {
      // Check if there's direct SVG content from a clip without animation ID
      const clipSvgContent = sessionStorage.getItem('clip_svg_content');
      if (clipSvgContent && isEditingFromMovie) {
        console.log('Loading clip SVG content directly from sessionStorage');

        // Use the broadcast version to ensure proper updates
        setSvgContentWithBroadcast(clipSvgContent, 'movie-clip-edit-direct');

        // Clear the storage immediately since the broadcast function handles proper timing
        sessionStorage.removeItem('clip_svg_content');
        sessionStorage.removeItem('editing_from_movie');
      }
    }
  }, [loadAnimation, setSvgContent, setSvgContentWithBroadcast, setAIProvider, setAIModel]);

  return (
    <div className="flex flex-col h-full overflow-hidden">
      {/* Chat header */}
      <div className="px-4 py-3 border-b border-gray-700 bg-gotham-black">
        <div className="flex flex-col gap-3">
          {/* Top row: Title and Save button */}
          <div className="flex items-center justify-between">
            <h2 className="text-lg font-semibold text-white">Animation Chat</h2>
            <div className="flex items-center gap-2">
              {/* Add save button - only show when editing from movie or has pending clip name */}
              {svgContent && (isEditingFromMovie || pendingClipName) && (
                <button
                  onClick={handleSaveToMovieEditor}
                  className="p-1.5 rounded-md text-white bg-green-600 hover:bg-green-500"
                  title={pendingClipName ? `Save as "${pendingClipName}" to Movie Editor` : "Save to Movie Editor"}
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 001-1V5a1 1 0 00-1-1H4a1 1 0 00-1 1v14a1 1 0 001 1z" />
                  </svg>
                </button>
              )}
              {/* Regular save button for standalone animations */}
              {svgContent && !isEditingFromMovie && !pendingClipName && (
                <button
                  onClick={() => setShowSaveModal(true)}
                  className="p-1.5 rounded-md text-white bg-green-600 hover:bg-green-500"
                  title="Save Animation"
                >
                  <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 7H5a2 2 0 00-2 2v9a2 2 0 002 2h14a2 2 0 002-2V9a2 2 0 00-2-2h-3m-1 4l-3 3m0 0l-3-3m3 3V4" />
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

          {/* Bottom row: AI Provider Selector */}
          <div className="flex justify-center">
            <AIProviderSelector className="" />
          </div>
        </div>
      </div>

      {/* Pending clip notification */}
      {pendingClipName && (
        <div className="bg-bat-yellow text-black px-4 py-2 text-sm">
          <p>Creating animation for clip: <strong>{pendingClipName}</strong></p>
          <p>When done, click "Save to Movie Editor" above to return to the movie editor.</p>
        </div>
      )}

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
