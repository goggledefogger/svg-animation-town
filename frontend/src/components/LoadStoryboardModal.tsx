import React, { useState, useEffect, useCallback } from 'react';
import { Storyboard } from '../contexts/MovieContext';
import ConfirmationModal from './ConfirmationModal';
import { MovieStorageApi } from '../services/api';
import { clearCacheForServerRefresh } from '../utils/sessionStorageUtils';
import { useInfiniteLoading } from '../hooks/useInfiniteLoading';
import StoryboardItem from './StoryboardItem';

interface LoadStoryboardModalProps {
  isOpen: boolean;
  onClose: () => void;
  onLoadStoryboard: (id: string) => Promise<void | boolean>;
  onDeleteStoryboard: (id: string) => Promise<void | boolean>;
  getSavedStoryboards: () => Promise<string[]>;
  refreshTrigger?: number;
}

const LoadStoryboardModal: React.FC<LoadStoryboardModalProps> = ({
  isOpen,
  onClose,
  onLoadStoryboard,
  onDeleteStoryboard,
  getSavedStoryboards,
  refreshTrigger = 0
}) => {
  // Search state
  const [searchQuery, setSearchQuery] = useState('');
  
  // Confirmation dialog state
  const [storyboardToDelete, setStoryboardToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);

  // Create a filter function based on the search query
  const createSearchFilter = useCallback((query: string) => {
    return (storyboard: Storyboard) => {
      return query === '' || storyboard.name.toLowerCase().includes(query.toLowerCase());
    };
  }, []);

  // Use our custom hook for infinite loading
  const {
    filteredItems: filteredStoryboards,
    isLoading,
    isLoadingMore,
    hasMore,
    error: loadError,
    lastItemRef,
    reset: resetStoryboards,
    filterItems
  } = useInfiniteLoading<Storyboard, string>({
    fetchIds: getSavedStoryboards,
    fetchItem: (id) => {
      console.log(`[FETCH TRACKING] Loading storyboard ${id}`);
      return MovieStorageApi.getMovie(id);
    },
    enabled: isOpen,
    initialFilter: createSearchFilter('')
  });

  // Clear search and reset when modal is opened or refreshTrigger changes
  useEffect(() => {
    if (isOpen) {
      // Clear cache to force fresh data
      clearCacheForServerRefresh();
      
      // Reset search
      setSearchQuery('');
      
      // Log rendering behavior for debugging
      if (filteredStoryboards.length > 0) {
        console.log(`[RENDER TRACKING] Rendering ${filteredStoryboards.length} storyboards to DOM at ${new Date().toISOString()}. First batch: ${filteredStoryboards.slice(0, 3).map(s => s.name).join(', ')}...`);
      }
    } else {
      // Cleanup when modal closes
      resetStoryboards();
    }
  }, [isOpen, refreshTrigger, resetStoryboards]);

  // Update filter when search query changes
  useEffect(() => {
    filterItems(createSearchFilter(searchQuery));
  }, [searchQuery, filterItems, createSearchFilter]);

  // Handle requesting deletion of a storyboard
  const handleRequestDelete = useCallback((id: string) => {
    setStoryboardToDelete(id);
    setShowDeleteConfirmation(true);
  }, []);

  // Handle load storyboard and close modal
  const handleLoadStoryboard = useCallback(async (id: string) => {
    await onLoadStoryboard(id);
    onClose();
  }, [onLoadStoryboard, onClose]);

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-gotham-blue border border-gray-700 rounded-lg shadow-lg w-full max-w-xl max-h-[80vh] flex flex-col overflow-hidden">
        {/* Header */}
        <div className="bg-gotham-blue border-b border-gray-700 p-4 flex justify-between items-center">
          <h2 className="text-lg font-medium text-white">Load Storyboard</h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white"
            aria-label="Close"
          >
            <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
              <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
            </svg>
          </button>
        </div>

        {/* Search input */}
        <div className="p-3 bg-gotham-blue/60 border-b border-gray-700">
          <input
            type="text"
            placeholder="Search storyboards..."
            className="w-full bg-gotham-black border border-gray-700 rounded-md px-3 py-2 text-sm text-white focus:outline-none focus:ring-1 focus:ring-bat-yellow"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Content */}
        <div className="flex-1 overflow-auto p-0">
          {/* Loading state */}
          {isLoading && filteredStoryboards.length === 0 && (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-gray-400 border-t-bat-yellow rounded-full animate-spin"></div>
              <p className="ml-3 text-gray-400">Loading storyboards...</p>
            </div>
          )}

          {/* Error state */}
          {loadError && (
            <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-md p-4 m-3">
              <p className="text-red-400">{loadError}</p>
            </div>
          )}

          {/* Empty state */}
          {!isLoading && !loadError && filteredStoryboards.length === 0 && (
            <div className="flex flex-col items-center justify-center h-32 text-center">
              {searchQuery ? (
                <p className="text-gray-400">No storyboards matching "{searchQuery}"</p>
              ) : (
                <>
                  <p className="text-gray-400">No saved storyboards found.</p>
                  <p className="text-sm text-gray-500 mt-2">Create and save a storyboard to see it here.</p>
                </>
              )}
            </div>
          )}

          {/* Storyboard list */}
          {!isLoading && !loadError && filteredStoryboards.length > 0 && (
            <div className="divide-y divide-gray-700">
              {filteredStoryboards.map((storyboard, index) => (
                <StoryboardItem
                  key={storyboard.id}
                  storyboard={storyboard}
                  onLoadStoryboard={handleLoadStoryboard}
                  onRequestDelete={handleRequestDelete}
                  ref={index === filteredStoryboards.length - 1 ? lastItemRef : undefined}
                />
              ))}
              
              {/* Loading more indicator */}
              {(isLoadingMore || hasMore) && (
                <div className="flex items-center justify-center py-4">
                  {isLoadingMore ? (
                    <>
                      <div className="w-5 h-5 border-2 border-gray-400 border-t-bat-yellow rounded-full animate-spin mr-2"></div>
                      <p className="text-sm text-gray-400">Loading more...</p>
                    </>
                  ) : (
                    <p className="text-sm text-gray-500">Scroll for more</p>
                  )}
                </div>
              )}
            </div>
          )}
        </div>
      </div>

      {/* Delete Confirmation */}
      <ConfirmationModal
        isOpen={showDeleteConfirmation}
        title="Delete Storyboard"
        message="Are you sure you want to delete this storyboard? This action cannot be undone."
        confirmText="Delete"
        cancelText="Cancel"
        onConfirm={async () => {
          if (storyboardToDelete) {
            await onDeleteStoryboard(storyboardToDelete);
            
            // Reset to reload without the deleted item
            resetStoryboards();
            
            setShowDeleteConfirmation(false);
            setStoryboardToDelete(null);
          }
        }}
        onCancel={() => {
          setShowDeleteConfirmation(false);
          setStoryboardToDelete(null);
        }}
      />
    </div>
  );
};

export default LoadStoryboardModal;
