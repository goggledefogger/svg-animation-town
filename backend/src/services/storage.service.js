const fs = require('fs').promises;
const path = require('path');
const { v4: uuidv4 } = require('uuid');

// Base directory for storage
const OUTPUT_DIR = path.join(__dirname, '..', 'output');
// Subdirectories for different content types
const ANIMATIONS_DIR = path.join(OUTPUT_DIR, 'animations');
const MOVIES_DIR = path.join(OUTPUT_DIR, 'movies');

/**
 * Storage service for file operations
 */
class StorageService {
  /**
   * Initialize storage directories
   */
  async init() {
    try {
      // Create base output directory if it doesn't exist
      await this._ensureDirectoryExists(OUTPUT_DIR);
      // Create subdirectories
      await this._ensureDirectoryExists(ANIMATIONS_DIR);
      await this._ensureDirectoryExists(MOVIES_DIR);

      console.log('Storage directories initialized successfully');
    } catch (error) {
      console.error('Error initializing storage directories:', error);
      throw error;
    }
  }

  /**
   * Save animation data
   * @param {string} name - Animation name
   * @param {Object} data - Animation data (SVG content and optional chat history)
   * @returns {Promise<string>} The ID of the saved animation
   */
  async saveAnimation(name, data) {
    try {
      const id = data.id || uuidv4();
      const filename = `${id}.json`;
      const filePath = path.join(ANIMATIONS_DIR, filename);

      const animationData = {
        id,
        name,
        svg: data.svg,
        chatHistory: data.chatHistory || [],
        timestamp: data.timestamp || new Date().toISOString()
      };

      await fs.writeFile(filePath, JSON.stringify(animationData, null, 2));

      // After saving, update any movie's generation status that references this animation
      await this.updateMovieGenerationStatus(id);

      return id;
    } catch (error) {
      console.error('Error saving animation:', error);
      throw error;
    }
  }

  /**
   * Get animation by ID
   * @param {string} id - Animation ID
   * @returns {Promise<Object>} Animation data
   */
  async getAnimation(id) {
    try {
      const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
      const data = await fs.readFile(filePath, 'utf8');
      return JSON.parse(data);
    } catch (error) {
      console.error(`Error getting animation ${id}:`, error);
      throw error;
    }
  }

  /**
   * List all animations
   * @returns {Promise<Array>} List of animation metadata
   */
  async listAnimations() {
    try {
      // Check if directory exists
      try {
        await fs.access(ANIMATIONS_DIR);
      } catch (err) {
        console.error('Storage: Animations directory does not exist or is not accessible:', err);
        await this._ensureDirectoryExists(ANIMATIONS_DIR);
        return []; // Return empty array if directory was just created
      }

      const files = await fs.readdir(ANIMATIONS_DIR);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      const animations = await Promise.all(
        jsonFiles.map(async file => {
          try {
            const filePath = path.join(ANIMATIONS_DIR, file);
            const data = await fs.readFile(filePath, 'utf8');
            const animation = JSON.parse(data);
            // Return minimal metadata
            return {
              id: animation.id,
              name: animation.name,
              timestamp: animation.timestamp
            };
          } catch (error) {
            console.error(`Storage: Error reading animation file ${file}:`, error);
            return null;
          }
        })
      );

      // Filter out any nulls from errors
      return animations.filter(Boolean);
    } catch (error) {
      console.error('Storage: Error listing animations:', error);
      throw error;
    }
  }

