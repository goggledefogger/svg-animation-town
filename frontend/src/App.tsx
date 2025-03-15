import { useState } from 'react';
import AnimationCanvas from './components/AnimationCanvas';
import ChatInterface from './components/ChatInterface';
import Header from './components/Header';
import { AnimationProvider } from './contexts/AnimationContext';
import AnimationControls from './components/AnimationControls';

function App() {
  const [showChat, setShowChat] = useState(false);

  return (
    <AnimationProvider>
      <div className="flex flex-col h-screen">
        <Header />
        <div className="flex flex-col flex-1 overflow-hidden">
          {/* Main content area */}
          <div className="flex flex-col flex-1 md:flex-row">
            {/* Animation section - now takes full width on mobile */}
            <div className="flex-1 min-h-[40vh] md:min-h-0 md:w-2/3 p-4 flex flex-col">
              <AnimationCanvas />
              <AnimationControls />
            </div>
            
            {/* Chat section - conditionally shown on mobile */}
            <div className={`${showChat ? 'flex' : 'hidden'} md:flex w-full md:w-1/3 border-t md:border-t-0 md:border-l border-gray-700 flex-col h-[45vh] md:h-auto max-h-[80vh] md:max-h-none`}>
              <ChatInterface />
            </div>
          </div>
          
          {/* Mobile chat toggle button - only visible on mobile, positioned to avoid keyboard */}
          <button 
            className="md:hidden fixed bottom-16 right-4 z-50 bg-bat-yellow text-black rounded-full p-3 shadow-lg"
            onClick={() => setShowChat(!showChat)}
            aria-label={showChat ? "Hide Chat" : "Show Chat"}
          >
            {showChat ? (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            ) : (
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
              </svg>
            )}
          </button>
        </div>
      </div>
    </AnimationProvider>
  );
}

export default App;
