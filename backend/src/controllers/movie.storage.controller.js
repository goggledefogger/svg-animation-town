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

      console.log(`CONTROLLER: Received storyboard with ID ${storyboard.id} and name '${storyboard.name}'`);
      console.log(`CONTROLLER: Storyboard has ${storyboard.clips?.length || 0} clips`);

      // Log clip information if available
      if (storyboard.clips && Array.isArray(storyboard.clips)) {
        const clipsWithAnimationIds = storyboard.clips.filter(clip => clip.animationId);
        console.log(`CONTROLLER: Found ${clipsWithAnimationIds.length} clips with animation IDs`);

        if (clipsWithAnimationIds.length > 0) {
          console.log(`CONTROLLER: Animation IDs:`, clipsWithAnimationIds.map(clip => clip.animationId));
        }
      }

      const movieId = await storageService.saveMovie(storyboard);

      res.status(200).json({
        success: true,
        id: movieId,
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

      console.log(`CONTROLLER: Fetching animation data for clip with animation ID: ${animationId}`);

      const animation = await storageService.getAnimationForClip(animationId);

      if (!animation) {
        throw new NotFoundError(`Animation with ID ${animationId} not found`);
      }

      res.status(200).json({
        success: true,
        animation
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = movieStorageController;
