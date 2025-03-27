import React, { useState, useEffect, useCallback } from 'react';
import { MovieStorageApi } from '../services/api';
import { Storyboard } from '../contexts/MovieContext';

const MovieListPage: React.FC = () => {
  const [storyboards, setStoryboards] = useState<Storyboard[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const getStoryboards = async (forceServerRefresh: boolean = false): Promise<Storyboard[]> => {
    return await MovieStorageApi.getStoryboards(forceServerRefresh);
  };

  /**
   * Fetch storyboards from the server
   */
  const fetchStoryboards = useCallback(async () => {
    setIsLoading(true);
    setError(null);

    try {
      // Get the most up-to-date list of movies from the server
      console.log('Fetching movie list with server refresh...');

      // Force server refresh if needed
      const forceServerRefresh = true;

      // If forcing server refresh, then don't use cache
      if (forceServerRefresh) {
        console.log('Forced server refresh requested - using server data only for movies');
      }

      const storyboards = await getStoryboards(forceServerRefresh);
      console.log(`Loaded ${storyboards.length} storyboards from server`);

      // Add detailed logging for clip counts
      storyboards.forEach(storyboard => {
        console.log(`Storyboard "${storyboard.name}" (${storyboard.id}) has ${storyboard.clips?.length || 0} clips`);
        if (storyboard.clips?.length === 0 && storyboard.generationStatus?.completedScenes > 0) {
          console.warn(`Warning: Storyboard "${storyboard.name}" has 0 clips but reports ${storyboard.generationStatus.completedScenes} completed scenes`);
        }
      });

      setStoryboards(storyboards);
    } catch (err) {
      console.error('Error fetching storyboards:', err);
      setError(err instanceof Error ? err.message : 'An error occurred fetching movies');
    } finally {
      setIsLoading(false);
    }
  }, []);

  useEffect(() => {
    fetchStoryboards();
  }, [fetchStoryboards]);

  return (
    <div className="w-full max-w-6xl mx-auto p-4">
      <h1 className="text-2xl font-bold mb-4">Movies</h1>

      {isLoading && <p>Loading storyboards...</p>}

      {error && <p className="text-red-500">{error}</p>}

      {!isLoading && !error && storyboards.length === 0 && (
        <p>No storyboards found. Create a new one to get started.</p>
      )}

      <ul className="space-y-4">
        {storyboards.map(storyboard => (
          <li key={storyboard.id} className="border p-4 rounded">
            <h2 className="text-xl">{storyboard.name}</h2>
            <p>Clips: {storyboard.clips?.length || 0}</p>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default MovieListPage;
