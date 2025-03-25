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
        console.log(`Saving animation ${id}, SVG length: ${animation.svg?.length || 0}`);

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
          } finally {
            // Always close the file handle
            await fileHandle.close();
          }

          // Move the temp file to the actual file (should be atomic on most systems)
          await fs.rename(tempFilePath, filePath);
        } catch (syncError) {
          console.error(`Error syncing animation ${id}:`, syncError);
          // Fallback to basic write if sync fails
          await fs.writeFile(filePath, jsonData, 'utf8');
        }

        // Verify the file was written correctly by reading it back
        // This ensures the file system has fully flushed the data
        try {
          const verifyData = await fs.readFile(filePath, 'utf8');
          const parsedData = JSON.parse(verifyData);

          if (!parsedData || !parsedData.svg) {
            throw new Error('Verification failed: Animation written to disk lacks SVG content');
          }
        } catch (verifyError) {
          console.error(`Failed to verify animation ${id} was properly saved:`, verifyError);
          throw new Error(`Animation save verification failed: ${verifyError.message}`);
        }
      } catch (writeError) {
        console.error(`Failed to write animation ${id} to disk:`, writeError);
        throw writeError;
      }

      return id;
    } catch (error) {
      console.error('Error saving animation:', error);
      throw error;
    }
  }

  /**
   * Get animation by ID
   * @param {string} id - Animation ID
   * @returns {Promise<Object|null>} Animation data or null if not found
   */
  async getAnimation(id) {
    if (!id) {
      console.warn('STORAGE: Cannot get animation - no ID provided');
      return null;
    }

    try {
      const filePath = path.join(ANIMATIONS_DIR, `${id}.json`);

      // Check if file exists
      try {
        await fs.access(filePath);
      } catch (err) {
        console.log(`Animation file ${id} not found, returning null`);
        return null;
      }

      // Simple approach: Read the file and parse it
      try {
        const data = await fs.readFile(filePath, 'utf8');

        const animation = JSON.parse(data);

        // Validate that we have the essential data
        if (!animation) {
          console.warn(`[ANIMATION_LOADING] Animation ${id} parsed but resulted in null/undefined value`);
          return null;
        }

        if (!animation.svg) {
          console.warn(`[ANIMATION_LOADING] Animation ${id} exists but lacks SVG content`);
          return null;
        }

        // Basic validation for SVG content
        if (typeof animation.svg !== 'string' || !animation.svg.includes('<svg')) {
          console.warn(`[ANIMATION_LOADING] Animation ${id} has invalid SVG content`);
          return null;
        }

        return animation;
      } catch (error) {
        console.error(`[ANIMATION_LOADING] Error reading/parsing animation ${id}:`, error);
        return null;
      }
    } catch (error) {
      console.error(`[ANIMATION_LOADING] Unhandled error getting animation ${id}:`, error);
      return null;
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
      const tempFilePath = `${filePath}.tmp`;

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

      // Track any issues with animation references
      const animationIssues = [];

      // Process clips to store only references to animations, not the full SVG content
      let optimizedClips = [];

      if (storyboard.clips && Array.isArray(storyboard.clips)) {
        // Before optimization, log all clips' animation IDs for debugging
        storyboard.clips.forEach((clip, index) => {
          console.log(`[MOVIE_SAVING] Clip ${index} (order ${clip.order}): animationId=${clip.animationId || 'MISSING!'}, provider=${clip.provider || 'unknown'}`);
        });

        // Validate animation references before saving to ensure integrity
        const clipValidationPromises = storyboard.clips.map(async (clip) => {
          // Skip validation for clips without animationId
          if (!clip.animationId) {
            const issue = `Clip ${clip.id} at order ${clip.order} has no animationId reference!`;
            console.warn(`[MOVIE_SAVING] Warning: ${issue}`);
            animationIssues.push(issue);
            return clip;
          }

          // Verify animation exists
          try {
            const animation = await this.getAnimation(clip.animationId);
            if (!animation) {
              const issue = `Animation ${clip.animationId} for clip ${clip.id} not found in storage`;
              console.warn(`[MOVIE_SAVING] ${issue}`);
              animationIssues.push(issue);
            } else if (!animation.svg) {
              const issue = `Animation ${clip.animationId} exists but has no SVG content`;
              console.warn(`[MOVIE_SAVING] ${issue}`);
              animationIssues.push(issue);
            } else {
              console.log(`[MOVIE_SAVING] Verified animation ${clip.animationId} exists and has valid SVG content`);
            }
          } catch (error) {
            const issue = `Error verifying animation ${clip.animationId}: ${error.message}`;
            console.error(`[MOVIE_SAVING] ${issue}`);
            animationIssues.push(issue);
          }

          return clip;
        });

        // Wait for all validation checks to complete
        await Promise.all(clipValidationPromises);

        // Log any issues found and store them with the storyboard
        if (animationIssues.length > 0) {
          console.warn(`[MOVIE_SAVING] Found ${animationIssues.length} issues with animation references`);
        }

        optimizedClips = storyboard.clips.map((clip) => {
          // Create an optimized clip object with essential properties
          const optimizedClip = {
            id: clip.id,
            name: clip.name,
            duration: clip.duration,
            order: clip.order,
            prompt: clip.prompt || '',
            // CRITICAL: Ensure animation ID is preserved regardless of other properties
            animationId: clip.animationId,
            // Store provider info to help with resumption
            provider: clip.provider
          };

          return optimizedClip;
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
          duration: scene.duration,
          provider: scene.provider // Make sure provider is preserved for resumption
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
        originalScenes: optimizedOriginalScenes,
        // Store validation results for diagnostics
        validationResults: animationIssues?.length > 0 ? {
          hasIssues: true,
          timestamp: new Date().toISOString(),
          issueCount: animationIssues.length,
          issues: animationIssues
        } : null
      };

      // Use atomic write pattern to prevent corruption:
      // 1. Write to temp file
      // 2. Flush to disk
      // 3. Rename to target file (atomic operation on most file systems)
      const storyboardJSON = JSON.stringify(optimizedStoryboard, null, 2);

      try {
        // Write to temp file
        await fs.writeFile(tempFilePath, storyboardJSON, 'utf8');

        // Try to force flush to physical storage
        const fileHandle = await fs.open(tempFilePath, 'r+');
        try {
          await fileHandle.sync();
        } finally {
          await fileHandle.close();
        }

        // Atomic rename
        await fs.rename(tempFilePath, filePath);

        // Verify the file was written correctly with a more thorough approach
        try {
          const verifyData = await fs.readFile(filePath, 'utf8');
          const parsedData = JSON.parse(verifyData);

          if (!parsedData || !parsedData.clips) {
            throw new Error('Verification failed: Movie written to disk lacks clips array');
          }

          // Verify that all clips are present, with focus on animation IDs
          const expectedClipCount = optimizedClips.length;
          const actualClipCount = parsedData.clips.length;

          if (actualClipCount !== expectedClipCount) {
            throw new Error(`Verification failed: Expected ${expectedClipCount} clips but found ${actualClipCount}`);
          }

          // Verify essential clip properties for each clip
          parsedData.clips.forEach((clip, index) => {
            if (!clip.id) {
              throw new Error(`Verification failed: Clip at index ${index} missing ID`);
            }

            // Check if we're supposed to have an animation ID
            const originalClip = optimizedClips.find(c => c.id === clip.id);
            if (originalClip?.animationId && !clip.animationId) {
              throw new Error(`Verification failed: Clip ${clip.id} lost its animation ID during storage`);
            }
          });

          console.log(`[MOVIE_SAVING] Successfully verified movie ${id} file integrity with all ${actualClipCount} clips preserved`);
        } catch (verifyError) {
          console.error(`[MOVIE_SAVING] Failed to verify movie ${id} was properly saved:`, verifyError);
          throw verifyError; // Re-throw to trigger fallback save
        }
      } catch (writeError) {
        console.error(`[MOVIE_SAVING] Error during atomic write for movie ${id}:`, writeError);

        // Fall back to direct write with extra precautions
        console.log(`[MOVIE_SAVING] Using fallback direct write for movie ${id}`);

        // Create a backup of the existing file if it exists
        try {
          const backupPath = `${filePath}.bak`;
          await fs.access(filePath);
          await fs.copyFile(filePath, backupPath);
          console.log(`[MOVIE_SAVING] Created backup of existing file at ${backupPath}`);
        } catch (backupError) {
          // If the file doesn't exist, no need for backup
          if (backupError.code !== 'ENOENT') {
            console.error(`[MOVIE_SAVING] Error creating backup:`, backupError);
          }
        }

        // Fallback write directly to the file
        await fs.writeFile(filePath, storyboardJSON);
      }

      console.log(`[MOVIE_SAVING] Saved movie ${id} with ${optimizedClips.length} clips`);

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
        console.log(`Movie file ${id} not found, returning null`);
        return null;
      }

      // Simple direct read approach
      try {
        const data = await fs.readFile(filePath, 'utf8');
        const movie = JSON.parse(data);

        return movie;
      } catch (error) {
        console.error(`Error reading or parsing movie file ${id}:`, error);
        return null;
      }
    } catch (error) {
      console.error(`Unhandled error getting movie ${id}:`, error);
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
