import React, { useState, useEffect } from 'react';
import { Storyboard } from '../contexts/MovieContext';
import ConfirmationModal from './ConfirmationModal';
import { MovieStorageApi } from '../services/api';
import { clearCacheForServerRefresh } from '../utils/sessionStorageUtils';

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
  const [loadedStoryboards, setLoadedStoryboards] = useState<Storyboard[]>([]);
  const [isLoadingStoryboards, setIsLoadingStoryboards] = useState(false);
  const [loadError, setLoadError] = useState<string | null>(null);
  const [storyboardToDelete, setStoryboardToDelete] = useState<string | null>(null);
  const [showDeleteConfirmation, setShowDeleteConfirmation] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');

  // Load storyboards when modal opens or refreshTrigger changes
  useEffect(() => {
    if (isOpen) {
      setIsLoadingStoryboards(true);
      setLoadedStoryboards([]); // Clear previous data

      const fetchStoryboards = async () => {
        try {
          // Clear cache to force fresh data
          clearCacheForServerRefresh();

          // Get list of storyboard IDs
          const storyboardIds = await getSavedStoryboards();

          // Fetch details for each storyboard directly from server for freshest data
          const storyboardsData: Storyboard[] = [];
          for (const id of storyboardIds) {
            try {
              // Use direct API call to bypass any stale cache
              const storyboard = await MovieStorageApi.getMovie(id);
              if (storyboard) {
                storyboardsData.push(storyboard as Storyboard);
              }
            } catch (err) {
              console.error(`Error fetching storyboard ${id}:`, err);
            }
          }

          // Sort by updated date (newest first)
          storyboardsData.sort((a, b) =>
            new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
          );

          setLoadedStoryboards(storyboardsData);
        } catch (err) {
          console.error('Error loading storyboards:', err);
          setLoadError('Failed to load storyboards');
        } finally {
          setIsLoadingStoryboards(false);
        }
      };

      fetchStoryboards();
    }
  }, [isOpen, getSavedStoryboards, refreshTrigger]);

  // Clear search query and storyboards when modal is closed
  useEffect(() => {
    setSearchQuery('');
    // Force clearing the loaded storyboards when modal is closed
    if (!isOpen) {
      setLoadedStoryboards([]);
    }
  }, [isOpen]);

  // Filter storyboards based on search query
  const filteredStoryboards = loadedStoryboards.filter(storyboard =>
    searchQuery === '' || storyboard.name.toLowerCase().includes(searchQuery.toLowerCase())
  );

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
          {isLoadingStoryboards && (
            <div className="flex items-center justify-center h-32">
              <div className="w-8 h-8 border-4 border-gray-400 border-t-bat-yellow rounded-full animate-spin"></div>
              <p className="ml-3 text-gray-400">Loading storyboards...</p>
            </div>
          )}

          {loadError && (
            <div className="bg-red-900 bg-opacity-20 border border-red-800 rounded-md p-4 m-3">
              <p className="text-red-400">{loadError}</p>
            </div>
          )}

          {!isLoadingStoryboards && !loadError && filteredStoryboards.length === 0 && (
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

          {!isLoadingStoryboards && !loadError && filteredStoryboards.length > 0 && (
            <div className="divide-y divide-gray-700">
              {filteredStoryboards.map((storyboard) => {
                // Find the first clip to use as a thumbnail
                const firstClip = storyboard.clips && storyboard.clips.length > 0
                  ? storyboard.clips[0]
                  : null;

                return (
                  <div
                    key={storyboard.id}
                    className="flex hover:bg-gotham-blue/20 transition p-0"
                  >
                    {/* Thumbnail area */}
                    <div
                      className="w-24 h-20 flex-shrink-0 bg-gray-800 cursor-pointer border-r border-gray-700 relative overflow-hidden"
                      onClick={async () => {
                        await onLoadStoryboard(storyboard.id);
                        onClose();
                      }}
                    >
                      {firstClip && firstClip.svgContent ? (
                        <>
                          {/* Log SVG content loading for debugging */}
                          {/* Using iframe for isolated SVG rendering */}
                          <div className="absolute inset-0 flex items-center justify-center bg-white"
                            ref={() => {
                              console.log(`[IFRAME TRACKING] Loading SVG content for storyboard ${storyboard.name} (${storyboard.id}), content length: ${firstClip.svgContent.length}`);
                            }}
                          >
                            <iframe
                              srcDoc={firstClip.svgContent}
                              className="w-full h-full border-0"
                              title={`Thumbnail for ${storyboard.name}`}
                              sandbox="allow-same-origin"
                            />
                          </div>
                          <div className="absolute bottom-0 right-0 bg-black/60 text-xs text-gray-300 px-1 py-0.5">
                            {storyboard.clips?.length || 0} clips
                          </div>
                        </>
                      ) : (
                        <div className="flex flex-col items-center justify-center w-full h-full text-gray-500">
                          <svg className="w-8 h-8 mb-1" fill="none" stroke="currentColor" viewBox="0 0 24 24" xmlns="http://www.w3.org/2000/svg">
                            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M7 4v16M17 4v16M3 8h4m10 0h4M3 12h18M3 16h4m10 0h4M4 20h16a1 1 0 0 0 1-1V5a1 1 0 0 0-1-1H4a1 1 0 0 0-1 1v14a1 1 0 0 0 1 1z" />
                          </svg>
                          <span className="text-xs">{storyboard.clips?.length || 0} clips</span>
                        </div>
                      )}
                    </div>

                    {/* Content area */}
                    <div
                      className="flex-1 p-3 cursor-pointer flex flex-col justify-between"
                      onClick={async () => {
                        await onLoadStoryboard(storyboard.id);
                        onClose();
                      }}
                    >
                      <div>
                        <div className="font-medium text-bat-yellow text-sm">{storyboard.name}</div>
                        <div className="text-xs text-gray-400 mt-1 flex items-center justify-between">
                          <span>{storyboard.clips?.length || 0} clips</span>
                          <span>{new Date(storyboard.updatedAt).toLocaleString()}</span>
                        </div>
                      </div>
                    </div>

                    {/* Delete button */}
                    <div className="flex items-center pr-3">
                      <button
                        className="text-xs text-red-400 hover:text-red-300 px-2 py-1"
                        onClick={(e) => {
                          e.stopPropagation();
                          setStoryboardToDelete(storyboard.id);
                          setShowDeleteConfirmation(true);
                        }}
                      >
                        Delete
                      </button>
                    </div>
                  </div>
                );
              })}
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

            // Remove the deleted storyboard from the list
            setLoadedStoryboards(prev =>
              prev.filter(board => board.id !== storyboardToDelete)
            );

            setStoryboardToDelete(null);
            setShowDeleteConfirmation(false);
          }
        }}
        onCancel={() => {
          setStoryboardToDelete(null);
          setShowDeleteConfirmation(false);
        }}
      />
    </div>
  );
};

export default LoadStoryboardModal;
