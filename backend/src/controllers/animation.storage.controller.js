const storageService = require('../services/storage.service');
const { BadRequestError, NotFoundError } = require('../utils/errors');
const { v4: uuidv4 } = require('uuid');

/**
 * Animation storage controller
 */
const animationStorageController = {
  /**
   * Save animation
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async saveAnimation(req, res, next) {
    try {
      const { name, svg, chatHistory, id, provider } = req.body;

      if (!name || !svg) {
        throw new BadRequestError('Animation name and SVG content are required');
      }

      const timestamp = new Date().toISOString();
      const animationId = await storageService.saveAnimation({
        id: id || uuidv4(),
        name,
        svg,
        chatHistory,
        provider,
        timestamp
      });

      res.status(200).json({
        success: true,
        id: animationId,
        message: `Animation '${name}' saved successfully`
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Get animation by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async getAnimation(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new BadRequestError('Animation ID is required');
      }

      const animation = await storageService.getAnimation(id);

      if (!animation) {
        throw new NotFoundError(`Animation with ID ${id} not found`);
      }

      // Add debug logging to check if provider field exists
      console.log(`[CONTROLLER] Animation ${id} data from storage:`, {
        hasProvider: !!animation.provider,
        provider: animation.provider,
        dataKeys: Object.keys(animation)
      });

      res.status(200).json({
        success: true,
        animation
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * List all animations
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async listAnimations(req, res, next) {
    try {
      const animations = await storageService.listAnimations();

      res.status(200).json({
        success: true,
        animations
      });
    } catch (error) {
      next(error);
    }
  },

  /**
   * Delete animation by ID
   * @param {Object} req - Express request object
   * @param {Object} res - Express response object
   * @param {Function} next - Express next middleware function
   */
  async deleteAnimation(req, res, next) {
    try {
      const { id } = req.params;

      if (!id) {
        throw new BadRequestError('Animation ID is required');
      }

      const result = await storageService.deleteAnimation(id);

      if (!result) {
        throw new NotFoundError(`Animation with ID ${id} not found or could not be deleted`);
      }

      res.status(200).json({
        success: true,
        message: `Animation with ID ${id} deleted successfully`
      });
    } catch (error) {
      next(error);
    }
  }
};

module.exports = animationStorageController;
