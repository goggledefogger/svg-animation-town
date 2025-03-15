import { useState } from 'react';
import AnimationCanvas from './components/AnimationCanvas';
import ChatInterface from './components/ChatInterface';
import Header from './components/Header';
import { AnimationProvider } from './contexts/AnimationContext';
import AnimationControls from './components/AnimationControls';

function App() {
  return (
    <AnimationProvider>
      <div className="flex flex-col h-screen">
        <Header />
        <div className="flex flex-col md:flex-row flex-1 overflow-hidden">
          <div className="w-full md:w-2/3 p-4 flex flex-col">
            <AnimationCanvas />
            <AnimationControls />
          </div>
          <div className="w-full md:w-1/3 border-l border-gray-700 flex flex-col">
            <ChatInterface />
          </div>
        </div>
      </div>
    </AnimationProvider>
  );
}

export default App;
