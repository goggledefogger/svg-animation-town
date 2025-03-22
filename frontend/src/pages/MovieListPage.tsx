/**
 * Fetch storyboards from the server
 */
const fetchStoryboards = async () => {
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
}; 