  /**
   * Delete animation by ID
   * @param {string} id - Animation ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteAnimation(id) {
    try {
      const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Error deleting animation ${id}:`, error);
      return false;
    }
  }

  /**
   * Save movie/storyboard data
   * @param {Object} storyboard - The storyboard data
   * @returns {Promise<string>} The ID of the saved storyboard
   */
  async saveMovie(storyboard) {
    try {
      const id = storyboard.id || uuidv4();
      const filename = `${id}.json`;
      const filePath = path.join(MOVIES_DIR, filename);

      // Process generationStatus dates if present
      let generationStatus = storyboard.generationStatus;
      if (generationStatus) {
        if (generationStatus.startedAt instanceof Date) {
          generationStatus.startedAt = generationStatus.startedAt.toISOString();
        }
        if (generationStatus.completedAt instanceof Date) {
          generationStatus.completedAt = generationStatus.completedAt.toISOString();
        }

        // Automatically determine completion status based on clips vs expected scenes
        if (storyboard.clips && Array.isArray(storyboard.clips) && generationStatus.inProgress) {
          const actualClips = storyboard.clips.length;
          const totalExpectedScenes = generationStatus.totalScenes || 0;

          // If we have clips and either meet/exceed the expected count or there's no expected count
          if (actualClips > 0 && (totalExpectedScenes === 0 || actualClips >= totalExpectedScenes)) {
            console.log(`Movie ${id}: Auto-marking as complete (${actualClips}/${totalExpectedScenes} scenes)`);
            generationStatus.inProgress = false;
            generationStatus.completedAt = generationStatus.completedAt || new Date().toISOString();
            generationStatus.completedScenes = actualClips;
          } else if (actualClips > 0) {
            // Update the completed count if we have some clips but not all
            console.log(`Movie ${id}: Updating progress (${actualClips}/${totalExpectedScenes} scenes)`);
            generationStatus.completedScenes = actualClips;
          }
        }
      }

      // Process clips to store only references to animations, not the full SVG content
      let optimizedClips = [];

      if (storyboard.clips && Array.isArray(storyboard.clips)) {
        optimizedClips = storyboard.clips.map((clip) => {
          // Create an optimized clip object that doesn't include the SVG content
          return {
            id: clip.id,
            name: clip.name,
            duration: clip.duration,
            order: clip.order,
            prompt: clip.prompt || '',
            animationId: clip.animationId // The key reference to the animation
          };
        });
      }

      // Store original scenes array for resumable generation
      // Only include necessary data for generation resumption
      let optimizedOriginalScenes = null;
      if (storyboard.originalScenes && Array.isArray(storyboard.originalScenes)) {
        optimizedOriginalScenes = storyboard.originalScenes.map(scene => ({
          id: scene.id,
          description: scene.description,
          svgPrompt: scene.svgPrompt,
          duration: scene.duration
        }));
      }

      // Ensure dates are stored as ISO strings
      const optimizedStoryboard = {
        ...storyboard,
        id,
        clips: optimizedClips,
        createdAt: storyboard.createdAt instanceof Date
          ? storyboard.createdAt.toISOString()
          : storyboard.createdAt,
        updatedAt: new Date().toISOString(),
        generationStatus,
        // Store AI provider for resumable generation
        aiProvider: storyboard.aiProvider,
        // Store optimized original scenes
        originalScenes: optimizedOriginalScenes
      };

      // Write the file
      const storyboardJSON = JSON.stringify(optimizedStoryboard, null, 2);
      await fs.writeFile(filePath, storyboardJSON);

      return id;
    } catch (error) {
      console.error('Error saving movie:', error);
      throw error;
    }
  }

  /**
   * Get movie/storyboard by ID
   * @param {string} id - Movie ID
   * @returns {Promise<Object|null>} Movie data or null if not found
   */
  async getMovie(id) {
    try {
      const filePath = path.join(MOVIES_DIR, `${id}.json`);

      // Check if file exists first
      try {
        await fs.access(filePath);
      } catch (err) {
        return null;
      }

      const data = await fs.readFile(filePath, 'utf8');
      const movie = JSON.parse(data);

      // Ensure generation status accuracy before returning to frontend
      if (movie.generationStatus && movie.generationStatus.inProgress) {
        const actualClips = movie.clips?.length || 0;
        const totalExpectedScenes = movie.generationStatus.totalScenes || 0;

        // If we have clips and either meet/exceed the expected count or there's no expected count
        if (actualClips > 0 && (totalExpectedScenes === 0 || actualClips >= totalExpectedScenes)) {
          console.log(`Movie ${id}: Marked as complete on retrieval (${actualClips}/${totalExpectedScenes} scenes)`);
          movie.generationStatus.inProgress = false;
          movie.generationStatus.completedAt = movie.generationStatus.completedAt || new Date().toISOString();
          movie.generationStatus.completedScenes = actualClips;

          // Save the corrected status back to the file
          await this.saveMovie(movie);
        }
      }

      return movie;
    } catch (error) {
      console.error(`Error getting movie ${id}:`, error);
      return null;
    }
  }

  /**
   * List all movies/storyboards
   * @returns {Promise<Array>} Array of movie metadata objects
   */
  async listMovies() {
    try {
      // Check if directory exists
      try {
        await fs.access(MOVIES_DIR);
      } catch (err) {
        console.error('Movies directory does not exist or is not accessible:', err);
        await this._ensureDirectoryExists(MOVIES_DIR);
        return []; // Return empty array if directory was just created
      }

      const files = await fs.readdir(MOVIES_DIR);
      const jsonFiles = files.filter(file => file.endsWith('.json'));

      const movies = await Promise.all(
        jsonFiles.map(async file => {
          try {
            const filePath = path.join(MOVIES_DIR, file);
            const data = await fs.readFile(filePath, 'utf8');
            const movie = JSON.parse(data);
            // Return minimal metadata
            return {
              id: movie.id,
              name: movie.name,
              description: movie.description || '',
              clipCount: movie.clips ? movie.clips.length : 0,
              updatedAt: movie.updatedAt || movie.timestamp || new Date().toISOString()
            };
          } catch (error) {
            console.error(`Error reading movie file ${file}:`, error);
            return null;
          }
        })
      );

      // Filter out any nulls from errors
      return movies.filter(Boolean);
    } catch (error) {
      console.error('Error listing movies:', error);
      throw error;
    }
  }

