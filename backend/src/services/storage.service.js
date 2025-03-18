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
      console.log('Storage: Listing all animation files from directory:', ANIMATIONS_DIR);

      // Check if directory exists
      try {
        await fs.access(ANIMATIONS_DIR);
      } catch (err) {
        console.error('Storage: Animations directory does not exist or is not accessible:', err);
        await this._ensureDirectoryExists(ANIMATIONS_DIR);
        console.log('Storage: Created animations directory');
        return []; // Return empty array if directory was just created
      }

      const files = await fs.readdir(ANIMATIONS_DIR);
      console.log(`Storage: Found ${files.length} files in animations directory`);

      const jsonFiles = files.filter(file => file.endsWith('.json'));
      console.log(`Storage: Found ${jsonFiles.length} JSON files in animations directory`);

      const animations = await Promise.all(
        jsonFiles.map(async file => {
          try {
            const filePath = path.join(ANIMATIONS_DIR, file);
            console.log(`Storage: Reading animation file: ${file}`);

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
      const validAnimations = animations.filter(Boolean);
      console.log(`Storage: Returning ${validAnimations.length} valid animations`);

      return validAnimations;
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
      console.log(`STORAGE: saveMovie called with storyboard ID: ${storyboard.id}`);
      console.log(`STORAGE: Storyboard has ${storyboard.clips?.length || 0} clips`);

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
      }

      // Process clips to store only references to animations, not the full SVG content
      let optimizedClips = [];

      if (storyboard.clips && Array.isArray(storyboard.clips)) {
        console.log(`STORAGE: Processing ${storyboard.clips.length} clips`);

        optimizedClips = storyboard.clips.map((clip, index) => {
          // Create an optimized clip object that doesn't include the SVG content
          const optimizedClip = {
            id: clip.id,
            name: clip.name,
            duration: clip.duration,
            order: clip.order,
            prompt: clip.prompt || '',
            animationId: clip.animationId // The key reference to the animation
          };

          // Log optimization
          if (clip.svgContent) {
            console.log(`STORAGE: Optimized clip ${index} by removing SVG content (${clip.svgContent.length} bytes)`);
          }

          // Log animation ID if present
          if (clip.animationId) {
            console.log(`STORAGE: Clip ${index} references animation ID: ${clip.animationId}`);
          } else {
            console.warn(`STORAGE: Clip ${index} has no animation ID reference`);
          }

          return optimizedClip;
        });
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
        generationStatus
      };

      // Check final data before writing
      const clipsWithAnimationIds = optimizedClips.filter(clip => clip.animationId);
      console.log(`STORAGE: Optimized movie JSON with ${clipsWithAnimationIds.length} animation references`);

      // Write the file
      const storyboardJSON = JSON.stringify(optimizedStoryboard, null, 2);
      await fs.writeFile(filePath, storyboardJSON);

      console.log(`STORAGE: Saved optimized storyboard to ${filename}`);
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
      console.log(`STORAGE: Getting movie with ID: ${id}`);
      const filePath = path.join(MOVIES_DIR, `${id}.json`);

      // Check if file exists first
      try {
        await fs.access(filePath);
      } catch (err) {
        console.log(`STORAGE: Movie with ID ${id} not found`);
        return null;
      }

      // Read and parse the movie data
      const movieData = await fs.readFile(filePath, 'utf8');
      const movie = JSON.parse(movieData);

      // Log the structure for debugging
      console.log(`STORAGE: Loaded movie ${movie.name} with ${movie.clips?.length || 0} clips`);

      // With optimized storage, clips don't contain SVG content by default
      return movie;
    } catch (error) {
      console.error(`STORAGE: Error getting movie ${id}:`, error);
      throw error;
    }
  }

  /**
   * List all movies/storyboards
   * @returns {Promise<Array>} List of movie metadata
   */
  async listMovies() {
    try {
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
              description: movie.description,
              clipCount: movie.clips?.length || 0,
              updatedAt: movie.updatedAt
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
}

module.exports = new StorageService();
