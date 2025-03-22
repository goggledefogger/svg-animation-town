import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate, useNavigate } from 'react-router-dom';
import AnimationCanvas from './components/AnimationCanvas';
import ChatInterface from './components/ChatInterface';
import Header from './components/Header';
import { AnimationProvider, useAnimation } from './contexts/AnimationContext';
import { MovieProvider, useMovie } from './contexts/MovieContext';
import AnimationControls from './components/AnimationControls';
import MovieEditorPage from './pages/MovieEditorPage';

// Connector component that gets data from AnimationContext and passes it to MovieProvider
// This pattern properly addresses the context dependency without creating circular references
// We're explicitly connecting the contexts through props rather than having MovieContext
// try to consume AnimationContext directly
const MovieContextConnector: React.FC<{ children: React.ReactNode }> = ({ children }) => {
  const animationContext = useAnimation();

  // Pass relevant data from animation context to movie context
  // This creates a clean separation and explicit data flow between contexts
  const animationData = {
    svgContent: animationContext.svgContent,
    chatHistory: animationContext.chatHistory,
    generateAnimation: animationContext.generateAnimation
  };

  return (
    <MovieProvider animationData={animationData}>
      {children}
    </MovieProvider>
  );
};

// Main animation editor component
const AnimationEditor = () => {
  const [showChat, setShowChat] = useState(true);
  const [pendingClipName, setPendingClipName] = useState<string | null>(null);
  const navigate = useNavigate();

  // Check for pending clip name when component mounts
  useEffect(() => {
    const storedClipName = localStorage.getItem('pending_clip_name');
    if (storedClipName) {
      // Set to state and clear from storage
      setPendingClipName(storedClipName);
      localStorage.removeItem('pending_clip_name');

      // Show the user a notification or instruction
      alert(`Create your animation for clip "${storedClipName}". When you're done, click "Save to Movie" in the chat panel.`);
    }
  }, []);

  return (
    <div className="flex flex-col h-screen h-mobile-screen overflow-hidden">
      <Header />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Main content area with simplified layout */}
        <div className="flex flex-col h-[calc(100vh-64px)] h-mobile-screen-minus-header md:flex-row md:overflow-hidden">
          {/* Animation container with improved size handling */}
          <div className={`
            relative flex items-center justify-center flex-1 md:w-2/3
            ${showChat ? 'max-h-[calc(100vh-64px-280px)]' : 'max-h-[calc(100vh-64px)]'}
            overflow-hidden h-[100%]
          `}>
            <AnimationCanvas style={{ borderRadius: '12px' }} />
          </div>

          {/* Controls overlay */}
          <div className="absolute bottom-2 left-2 right-2 md:bottom-4 md:left-4 md:right-4 z-10">
            <AnimationControls />
          </div>

          {/* Chat section - fixed position on mobile with bottom-0, flexible on desktop */}
          <div className={`${showChat ? 'flex' : 'hidden'} md:flex w-full md:w-1/3 border-t md:border-t-0 md:border-l border-gray-700 flex-col h-[280px] md:h-auto md:max-h-[calc(100vh-64px)] md:max-h-mobile-screen-minus-header fixed md:static bottom-0 left-0 right-0 z-20 md:z-0 bg-gotham-dark md:bg-transparent overflow-hidden shadow-[0_-4px_12px_rgba(0,0,0,0.5)]`}>
            <ChatInterface
              onClose={() => setShowChat(false)}
              pendingClipName={pendingClipName}
            />
          </div>
        </div>

        {/* Mobile chat toggle button - only visible on mobile when chat is closed */}
        <button
          className={`md:hidden fixed bottom-6 right-4 z-50 bg-bat-yellow text-black rounded-full p-4 shadow-xl ${showChat ? 'hidden' : 'flex items-center justify-center animate-pulse-subtle'}`}
          onClick={() => setShowChat(true)}
          aria-label="Show Chat"
          style={{ zIndex: 30 }}
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2.5} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
          </svg>
        </button>
      </div>
    </div>
  );
};

function App() {
  // Add an effect to monitor container dimensions and set dynamic viewport height
  useEffect(() => {
    const setVhVariable = () => {
      // First, get the viewport height and multiply it by 1% to get a value for a vh unit
      const vh = window.innerHeight * 0.01;
      // Then set the value in the --vh custom property to the root of the document
      document.documentElement.style.setProperty('--vh', `${vh}px`);
    };

    // Initial setup
    setVhVariable();

    // Update on orientation change and resize
    window.addEventListener('resize', setVhVariable);
    window.addEventListener('orientationchange', setVhVariable);

    return () => {
      window.removeEventListener('resize', setVhVariable);
      window.removeEventListener('orientationchange', setVhVariable);
    };
  }, []);

  return (
    <Router>
      <AnimationProvider>
        <Routes>
          <Route
            path="/"
            element={
              <MovieContextConnector>
                <AnimationEditor />
              </MovieContextConnector>
            }
          />
          <Route
            path="/movie-editor"
            element={
              <MovieContextConnector>
                <MovieEditorPage />
              </MovieContextConnector>
            }
          />
          <Route path="*" element={<Navigate to="/" />} />
        </Routes>
      </AnimationProvider>
    </Router>
  );
}

export default App;
