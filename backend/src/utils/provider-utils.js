const path = require('path');

// Load the shared AI provider registry so frontend and backend stay in sync
const providerRegistry = require(path.join(__dirname, '../../../shared/ai-providers.json'));

// Map legacy or shorthand values to canonical provider IDs
const PROVIDER_ALIASES = {
  openai: 'openai',
  'open-ai': 'openai',
  gpt: 'openai',
  claude: 'anthropic',
  anthropic: 'anthropic',
  'anthropic-claude': 'anthropic',
  gemini: 'google',
  google: 'google',
  'google-gemini': 'google'
};

/**
 * Convert an incoming provider string to the canonical provider ID
 * @param {string|null|undefined} provider
 * @returns {string|null}
 */
function normalizeProvider(provider) {
  if (typeof provider !== 'string') {
    return null;
  }

  const key = provider.trim().toLowerCase();
  return PROVIDER_ALIASES[key] || null;
}

/**
 * Resolve a provider to its metadata entry
 * @param {string} provider
 * @returns {object|null}
 */
function getProviderMetadata(provider) {
  const normalized = normalizeProvider(provider);
  if (!normalized) {
    return null;
  }

  return providerRegistry[normalized] || null;
}

/**
 * Return the default model ID for a provider
 * @param {string} provider
 * @returns {string|null}
 */
function getDefaultModel(provider) {
  const metadata = getProviderMetadata(provider);
  return metadata?.defaultModel || null;
}

/**
 * Determine if a model supports temperature tuning.
 * Defaults to true when not specified.
 * Handles versioned models by checking if modelId starts with a known base model ID.
 * @param {string} provider
 * @param {string} modelId
 * @returns {boolean}
 */
function modelSupportsTemperature(provider, modelId) {
  const metadata = getProviderMetadata(provider);
  if (!metadata) {
    // For OpenAI, auto-detect GPT-5 and O1 models that don't support temperature
    if (provider === 'openai') {
      const id = modelId.toLowerCase();
      if (id.startsWith('gpt-5') || id.startsWith('o1')) {
        return false;
      }
    }
    return true;
  }

  // Try exact match first
  let model = metadata.models?.find(entry => entry.id === modelId);

  // If no exact match, try to find a model whose ID is a prefix of the requested model
  // This handles versioned models like "gpt-5-2025-08-07" matching "gpt-5"
  if (!model) {
    model = metadata.models?.find(entry => {
      const baseId = entry.id.replace('-latest', '');
      return modelId.startsWith(baseId + '-') || modelId === baseId;
    });
  }

  if (!model) {
    // Model not in registry - for OpenAI, auto-detect GPT-5 and O1
    if (provider === 'openai') {
      const id = modelId.toLowerCase();
      if (id.startsWith('gpt-5') || id.startsWith('o1')) {
        return false;
      }
    }
    return true; // Default to supporting temperature for unknown models
  }

  // If explicitly set in metadata, use that value
  if (typeof model.supportsTemperature === 'boolean') {
    return model.supportsTemperature;
  }

  // Default to true if not specified
  return true;
}

/**
 * Get the maximum output tokens for a model.
 * Returns null if not specified (meaning use provider default).
 * Also handles versioned model IDs by checking if they start with a known model ID.
 * @param {string} provider
 * @param {string} modelId
 * @returns {number|null}
 */
function getMaxOutputTokens(provider, modelId) {
  const metadata = getProviderMetadata(provider);
  if (!metadata || !metadata.models) {
    return null;
  }

  // First try exact match
  let model = metadata.models.find(entry => entry.id === modelId);

  // If no exact match, try to find a model whose ID is a prefix of the requested model
  // This handles cases like "claude-3-5-haiku-20241022" matching "claude-3-5-haiku-latest"
  if (!model) {
    model = metadata.models.find(entry => {
      // Check if the modelId starts with the registry ID (removing -latest suffix)
      const baseId = entry.id.replace('-latest', '');
      return modelId.startsWith(baseId);
    });
  }

  if (!model || typeof model.maxOutputTokens === 'undefined') {
    return null;
  }

  return model.maxOutputTokens;
}

/**
 * Resolve a model ID for a provider, falling back to defaults when needed.
 * Unknown models are allowed so that experimental IDs can be configured,
 * but when no model is provided we always return the recommended default.
 *
 * @param {string} provider
 * @param {string|undefined|null} requestedModel
 * @returns {string|null}
 */
function resolveModelId(provider, requestedModel) {
  if (requestedModel && typeof requestedModel === 'string') {
    return requestedModel;
  }

  return getDefaultModel(provider);
}

/**
 * Return provider metadata safe for exposing to the frontend.
 * @returns {Array<{id:string,displayName:string,description?:string,defaultModel:string,models:Array<{id:string,label:string,useCase?:string}>}>}
 */
function getPublicProviderInfo() {
  return Object.values(providerRegistry).map(provider => ({
    id: provider.id,
    displayName: provider.displayName,
    description: provider.description,
    defaultModel: provider.defaultModel,
    models: provider.models.map(model => ({
      id: model.id,
      label: model.label,
      useCase: model.useCase,
      supportsTemperature: typeof model.supportsTemperature === 'boolean'
        ? model.supportsTemperature
        : undefined
    }))
  }));
}

module.exports = {
  providerRegistry,
  PROVIDER_ALIASES,
  normalizeProvider,
  getProviderMetadata,
  getDefaultModel,
  resolveModelId,
  modelSupportsTemperature,
  getMaxOutputTokens,
  getPublicProviderInfo
};
