const storageService = require('../services/storage.service');
const { BadRequestError, NotFoundError } = require('../utils/errors');

/**
 * Movie storage controller
 */
const movieStorageController = {
  /**
   * Save movie/storyboard
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async saveMovie(req, res, next) {
    try {
      const storyboard = req.body;

      if (!storyboard) {
        throw new BadRequestError('Storyboard data is required');
      }

      const movieId = await storageService.saveMovie(storyboard);

      // Fetch the saved movie to return it in the response
      const savedMovie = await storageService.getMovie(movieId);

      res.status(200).json({
        success: true,
        id: movieId,
        movie: savedMovie,
        message: `Storyboard '${storyboard.name}' saved successfully`
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get movie/storyboard by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getMovie(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new BadRequestError('Movie ID is required');
      }

      const movie = await storageService.getMovie(id);

      if (!movie) {
        throw new NotFoundError(`Movie with ID ${id} not found`);
      }

      // Add detailed logging about clip animation references
      if (movie.clips && Array.isArray(movie.clips)) {
        console.log(`[MOVIE_LOADING_DEBUG] Retrieved movie ${id} with ${movie.clips.length} clips`);
        
        // Log all clip orders and animation references
        movie.clips.forEach((clip, index) => {
          console.log(`[MOVIE_LOADING_DEBUG] Clip ${index+1}/${movie.clips.length}: id=${clip.id}, order=${clip.order}, animationId=${clip.animationId || 'MISSING'}`);
          
          // If a clip is missing animationId, this is likely a bug
          if (!clip.animationId) {
            console.warn(`[MOVIE_LOADING_WARNING] Clip ${clip.id} at order ${clip.order} has no animationId reference!`);
          }
        });
      } else {
        console.warn(`[MOVIE_LOADING_WARNING] Movie ${id} has no clips or clips is not an array`);
      }

      res.status(200).json({
        success: true,
        movie
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List all movies/storyboards
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async listMovies(req, res, next) {
    try {
      const movies = await storageService.listMovies();

      res.status(200).json({
        success: true,
        movies
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete movie/storyboard by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteMovie(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new BadRequestError('Movie ID is required');
      }

      const result = await storageService.deleteMovie(id);

      if (!result) {
        throw new NotFoundError(`Movie with ID ${id} not found or could not be deleted`);
      }

      res.status(200).json({
        success: true,
        message: `Movie with ID ${id} deleted successfully`
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get animation data for a clip by animation ID
   * This allows the frontend to fetch the full animation data when needed
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getClipAnimation(req, res, next) {
    try {
      const { animationId } = req.params;

      if (!animationId) {
        throw new BadRequestError('Animation ID is required');
      }

      // First check if the animation exists and is accessible
      try {
        const animation = await storageService.getAnimation(animationId);

        if (!animation) {
          throw new NotFoundError(`Animation with ID ${animationId} not found`);
        }

        if (!animation.svg) {
          throw new Error(`Animation with ID ${animationId} exists but has no SVG content`);
        }

        // If we got this far, the animation is fully saved and accessible
        return res.status(200).json({
          success: true,
          animation
        });
      } catch (error) {
        // Improve error messaging based on error type
        if (error.message && error.message.includes('not found')) {
          console.warn(`Animation ${animationId} was requested but not found - might still be generating`);
          throw new NotFoundError(`Animation with ID ${animationId} not found or is still being created`);
        } else {
          console.error(`Error retrieving animation ${animationId}:`, error);
          throw error;
        }
      }
    } catch (error) {
      next(error);
    }
  }
};

module.exports = movieStorageController;
