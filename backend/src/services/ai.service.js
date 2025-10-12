const openAIService = require('./openai.service');
const anthropicService = require('./claude.service');
const googleService = require('./gemini.service');
const rateLimiter = require('./unified-rate-limiter.service');
const config = require('../config');
const { ServiceUnavailableError } = require('../utils/errors');
const { normalizeProvider, resolveModelId, modelSupportsTemperature } = require('../utils/provider-utils');

const SERVICES = {
  openai: {
    name: 'OpenAI',
    service: openAIService,
    getConfig: () => config.openai
  },
  anthropic: {
    name: 'Anthropic Claude',
    service: anthropicService,
    getConfig: () => config.anthropic
  },
  google: {
    name: 'Google Gemini',
    service: googleService,
    getConfig: () => config.google
  }
};

const resolveProvider = (overrideProvider) => {
  const normalizedOverride = normalizeProvider(overrideProvider);
  return normalizedOverride || config.aiProvider || 'openai';
};

const ensureProviderConfigured = (providerKey) => {
  const providerEntry = SERVICES[providerKey];

  if (!providerEntry) {
    throw new ServiceUnavailableError(`Unknown AI provider: ${providerKey}`);
  }

  const providerConfig = providerEntry.getConfig();

  if (!providerConfig || !providerConfig.apiKey) {
    throw new ServiceUnavailableError(`${providerEntry.name} API key is not configured`);
  }

  return {
    providerEntry,
    providerConfig
  };
};

const buildRequestOptions = (providerKey, providerConfig, overrides = {}) => {
  const model = resolveModelId(providerKey, overrides.model || providerConfig.model);
  const hasTemperatureOverride = Object.prototype.hasOwnProperty.call(overrides, 'temperature');
  const temperatureSource = hasTemperatureOverride ? overrides.temperature : providerConfig.temperature;
  const supportsTemperature = modelSupportsTemperature(providerKey, model);
  const normalizedTemperature = supportsTemperature ? temperatureSource : null;

  return {
    ...overrides,
    provider: providerKey,
    model,
    temperature: normalizedTemperature
  };
};

const executeWithRateLimiting = async (providerKey, fn, args = []) => {
  return rateLimiter.executeRequest(fn, args, providerKey);
};

const AIService = {
  /**
   * Generate animation with rate limiting and provider overrides.
   * @param {string} prompt
   * @param {Object} [options]
   * @param {string} [options.provider]
   * @param {string} [options.model]
   * @returns {Promise<string|Object>}
   */
  async generateAnimation(prompt, options = {}) {
    const providerKey = resolveProvider(options.provider);
    const { providerEntry, providerConfig } = ensureProviderConfigured(providerKey);
    const requestOptions = buildRequestOptions(providerKey, providerConfig, options);

    return executeWithRateLimiting(
      providerKey,
      providerEntry.service.generateAnimation.bind(providerEntry.service),
      [prompt, requestOptions]
    );
  },

  /**
   * Update animation with rate limiting and provider overrides.
   * @param {string} prompt
   * @param {string} currentSvg
   * @param {Object} [options]
   * @returns {Promise<string|Object>}
   */
  async updateAnimation(prompt, currentSvg, options = {}) {
    const providerKey = resolveProvider(options.provider);
    const { providerEntry, providerConfig } = ensureProviderConfigured(providerKey);
    const requestOptions = buildRequestOptions(providerKey, providerConfig, options);

    return executeWithRateLimiting(
      providerKey,
      providerEntry.service.updateAnimation.bind(providerEntry.service),
      [prompt, currentSvg, requestOptions]
    );
  },

  /**
   * Generate raw response for storyboard or JSON-only flows.
   * @param {string} prompt
   * @param {Object} [options]
   * @returns {Promise<string>}
   */
  async generateRawResponse(prompt, options = {}) {
    const providerKey = resolveProvider(options.provider);
    const { providerEntry, providerConfig } = ensureProviderConfigured(providerKey);
    const requestOptions = buildRequestOptions(providerKey, providerConfig, options);

    try {
      if (typeof providerEntry.service.generateRawResponse === 'function') {
        const rawResponse = await providerEntry.service.generateRawResponse(prompt, requestOptions);

        if (!rawResponse || typeof rawResponse !== 'string') {
          console.error(`Error: ${providerEntry.name} returned invalid response type:`, typeof rawResponse);
          throw new ServiceUnavailableError('AI service returned an invalid response format');
        }

        if (rawResponse.includes('<svg') || rawResponse.includes('</svg>')) {
          console.error(`Error: ${providerEntry.name} returned SVG content when JSON was expected`);
          throw new ServiceUnavailableError('Received SVG content instead of JSON. Please try again.');
        }

        return rawResponse;
      }

      const response = await providerEntry.service.generateAnimation(prompt, requestOptions);

      if (typeof response === 'string') {
        return response;
      }

      if (response && response.explanation) {
        return response.explanation;
      }

      if (response && response.message) {
        return response.message;
      }

      return JSON.stringify(response);
    } catch (error) {
      console.error(`Error generating raw response with ${providerEntry.name}:`, error);
      throw error;
    }
  },

  /**
   * Get rate limiter status
   * @returns {Object}
   */
  getRateLimiterStatus() {
    return rateLimiter.getStatus();
  }
};

module.exports = AIService;
