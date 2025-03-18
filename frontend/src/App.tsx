import { useState, useEffect } from 'react';
import { BrowserRouter as Router, Routes, Route, Navigate } from 'react-router-dom';
import AnimationCanvas from './components/AnimationCanvas';
import ChatInterface from './components/ChatInterface';
import Header from './components/Header';
import { AnimationProvider, useAnimation } from './contexts/AnimationContext';
import { MovieProvider } from './contexts/MovieContext';
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

  return (
    <div className="flex flex-col h-screen h-mobile-screen overflow-hidden">
      <Header />
      <div className="flex flex-col flex-1 overflow-hidden relative">
        {/* Main content area */}
        <div className="flex flex-col h-[calc(100vh-64px)] h-mobile-screen-minus-header md:flex-row md:overflow-hidden">
          {/* Animation section - takes proper space on all screen sizes */}
          <div className="flex-none h-[45vh] h-mobile-partial md:flex-1 md:h-auto md:w-2/3 p-4 flex flex-col z-0">
            <AnimationCanvas />
            <AnimationControls />
          </div>

          {/* Chat section - conditionally shown on mobile, fixed position on mobile */}
          <div className={`${showChat ? 'flex' : 'hidden'} md:flex w-full md:w-1/3 border-t md:border-t-0 md:border-l border-gray-700 flex-col h-[calc(100vh-45vh-64px)] h-mobile-content md:h-auto md:max-h-[calc(100vh-64px)] md:max-h-mobile-screen-minus-header z-10 md:z-0 md:relative bg-gotham-dark md:bg-transparent overflow-hidden`}>
            <ChatInterface onClose={() => setShowChat(false)} />
          </div>
        </div>

        {/* Mobile chat toggle button - only visible on mobile when chat is closed */}
        <button
          className={`md:hidden fixed bottom-16 right-4 z-50 bg-bat-yellow text-black rounded-full p-3 shadow-lg ${showChat ? 'hidden' : 'block'}`}
          onClick={() => setShowChat(true)}
          aria-label="Show Chat"
        >
          <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 12h.01M12 12h.01M16 12h.01M21 12c0 4.418-4.03 8-9 8a9.863 9.863 0 01-4.255-.949L3 20l1.395-3.72C3.512 15.042 3 13.574 3 12c0-4.418 4.03-8 9-8s9 3.582 9 8z" />
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
        <MovieContextConnector>
          <Routes>
            <Route path="/" element={<AnimationEditor />} />
            <Route path="/movie-editor" element={<MovieEditorPage />} />
            <Route path="*" element={<Navigate to="/" />} />
          </Routes>
        </MovieContextConnector>
      </AnimationProvider>
    </Router>
  );
}

export default App;
