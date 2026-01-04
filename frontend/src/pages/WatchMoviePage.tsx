import React, { useEffect, useState } from 'react';
import { useParams, useNavigate, useLocation } from 'react-router-dom';
import MoviePlayer from '../components/MoviePlayer';
import { MovieStorageApi } from '../services/api';
import { Storyboard } from '../contexts/MovieContext';
import { useAnimation } from '../contexts/AnimationContext';

const WatchMoviePage: React.FC = () => {
  const { id } = useParams<{ id: string }>();
  const [movie, setMovie] = useState<Storyboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const navigate = useNavigate();
  const location = useLocation();
  const { setSvgContent } = useAnimation(); // Used to ensure AnimationCanvas has context if needed, though MoviePlayer handles it mostly

  // Parse query params for initial settings
  const queryParams = new URLSearchParams(location.search);
  const initialCaptions = queryParams.get('captions') === 'true';
  const initialPrompt = queryParams.get('prompt') !== 'false'; // Default to true unless explicitly false
  const initialLoop = queryParams.get('loop') === 'true';

  useEffect(() => {
    const fetchMovie = async () => {
      if (!id) {
        setError('No movie ID provided');
        setLoading(false);
        return;
      }

      try {
        setLoading(true);
        const response = await MovieStorageApi.getMovie(id);

        if (response && response.success && response.movie) {
           // Ensure dates are parsed correctly
           const parsedMovie: Storyboard = {
             ...response.movie,
             createdAt: new Date(response.movie.createdAt),
             updatedAt: new Date(response.movie.updatedAt),
             clips: response.movie.clips || [] // Ensure clips array exists
           };

           // Sort clips by order
           if (parsedMovie.clips) {
             parsedMovie.clips.sort((a, b) => a.order - b.order);
           }

           setMovie(parsedMovie);
        } else {
          setError('Movie not found');
        }
      } catch (err) {
        console.error('Error fetching movie:', err);
        setError('Failed to load movie');
      } finally {
        setLoading(false);
      }
    };

    fetchMovie();
  }, [id]);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="flex flex-col items-center gap-4">
           {/* Simple Spinner */}
           <div className="w-8 h-8 border-4 border-bat-yellow border-t-transparent rounded-full animate-spin"></div>
           <p className="text-gray-400">Loading movie...</p>
        </div>
      </div>
    );
  }

  if (error || !movie) {
    return (
      <div className="flex items-center justify-center h-screen bg-black text-white">
        <div className="text-center max-w-md p-8 bg-gray-900 rounded-lg border border-gray-800">
           <svg className="w-16 h-16 mx-auto text-gray-600 mb-4" fill="none" stroke="currentColor" viewBox="0 0 24 24"><path strokeLinecap="round" strokeLinejoin="round" strokeWidth={1.5} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-3L13.732 4c-.77-1.333-2.694-1.333-3.464 0L3.34 16c-.77 1.333.192 3 1.732 3z"/></svg>
           <h2 className="text-xl font-bold mb-2">Unavailable</h2>
           <p className="text-gray-400 mb-6">{error || 'Movie could not be loaded'}</p>
           <button
             onClick={() => navigate('/')}
             className="px-6 py-2 bg-bat-yellow text-black font-bold rounded-full hover:bg-yellow-400 transition-colors"
           >
             Go to Home
           </button>
        </div>
      </div>
    );
  }

  return (
    <div className="h-screen w-screen bg-black overflow-hidden">
      <MoviePlayer
        movie={movie}
        initialCaptions={initialCaptions}
        initialPrompt={initialPrompt}
        initialLoop={initialLoop}
      />
    </div>
  );
};

export default WatchMoviePage;