  /**
   * Delete movie by ID
   * @param {string} id - Movie ID
   * @returns {Promise<boolean>} Success status
   */
  async deleteMovie(id) {
    try {
      const filePath = path.join(MOVIES_DIR, `${id}.json`);
      await fs.unlink(filePath);
      return true;
    } catch (error) {
      console.error(`Error deleting movie ${id}:`, error);
      return false;
    }
  }

  /**
   * Ensure a directory exists, creating it if necessary
   * @param {string} dir - Directory path
   * @private
   */
  async _ensureDirectoryExists(dir) {
    try {
      await fs.mkdir(dir, { recursive: true });
    } catch (error) {
      if (error.code !== 'EEXIST') {
        throw error;
      }
    }
  }

  /**
   * Get full animation data for a clip from its animationId
   * This method allows the frontend to get complete animation data when needed
   */
  async getAnimationForClip(animationId) {
    if (!animationId) {
      console.warn('STORAGE: Cannot get animation - no animation ID provided');
      return null;
    }

    try {
      return await this.getAnimation(animationId);
    } catch (error) {
      console.error(`STORAGE: Error getting animation ${animationId} for clip:`, error);
      return null;
    }
  }

  /**
   * Update movie with new animation data
   * @param {string} animationId - Animation ID
   * @param {Object} animationData - Animation data
   */
  async updateMovieWithAnimation(animationId, animationData) {
    try {
      // List all movies
      const movies = await this.listMovies();

      // Iterate through each movie to find and update the relevant clip
      for (const movie of movies) {
        let updated = false;

        // Check if the movie has clips
        if (movie.clips && Array.isArray(movie.clips)) {
          for (const clip of movie.clips) {
            if (clip.animationId === animationId) {
              // Update the clip with the new animation data
              clip.svg = animationData.svg;
              clip.chatHistory = animationData.chatHistory;
              clip.timestamp = animationData.timestamp;
              updated = true;
            }
          }
        }

        // Save the updated movie if any clip was updated
        if (updated) {
          await this.saveMovie(movie);
        }
      }
    } catch (error) {
      console.error('Error updating movie with animation:', error);
      throw error;
    }
  }

  /**
   * Update movie generation status when a new animation is saved
   * @param {string} animationId - The ID of the animation that was just saved
   */
  async updateMovieGenerationStatus(animationId) {
    try {
      console.log(`Checking for movies containing animation ID: ${animationId}`);
      // List all movies
      const movies = await this.listMovies();
      let updatedMovieCount = 0;

      // Find movies that contain this animation ID
      for (const movieMeta of movies) {
        try {
          // Load the full movie data
          const movie = await this.getMovie(movieMeta.id);

          if (!movie || !movie.clips || !Array.isArray(movie.clips)) {
            continue;
          }

          // Check if this movie contains the animation
          const matchingClipIndex = movie.clips.findIndex(clip => clip.animationId === animationId);
          const hasAnimation = matchingClipIndex !== -1;

          if (hasAnimation) {
            console.log(`Found movie ${movie.id} (${movie.name || 'Unnamed'}) containing animation ${animationId}`);
            console.log(`Movie generation status: inProgress=${movie.generationStatus?.inProgress}, totalScenes=${movie.generationStatus?.totalScenes || 0}`);

            if (movie.generationStatus) {
              // Count how many clips have animation IDs
              const completedClips = movie.clips.filter(clip => clip.animationId).length;
              const totalScenes = movie.generationStatus.totalScenes || movie.clips.length;

              console.log(`Movie ${movie.id} has ${completedClips}/${totalScenes} completed scenes`);

              // Update the generation status
              if (completedClips > 0) {
                movie.generationStatus.completedScenes = completedClips;

                // If we've completed all scenes, mark as complete
                if (completedClips >= totalScenes) {
                  movie.generationStatus.inProgress = false;
                  movie.generationStatus.completedAt = new Date().toISOString();
                  console.log(`Movie ${movie.id} generation marked as COMPLETE (${completedClips}/${totalScenes} scenes)`);
                } else {
                  console.log(`Movie ${movie.id} generation progress updated (${completedClips}/${totalScenes} scenes) - still IN PROGRESS`);
                }

                // Save the updated movie
                await this.saveMovie(movie);
                updatedMovieCount++;
              }
            } else {
              console.log(`Movie ${movie.id} has no generation status, cannot update`);
            }
          }
        } catch (movieError) {
          console.error(`Error processing movie ${movieMeta.id}:`, movieError);
        }
      }

      console.log(`Updated ${updatedMovieCount} movies with animation ${animationId}`);
    } catch (error) {
      console.error('Error updating movie generation status:', error);
    }
  }
}

module.exports = new StorageService();
