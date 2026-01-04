import React, { useState, useEffect, useRef, useCallback } from 'react';
import AnimationCanvas from './AnimationCanvas';
import { MovieContext, MovieClip, Storyboard } from '../contexts/MovieContext';
import { useViewerPreferences } from '../contexts/ViewerPreferencesContext';
import { useAnimation } from '../contexts/AnimationContext';

interface MoviePlayerProps {
  movie: Storyboard;
  initialCaptions?: boolean;
  initialPrompt?: boolean;
  initialLoop?: boolean;
}

const MoviePlayer: React.FC<MoviePlayerProps> = ({
  movie,
  initialCaptions = false,
  initialPrompt = true,
  initialLoop = false,
}) => {
  // State
  const [isPlaying, setIsPlaying] = useState(true);
  const [currentClipIndex, setCurrentClipIndex] = useState(0);
  const [showCaptions, setShowCaptions] = useState(initialCaptions);
  const [showPrompt, setShowPrompt] = useState(initialPrompt);
  const [isLooping, setIsLooping] = useState(initialLoop);
  const [currentPromptPage, setCurrentPromptPage] = useState(0);
  const [showControls, setShowControls] = useState(true);

  // Context hook
  const { resumeAnimations, pauseAnimations } = useAnimation();

  // Refs
  const controlsTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const clipTimerRef = useRef<NodeJS.Timeout | null>(null);
  const promptIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  const activeClip = movie.clips[currentClipIndex];

  // Helper to sync with AnimationContext for playback
  useEffect(() => {
    if (isPlaying) {
      resumeAnimations();
    } else {
      pauseAnimations();
    }
  }, [isPlaying, resumeAnimations, pauseAnimations]);

  // ReadOnly Context Value for AnimationCanvas
  const readOnlyContextValue = {
    currentStoryboard: movie,
    savedStoryboards: [],
    activeClipId: activeClip ? activeClip.id : null,
    activeClip: activeClip || null,
    setCurrentStoryboard: () => {},
    createNewStoryboard: () => {},
    renameStoryboard: () => {},
    updateStoryboardDescription: () => {},
    saveStoryboard: async () => false,
    loadStoryboard: async () => false,
    getSavedStoryboards: async () => [],
    deleteStoryboard: async () => false,
    addClip: () => '',
    saveCurrentAnimationAsClip: () => null,
    updateClip: () => {},
    removeClip: () => {},
    reorderClips: () => {},
    setActiveClipId: () => {},
    getActiveClip: () => activeClip || null,
    isPlaying: isPlaying,
    setIsPlaying: setIsPlaying,
    currentPlaybackPosition: 0,
    setCurrentPlaybackPosition: () => {},
    exportStoryboard: () => {},
    createStoryboardFromResponse: async () => movie
  };

  // Helper to go to next clip
  const nextClip = useCallback(() => {
    if (currentClipIndex < movie.clips.length - 1) {
      setCurrentClipIndex(prev => prev + 1);
    } else {
      // End of movie
      if (isLooping) {
        setCurrentClipIndex(0);
      } else {
        setIsPlaying(false);
      }
    }
  }, [currentClipIndex, movie.clips.length, isLooping]);

  // Helper to go to prev clip
  const prevClip = useCallback(() => {
    if (currentClipIndex > 0) {
      setCurrentClipIndex(prev => prev - 1);
    } else {
      // Loop back to end? Or just stay at start
      setCurrentClipIndex(0);
    }
  }, [currentClipIndex]);

  // Playback Logic
  useEffect(() => {
    if (!isPlaying || !activeClip) {
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
      return;
    }

    const durationMs = (activeClip.duration || 5) * 1000;

    // Log for debugging
    // console.log(`Playing clip ${currentClipIndex}: ${activeClip.name} for ${durationMs}ms`);

    clipTimerRef.current = setTimeout(() => {
      // Automatically move to next clip
      nextClip();
    }, durationMs);

    return () => {
      if (clipTimerRef.current) clearTimeout(clipTimerRef.current);
    };
  }, [isPlaying, activeClip, currentClipIndex, nextClip]);

  // Prompt Paging Logic
  useEffect(() => {
    if (!showPrompt || !movie.description) {
      if (promptIntervalRef.current) clearInterval(promptIntervalRef.current);
      return;
    }

    // Format prompt to see if we need paging
    // Simple heuristic: reset page every clip change or just cycle continuously?
    // User requirement: "cycle text every 5s"

    promptIntervalRef.current = setInterval(() => {
      setCurrentPromptPage(prev => prev + 1);
    }, 5000);

    return () => {
      if (promptIntervalRef.current) clearInterval(promptIntervalRef.current);
    };
  }, [showPrompt, movie.description]);

  // Auto-hide controls
  const handleMouseMove = () => {
    setShowControls(true);
    if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    if (isPlaying) {
      controlsTimeoutRef.current = setTimeout(() => {
        setShowControls(false);
      }, 3000);
    }
  };

  useEffect(() => {
    if (!isPlaying) {
      setShowControls(true);
      if (controlsTimeoutRef.current) clearTimeout(controlsTimeoutRef.current);
    }
  }, [isPlaying]);

  // Format description for paging
  const getPagedDescription = () => {
    if (!movie.description) return [];
    // Split into chunks of ~3 lines or ~200 chars
    const charsPerLine = 60;
    const linesPerPage = 3;
    const charsPerPage = charsPerLine * linesPerPage;

    // Simple word-based chunking
    const words = movie.description.split(' ');
    const pages: string[] = [];
    let currentPage = '';

    words.forEach(word => {
      if ((currentPage + word).length > charsPerPage) {
        pages.push(currentPage.trim());
        currentPage = word + ' ';
      } else {
        currentPage += word + ' ';
      }
    });
    if (currentPage.trim()) pages.push(currentPage.trim());

    return pages.length > 0 ? pages : [movie.description];
  };

  const pages = getPagedDescription();
  const activePageContent = pages[currentPromptPage % pages.length];

  return (
    <MovieContext.Provider value={readOnlyContextValue}>
      <div
        ref={containerRef}
      className="relative w-full h-full bg-black overflow-hidden flex items-center justify-center group"
      onMouseMove={handleMouseMove}
      onMouseLeave={() => isPlaying && setShowControls(false)}
      onClick={() => setIsPlaying(!isPlaying)}
    >
      {/* Animation Canvas */}
      <div className="w-full h-full pointer-events-none">
         {activeClip ? (
            <AnimationCanvas
              svgContent={activeClip.svgContent}
              isAnimationEditor={false}
            />
         ) : (
           <div className="text-white">Loading Clip...</div>
         )}
      </div>

      {/* Movie Prompt Overlay (Top-Left) */}
      {showPrompt && movie.description && (
        <div className="absolute top-4 left-4 max-w-lg z-20 pointer-events-none transition-opacity duration-300">
           <div className="bg-black/40 backdrop-blur-[2px] p-3 rounded-lg text-white/90 text-sm md:text-base font-medium shadow-sm border border-white/5">
              <p className="leading-snug animate-fade-in">
                 {activePageContent}
                 {pages.length > 1 && (
                   <span className="block text-[10px] opacity-50 mt-1 text-right">
                     {currentPromptPage % pages.length + 1}/{pages.length}
                   </span>
                 )}
              </p>
           </div>
        </div>
      )}

      {/* Clip Captions (Bottom-Center) */}
      {showCaptions && activeClip?.prompt && (
         <div className="absolute bottom-20 left-4 right-4 flex justify-center z-20 pointer-events-none">
            <div className="bg-black/60 backdrop-blur-[2px] px-4 py-2 rounded-lg text-white font-medium text-center shadow-md max-w-3xl">
               <p className="text-sm md:text-lg leading-tight">
                 {activeClip.prompt}
               </p>
            </div>
         </div>
      )}

      {/* Viewer Controls (Bottom Bar) */}
      <div
        className={`absolute bottom-0 left-0 right-0 bg-gradient-to-t from-black/80 to-transparent p-4 pb-6 transition-transform duration-300 z-30 ${
          showControls ? 'translate-y-0 opacity-100' : 'translate-y-full opacity-0'
        }`}
        onClick={(e) => e.stopPropagation()} // Prevent play/pause toggle when clicking controls
      >
        <div className="max-w-4xl mx-auto flex flex-col gap-2">
           {/* Progress Bar (Simulated per clip for now, ideally global) */}
           <div className="w-full flex gap-1 h-1">
              {movie.clips.map((clip, idx) => (
                <div key={clip.id} className="h-full flex-1 bg-gray-700/50 rounded-full overflow-hidden">
                   <div
                     className={`h-full bg-bat-yellow transition-all duration-300 ${
                       idx < currentClipIndex ? 'w-full' :
                       idx === currentClipIndex ? 'w-full animate-progress-fill' : 'w-0'
                     }`}
                     style={{
                       // For active clip, we could use CSS animation for smooth fill if we passed exact percentage
                       width: idx < currentClipIndex ? '100%' : (idx === currentClipIndex ? '100%' : '0%'), // Placeholder for improved progress
                       // A better way is using keyframes or JS to animate width from 0 to 100 over duration
                       transition: idx === currentClipIndex ? `width ${clip.duration || 5}s linear` : 'none',
                       // Reset width to 0 when not active to restart animation
                       // Note: React key or forcing redraw might be needed for perfect restart
                     }}
                   />
                </div>
              ))}
           </div>

           <div className="flex items-center justify-between text-white mt-2">
              <div className="flex items-center gap-4">
                 {/* Play/Pause */}
                 <button
                  onClick={() => setIsPlaying(!isPlaying)}
                  className="hover:text-bat-yellow transition-colors p-1"
                  title={isPlaying ? "Pause" : "Play"}
                 >
                   {isPlaying ? (
                     <svg className="w-6 h-6 md:w-8 md:h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M6 4h4v16H6V4zm8 0h4v16h-4V4z"/></svg>
                   ) : (
                     <svg className="w-6 h-6 md:w-8 md:h-8" fill="currentColor" viewBox="0 0 24 24"><path d="M8 5v14l11-7z"/></svg>
                   )}
                 </button>

                 {/* Prev/Next */}
                 <div className="flex items-center gap-2">
                    <button onClick={prevClip} className="p-1 hover:text-white/80 disabled:opacity-30" disabled={currentClipIndex === 0}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 6h2v12H6zm3.5 6l8.5 6V6z"/></svg>
                    </button>
                    <button onClick={nextClip} className="p-1 hover:text-white/80 disabled:opacity-30" disabled={currentClipIndex === movie.clips.length-1 && !isLooping}>
                      <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 24 24"><path d="M6 18l8.5-6L6 6v12zM16 6v12h2V6h-2z"/></svg>
                    </button>
                 </div>

                 <span className="text-xs md:text-sm text-gray-300 font-medium">
                   {currentClipIndex + 1} / {movie.clips.length}
                 </span>
              </div>

              <div className="flex items-center gap-3 md:gap-4">
                 {/* Loop Toggle */}
                 <button
                   onClick={() => setIsLooping(!isLooping)}
                   className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-xs md:text-sm font-medium ${isLooping ? 'bg-bat-yellow/20 text-bat-yellow' : 'text-gray-400 hover:text-white'}`}
                   title="Loop Movie"
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 4v5h.582m15.356 2A8.001 8.001 0 004.582 9m0 0H9m11 11v-5h-.581m0 0a8.003 8.003 0 01-15.357-2m15.357 2H15" /></svg>
                    <span className="hidden md:inline">Loop</span>
                 </button>

                 {/* Captions Toggle */}
                 <button
                   onClick={() => setShowCaptions(!showCaptions)}
                   className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-xs md:text-sm font-medium ${showCaptions ? 'bg-bat-yellow/20 text-bat-yellow' : 'text-gray-400 hover:text-white'}`}
                   title="Toggle Scene Captions"
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M7 8h10M7 12h4m1 8l-4-4H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-3l-4 4z" /></svg>
                    <span className="hidden md:inline">CC</span>
                 </button>

                 {/* Movie Info Toggle */}
                 <button
                   onClick={() => setShowPrompt(!showPrompt)}
                   className={`flex items-center gap-1.5 px-2 py-1 rounded-md transition-all text-xs md:text-sm font-medium ${showPrompt ? 'bg-bat-yellow/20 text-bat-yellow' : 'text-gray-400 hover:text-white'}`}
                   title="Toggle Movie Info"
                 >
                    <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M13 16h-1v-4h-1m1-4h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z" /></svg>
                    <span className="hidden md:inline">Info</span>
                 </button>
              </div>
           </div>
        </div>
      </div>
      </div>
    </MovieContext.Provider>
  );
};

export default MoviePlayer;
