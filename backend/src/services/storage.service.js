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
   * @param {Object} animation - Animation object containing id, name, svg content and optional chat history
   * @returns {Promise<string>} The ID of the saved animation
   */
  async saveAnimation(animation) {
    try {
      if (!animation) {
        throw new Error('Animation object is required');
      }
      
      // Ensure animation has an ID
      const id = animation.id || uuidv4();
      const filename = `${id}.json`;
      const filePath = path.join(ANIMATIONS_DIR, filename);

      // Create standardized animation data
      const animationData = {
        id,
        name: animation.name || 'Untitled Animation',
        svg: animation.svg,
        chatHistory: animation.chatHistory || [],
        provider: animation.provider,
        timestamp: animation.createdAt || new Date().toISOString()
      };

      // Ensure storage directory exists
      await this._ensureDirectoryExists(ANIMATIONS_DIR);

      // Write the file with error handling
      try {
        // Log the start of the save operation
        console.log(`[STORAGE SAVE] Starting save of animation ${id}, SVG length: ${animation.svg?.length || 0}`);
        
        // Use a more reliable write approach with fsync to ensure file is written to disk
        // First, write to a temporary file
        const tempFilePath = `${filePath}.tmp`;
        const jsonData = JSON.stringify(animationData, null, 2);
        
        // Write to temp file
        await fs.writeFile(tempFilePath, jsonData, 'utf8');
        
        try {
          // Get a file handle for the temp file to use fsync
          const fileHandle = await fs.open(tempFilePath, 'r+');
          
          try {
            // Force data to be flushed to the physical storage device
            await fileHandle.sync();
            console.log(`[STORAGE SAVE] Successfully synced animation data for ${id} to disk`);
          } finally {
            // Always close the file handle
            await fileHandle.close();
          }
          
          // Move the temp file to the actual file (should be atomic on most systems)
          await fs.rename(tempFilePath, filePath);
          
          console.log(`[STORAGE SAVE] Successfully moved temp file to final location for ${id}`);
        } catch (syncError) {
          console.error(`[STORAGE SAVE] Error syncing animation ${id}:`, syncError);
          // Fallback to basic write if sync fails
          await fs.writeFile(filePath, jsonData, 'utf8');
          console.log(`[STORAGE SAVE] Fallback write completed for ${id}`);
        }
        
        // Verify the file was written correctly by reading it back
        // This ensures the file system has fully flushed the data
        try {
          const verifyData = await fs.readFile(filePath, 'utf8');
          const parsedData = JSON.parse(verifyData);
          
          if (!parsedData || !parsedData.svg) {
            throw new Error('Verification failed: Animation written to disk lacks SVG content');
          }
          
          console.log(`[STORAGE SAVE] Animation ${id} successfully written and verified on disk`);
        } catch (verifyError) {
          console.error(`[STORAGE SAVE] Failed to verify animation ${id} was properly saved:`, verifyError);
          throw new Error(`Animation save verification failed: ${verifyError.message}`);
        }
      } catch (writeError) {
        console.error(`[STORAGE SAVE] Failed to write animation ${id} to disk:`, writeError);
        throw writeError;
      }
      
      return id;
    } catch (error) {
      console.error('[STORAGE SAVE] Error saving animation:', error);
      throw error;
    }
  }

  /**
   * Get animation by ID
   * @param {string} id - Animation ID
   * @returns {Promise<Object>} Animation data
   */
  async getAnimation(id) {
    if (!id) {
      throw new Error('Animation ID is required');
    }
    
    const requestTime = new Date().toISOString();
    console.log(`[STORAGE] ${requestTime}: Attempting to retrieve animation ${id}`);
    
    try {
      const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);
      
      // Check if file exists first
      try {
        const fileStats = await fs.stat(filePath);
        console.log(`[STORAGE] ${requestTime}: Animation file for ${id} exists: ${JSON.stringify({
          size: fileStats.size,
          created: fileStats.birthtime,
          modified: fileStats.mtime,
          accessTime: fileStats.atime,
          isFile: fileStats.isFile()
        })}`);
      } catch (accessError) {
        console.error(`[STORAGE] ${requestTime}: Animation file for ID ${id} does not exist or is not accessible: ${accessError.message}`);
        throw new Error(`Animation with ID ${id} not found`);
      }
      
      try {
        console.log(`[STORAGE] ${requestTime}: Reading file for animation ${id}`);
        const data = await fs.readFile(filePath, 'utf8');
        
        try {
          const animation = JSON.parse(data);
          
          // Validate animation data
          if (!animation) {
            console.error(`[STORAGE] ${requestTime}: Animation ${id} parsed but is null/undefined`);
            throw new Error(`Animation ${id} exists but has invalid content (null/undefined)`);
          }
          
          if (!animation.svg) {
            console.error(`[STORAGE] ${requestTime}: Animation ${id} exists but has no SVG content, keys: ${Object.keys(animation).join(', ')}`);
            throw new Error(`Animation ${id} exists but has no SVG content`);
          }
          
          console.log(`[STORAGE] ${requestTime}: Successfully retrieved animation ${id}, SVG length: ${animation.svg.length}`);
          return animation;
        } catch (parseError) {
          console.error(`[STORAGE] ${requestTime}: Failed to parse JSON for animation ${id}: ${parseError.message}`);
          throw parseError instanceof SyntaxError 
            ? new Error(`Animation ${id} contains invalid JSON: ${parseError.message}`)
            : parseError;
        }
      } catch (readError) {
        console.error(`[STORAGE] ${requestTime}: Error reading animation file ${id}: ${readError.message}`);
        throw readError;
      }
    } catch (error) {
      console.error(`[STORAGE] ${requestTime}: Error getting animation ${id}: ${error.message}`);
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
      const validMovies = movies.filter(Boolean);

      // Sort by updatedAt in descending order (newest first)
      validMovies.sort((a, b) => {
        const dateA = new Date(a.updatedAt);
        const dateB = new Date(b.updatedAt);
        return dateB - dateA; // Descending order (newest first)
      });

      return validMovies;
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
