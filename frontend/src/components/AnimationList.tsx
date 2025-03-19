import React, { useState, useEffect, useCallback, useRef } from 'react';
import { AnimationStorageApi } from '../services/api';
import SvgThumbnail from './SvgThumbnail';

// Animation item interface
export interface AnimationItem {
  id: string;
  name: string;
  timestamp?: string;
  [key: string]: any;
}

// Create placeholder SVG for loading or empty states
const createPlaceholderSvg = (message: string): string => {
  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 600" width="800" height="600">
    <rect width="800" height="600" fill="#1a1a2e" />
    <circle cx="400" cy="300" r="50" fill="#4a5568">
      <animate attributeName="opacity" values="0.5;1;0.5" dur="2s" repeatCount="indefinite" />
    </circle>
    <text x="400" y="400" font-family="Arial" font-size="16" fill="white" text-anchor="middle">${message}</text>
  </svg>`;
};

interface AnimationListProps {
  onSelectAnimation: (animation: AnimationItem, animationSvg?: string) => void;
  onDeleteAnimation?: (animation: AnimationItem) => Promise<boolean>;
  onClose?: () => void;
  title?: string;
  showThumbnails?: boolean;
  containerClassName?: string;
  listClassName?: string;
  itemClassName?: string;
  maxHeight?: string;
  showSearchFilter?: boolean;
  transformAnimations?: (animations: AnimationItem[]) => AnimationItem[];
  renderSpecialItem?: (animation: AnimationItem) => React.ReactNode;
}

const AnimationList: React.FC<AnimationListProps> = ({
  onSelectAnimation,
  onDeleteAnimation,
  onClose,
  title = "Select Animation",
  showThumbnails = true,
  containerClassName = "bg-gray-800 rounded-md p-3 border border-gray-700",
  listClassName = "space-y-2",
  itemClassName = "border border-gray-700 hover:border-bat-yellow rounded-md p-2 cursor-pointer",
  maxHeight = "h-64",
  showSearchFilter = false,
  transformAnimations,
  renderSpecialItem
}) => {
  // State for animations
  const [animations, setAnimations] = useState<AnimationItem[]>([]);
  const [loadingAnimations, setLoadingAnimations] = useState(false);
  const [error, setError] = useState<string | null>(null);
  
  // State for thumbnails
  const [thumbnails, setThumbnails] = useState<Record<string, string>>({});
  const [loadingThumbnails, setLoadingThumbnails] = useState<Record<string, boolean>>({});
  
  // Search filter state
  const [searchTerm, setSearchTerm] = useState('');
  const [filteredAnimations, setFilteredAnimations] = useState<AnimationItem[]>([]);
  
  // Track if the component is mounted to prevent state updates after unmounting
  const isMounted = useRef(true);
  
  // Track if transformations have been applied
  const transformationsApplied = useRef(false);
  
  // Cleanup effect
  useEffect(() => {
    return () => {
      isMounted.current = false;
      transformationsApplied.current = false;
    };
  }, []);
  
  // Load animations from server
  useEffect(() => {
    let isActive = true; // For race condition prevention
    transformationsApplied.current = false;
    
    const fetchAnimations = async () => {
      if (!isActive) return;
      
      setLoadingAnimations(true);
      setError(null);
      
      try {
        const animationList = await AnimationStorageApi.listAnimations();
        
        if (!isActive) return;
        
        // Sort by timestamp (most recent first)
        const sortedAnimations = [...animationList].sort((a, b) => {
          const timestampA = a.timestamp || '';
          const timestampB = b.timestamp || '';
          return timestampB.localeCompare(timestampA);
        });
        
        if (!isActive) return;
        
        // Apply transformations if provided, but only once during initial load
        let finalAnimations = sortedAnimations;
        if (transformAnimations && !transformationsApplied.current) {
          finalAnimations = transformAnimations(sortedAnimations);
          transformationsApplied.current = true;
        }
        
        setAnimations(finalAnimations);
        setFilteredAnimations(
          searchTerm 
            ? finalAnimations.filter(animation => 
                animation.name.toLowerCase().includes(searchTerm.toLowerCase())
              ) 
            : finalAnimations
        );
        
        // Preload first few thumbnails for better UX
        if (showThumbnails && finalAnimations.length > 0 && isActive) {
          // Skip special items that might not have real animation IDs
          const animationsToPreload = finalAnimations
            .filter(a => !a.id.startsWith('create-') && !a.id.startsWith('special-'))
            .slice(0, 5);
            
          for (const animation of animationsToPreload) {
            if (!isActive) break;
            loadThumbnail(animation.id);
          }
        }
      } catch (error) {
        if (!isActive) return;
        
        console.error('Error loading animations:', error);
        setError('Failed to load animations');
        setAnimations([]);
        setFilteredAnimations([]);
      } finally {
        if (isActive) {
          setLoadingAnimations(false);
        }
      }
    };
    
    fetchAnimations();
    
    return () => {
      isActive = false; // Prevent state updates if component unmounts during fetch
    };
  }, [showThumbnails]); 
  
  // Handle filtering when search term changes
  useEffect(() => {
    if (animations.length === 0) return;
    
    const filtered = searchTerm
      ? animations.filter(animation => 
          animation.name.toLowerCase().includes(searchTerm.toLowerCase())
        ) 
      : animations;
    
    setFilteredAnimations(filtered);
  }, [animations, searchTerm]);
  
  // Load a thumbnail for a specific animation
  const loadThumbnail = useCallback(async (animationId: string) => {
    // Skip special items
    if (animationId.startsWith('create-') || animationId.startsWith('special-')) {
      return null;
    }
    
    if (thumbnails[animationId] || loadingThumbnails[animationId]) {
      return thumbnails[animationId];
    }
    
    setLoadingThumbnails(prev => ({ ...prev, [animationId]: true }));
    
    try {
      const animation = await AnimationStorageApi.getAnimation(animationId);
      
      if (animation && animation.svg) {
        setThumbnails(prev => ({
          ...prev,
          [animationId]: animation.svg
        }));
        return animation.svg;
      }
    } catch (error) {
      console.error(`Error loading thumbnail for animation ${animationId}:`, error);
    } finally {
      setLoadingThumbnails(prev => ({ ...prev, [animationId]: false }));
    }
    
    return null;
  }, [thumbnails, loadingThumbnails]);
  
  // Handle animation selection
  const handleSelectAnimation = async (animation: AnimationItem) => {
    try {
      // If we don't have the SVG content yet and thumbnails are enabled, load it
      let animationSvg = thumbnails[animation.id];
      
      if (!animationSvg && showThumbnails && !animation.id.startsWith('create-') && !animation.id.startsWith('special-')) {
        animationSvg = await loadThumbnail(animation.id) || undefined;
      }
      
      // Call the selection handler
      onSelectAnimation(animation, animationSvg);
      
      // Close the panel if a close handler is provided
      if (onClose) {
        onClose();
      }
    } catch (error) {
      console.error('Error selecting animation:', error);
    }
  };
  
  // Handle animation deletion
  const handleDeleteAnimation = async (event: React.MouseEvent, animation: AnimationItem) => {
    event.stopPropagation();
    
    if (!onDeleteAnimation) return;
    
    if (window.confirm(`Delete animation "${animation.name}"?`)) {
      try {
        const success = await onDeleteAnimation(animation);
        
        if (success) {
          // Remove from local state
          setAnimations(prev => prev.filter(a => a.id !== animation.id));
          setFilteredAnimations(prev => prev.filter(a => a.id !== animation.id));
          
          // Remove thumbnail
          setThumbnails(prev => {
            const { [animation.id]: _, ...rest } = prev;
            return rest;
          });
        } else {
          alert(`Failed to delete animation "${animation.name}".`);
        }
      } catch (error) {
        console.error(`Error deleting animation "${animation.name}":`, error);
        alert(`Error deleting animation "${animation.name}". Check console for details.`);
      }
    }
  };
  
  // Render a single animation item
  const renderAnimationItem = (animation: AnimationItem) => {
    // If a special item renderer is provided and returns content, use it
    if (renderSpecialItem) {
      const specialContent = renderSpecialItem(animation);
      if (specialContent) {
        return specialContent;
      }
    }
    
    // If no special renderer or it returned null, render normally
    return (
      <div className="flex items-center">
        {/* Thumbnail preview */}
        {showThumbnails && (
          <div className="w-16 h-12 mr-2 overflow-hidden bg-gray-900 rounded flex-shrink-0">
            {thumbnails[animation.id] ? (
              <SvgThumbnail svgContent={thumbnails[animation.id]} />
            ) : loadingThumbnails[animation.id] ? (
              <div className="flex items-center justify-center h-full">
                <div className="w-4 h-4 border-2 border-gray-300 border-t-bat-yellow rounded-full animate-spin"></div>
              </div>
            ) : (
              <div className="flex items-center justify-center h-full">
                <svg className="w-6 h-6 text-gray-500" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z" />
                </svg>
              </div>
            )}
          </div>
        )}
        
        {/* Animation details */}
        <div className="flex-1 min-w-0">
          <div className="font-medium text-bat-yellow text-sm truncate">{animation.name}</div>
          <div className="text-xs text-gray-400">
            {animation.timestamp ? new Date(animation.timestamp).toLocaleString() : 'No date'}
          </div>
        </div>
      </div>
    );
  };
  
  return (
    <div className={containerClassName}>
      {/* Header with title and close button */}
      {(title || onClose) && (
        <div className="flex justify-between items-center mb-3">
          {title && <h3 className="text-sm font-medium">{title}</h3>}
          {onClose && (
            <button 
              className="text-gray-400 hover:text-white"
              onClick={onClose}
              aria-label="Close"
            >
              <svg className="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          )}
        </div>
      )}
      
      {/* Search filter */}
      {showSearchFilter && (
        <div className="mb-3">
          <input
            type="text"
            placeholder="Search animations..."
            value={searchTerm}
            onChange={(e) => setSearchTerm(e.target.value)}
            className="w-full px-3 py-2 bg-gray-700 border border-gray-600 rounded-md text-white text-sm focus:outline-none focus:border-bat-yellow"
          />
        </div>
      )}
      
      {/* Animation list */}
      <div className={`overflow-y-auto ${maxHeight}`}>
        {loadingAnimations ? (
          <div className="text-center p-4">
            <p className="text-sm text-gray-400">Loading animations...</p>
          </div>
        ) : error ? (
          <div className="text-center p-4">
            <p className="text-sm text-red-400">{error}</p>
          </div>
        ) : filteredAnimations.length === 0 ? (
          <div className="text-center p-4">
            <p className="text-sm text-gray-400">
              {searchTerm ? 'No animations match your search' : 'No saved animations found'}
            </p>
          </div>
        ) : (
          <div className={listClassName}>
            {filteredAnimations.map(animation => (
              <div 
                key={animation.id}
                className={itemClassName}
                onClick={() => handleSelectAnimation(animation)}
                onMouseEnter={() => {
                  // Only preload thumbnails for real animations
                  if (showThumbnails && !animation.id.startsWith('create-') && !animation.id.startsWith('special-')) {
                    loadThumbnail(animation.id);
                  }
                }}
              >
                <div className="flex items-center justify-between">
                  <div className="flex-1">
                    {renderAnimationItem(animation)}
                  </div>
                  
                  {/* Delete button - only show for regular animations, not special items */}
                  {onDeleteAnimation && !animation.id.startsWith('create-') && !animation.id.startsWith('special-') && (
                    <button
                      className="ml-2 text-red-400 hover:text-red-300 text-xs"
                      onClick={(e) => handleDeleteAnimation(e, animation)}
                      aria-label="Delete animation"
                    >
                      Delete
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default AnimationList; 