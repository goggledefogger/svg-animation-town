const openai = require('./shared-openai-client');
const anthropic = require('./shared-claude-client');
const config = require('../config');
const { getProviderMetadata } = require('../utils/provider-utils');

/**
 * Model Fetcher Service
 *
 * Fetches available models from OpenAI, Anthropic, and Google APIs dynamically.
 * Uses a hybrid approach: starts with known-good models from JSON, then adds new
 * API models that pass capability-based filtering.
 *
 * Filtering Strategy (Conservative):
 * - OpenAI: Only includes models matching known patterns (gpt-4*, gpt-5*, o1*)
 *           Excludes: embeddings, TTS, Whisper, DALL-E, moderation, fine-tuned
 *           Note: OpenAI API doesn't provide capability fields, so we rely on
 *           name patterns. This is conservative to avoid including unsuitable models.
 * - Anthropic: Requires type === 'model' AND id includes 'claude'
 *              All Claude models are chat/completion models, so this is reliable
 * - Google: Requires 'generateContent' in supportedGenerationMethods AND
 *           reasonable token limits (8K+ input or 8K+ output) AND
 *           id includes 'gemini'
 *           This uses actual API capabilities, so it's more reliable
 *
 * New models that match these criteria will automatically appear, but we're
 * conservative to avoid including models that might not work well for SVG generation.
 */

// Cache configuration
const CACHE_TTL = 60 * 60 * 1000; // 1 hour in milliseconds
const cache = {
  openai: { data: null, timestamp: 0 },
  anthropic: { data: null, timestamp: 0 },
  google: { data: null, timestamp: 0 }
};

/**
 * Check if cached data is still valid
 */
function isCacheValid(provider) {
  const cached = cache[provider];
  if (!cached || !cached.data) {
    return false;
  }
  return Date.now() - cached.timestamp < CACHE_TTL;
}

/**
 * Determine if an OpenAI model is suitable for SVG animation generation
 *
 * Conservative approach: Only include models matching known patterns.
 * OpenAI API doesn't provide capability metadata, so we must rely on
 * name patterns. We're conservative to avoid including unsuitable models.
 */
function isOpenAIModelSuitable(model) {
  const id = model.id.toLowerCase();

  // First, exclude obvious non-chat models
  if (id.includes('embedding') ||
      id.includes('embed-') ||
      id.includes('whisper') ||
      id.includes('tts') ||
      id.includes('dall-e') ||
      id.includes('moderation') ||
      id.includes('fine-tune') ||
      id.includes('ft:') || // Fine-tuned models (format: ft:gpt-4o-2024-08-06:org:model)
      id.includes(':ft') || // Fine-tuned models (alternative format)
      id.startsWith('ft-') || // Fine-tuned models (alternative format)
      id.includes('-audio-') || // Audio-specific models (not general chat)
      id.includes('-realtime-') || // Realtime-specific models (not general chat)
      id.includes('-transcribe') || // Transcription models (not general chat)
      id.includes('-search-') || // Search-specific models (not general chat)
      id.includes('-diarize')) { // Diarization models (not general chat)
    return false;
  }

  // Only include models matching known chat/completion model patterns
  // This is conservative - we only include models we're confident about

  // GPT-4 family (including all variants like gpt-4o, gpt-4-turbo, etc.)
  if (id.startsWith('gpt-4')) {
    return true;
  }

  // GPT-5 family
  if (id.startsWith('gpt-5')) {
    return true;
  }

  // O1 reasoning models (o1, o1-mini, o1-preview, etc.)
  if (id.startsWith('o1')) {
    return true;
  }

  // GPT-3.5 for backwards compatibility
  if (id.startsWith('gpt-3.5')) {
    return true;
  }

  // Default: exclude unknown models
  // We don't include other GPT variants unless they match above patterns
  // This prevents including experimental or specialized models
  return false;
}

/**
 * Extract the canonical base name from an OpenAI model ID
 * Handles patterns like:
 * - gpt-4o-2024-05-13 -> gpt-4o
 * - gpt-4o-mini-2024-07-18 -> gpt-4o-mini (keep -mini, it's part of the model name)
 * - gpt-4o-preview -> gpt-4o
 * - gpt-4-0613 -> gpt-4 (handles 4-digit MMDD dates)
 * - gpt-4-1106-preview -> gpt-4
 * - gpt-3.5-turbo-instruct-0914 -> gpt-3.5-turbo-instruct (keep -instruct, it's a variant)
 * - o1-2024-09-12 -> o1
 */
function getOpenAIModelBaseName(id) {
  // Remove full date patterns: -YYYY-MM-DD at the end
  let base = id.replace(/-\d{4}-\d{2}-\d{2}$/, ''); // -2024-05-13

  // Remove short date patterns: -MMDD (4 digits) at the end, but only if preceded by model name
  // This handles: gpt-4-0613, gpt-4-1106, gpt-3.5-turbo-instruct-0914
  base = base.replace(/-\d{4}$/, ''); // -0613, -1106, -0914

  // Remove common suffixes that indicate previews/betas (but keep model variants like -mini, -instruct)
  base = base.replace(/-preview$/, '');
  base = base.replace(/-beta$/, '');
  base = base.replace(/-alpha$/, '');

  // Note: We keep -mini, -instruct, -turbo, -audio, -realtime as they're part of the model name
  // e.g., gpt-4o-mini is different from gpt-4o

  return base;
}

/**
 * Deduplicate OpenAI models by filtering out dated versions when base model exists
 * Strategy:
 * 1. Remove exact duplicates by ID
 * 2. Filter out dated versions (e.g., "gpt-5-2025-08-07") if base model exists (e.g., "gpt-5")
 * 3. Then deduplicate by label - if multiple models have the same label, keep only one
 *
 * This ensures we don't strip model IDs but filter out redundant dated versions
 */
function deduplicateOpenAIModels(models) {
  // Remove exact duplicates by ID first
  const seenIds = new Set();
  const uniqueById = models.filter(model => {
    if (seenIds.has(model.id)) return false;
    seenIds.add(model.id);
    return true;
  });

  // Build a set of all model IDs for quick lookup
  const allModelIds = new Set(uniqueById.map(m => m.id));

  // Filter out dated versions when base model exists
  // A dated version matches pattern: baseId-YYYY-MM-DD or baseId-YYYYMMDD
  const filtered = uniqueById.filter(model => {
    const id = model.id;

    // Check if this is a dated version (ends with -YYYY-MM-DD or -YYYYMMDD)
    const dateMatch = id.match(/^(.+?)(-\d{4}-\d{2}-\d{2}|-\d{8})$/);
    if (dateMatch) {
      const baseId = dateMatch[1];
      // If base model exists, filter out this dated version
      if (allModelIds.has(baseId)) {
        return false; // Filter out dated version
      }
    }
    return true; // Keep this model
  });

  // Then deduplicate by label - if multiple models have the same label, keep only one
  const labelMap = new Map();
  filtered.forEach(model => {
    const label = model.label || model.id;
    const existing = labelMap.get(label);

    if (!existing) {
      labelMap.set(label, model);
    } else {
      // Decide which one to keep - prefer:
      // 1. Exact metadata match (has useCase or other metadata)
      // 2. Shorter ID (base model like "gpt-5" vs "gpt-5-chat-latest")
      // 3. Newest by created timestamp
      const aHasMeta = !!(model.useCase || model.maxOutputTokens !== undefined);
      const bHasMeta = !!(existing.useCase || existing.maxOutputTokens !== undefined);

      if (aHasMeta && !bHasMeta) {
        labelMap.set(label, model);
      } else if (!aHasMeta && bHasMeta) {
        // Keep existing
      } else {
        // Both have meta or both don't - prefer shorter ID, then newest
        if (model.id.length < existing.id.length) {
          labelMap.set(label, model);
        } else if (model.id.length > existing.id.length) {
          // Keep existing
        } else {
          // Same length - prefer newest by created timestamp
          const createdA = model.created || 0;
          const createdB = existing.created || 0;
          if (createdA > createdB) {
            labelMap.set(label, model);
          }
        }
      }
    }
  });

  return Array.from(labelMap.values());
}

/**
 * Fetch available models from OpenAI API
 */
async function fetchOpenAIModels() {
  if (!config.openai.apiKey) {
    console.log('[Model Fetcher] OpenAI API key not configured, skipping fetch');
    return null;
  }

  try {
    const response = await openai.models.list();
    const models = response.data || [];

    const filtered = models
      .map(model => ({
        id: model.id,
        label: model.id, // OpenAI doesn't provide display names, use ID as label
        created: model.created,
        ownedBy: model.owned_by
      }))
      .filter(isOpenAIModelSuitable);

    // Deduplicate versioned models
    const deduplicated = deduplicateOpenAIModels(filtered);

    console.log(`[Model Fetcher] OpenAI: ${deduplicated.length} unique models (${filtered.length} before deduplication, ${models.length} total)`);
    return deduplicated;
  } catch (error) {
    console.error('[Model Fetcher] Error fetching OpenAI models:', error.message);
    return null;
  }
}

/**
 * Determine if an Anthropic model is suitable for SVG animation generation
 *
 * Reliable approach: Uses API-provided 'type' field and model ID pattern.
 * All Claude models are chat/completion models, so this is reliable.
 */
function isAnthropicModelSuitable(model) {
  const id = model.id.toLowerCase();
  const type = (model.type || '').toLowerCase();

  // Must be a model type (not other object types)
  if (type !== 'model') {
    return false;
  }

  // Must be a Claude model (all Claude models are chat/completion models)
  // This is reliable because Anthropic only makes Claude models for chat
  if (id.includes('claude')) {
    return true;
  }

  // Default: exclude unknown models
  // Anthropic only makes Claude models, so anything else is unexpected
  return false;
}

/**
 * Fetch available models from Anthropic API
 */
async function fetchAnthropicModels() {
  if (!config.anthropic.apiKey) {
    console.log('[Model Fetcher] Anthropic API key not configured, skipping fetch');
    return null;
  }

  try {
    // Anthropic SDK uses models.list() method
    // Check if the method exists (for backwards compatibility)
    if (!anthropic.models || typeof anthropic.models.list !== 'function') {
      console.warn('[Model Fetcher] Anthropic SDK models.list() not available');
      return null;
    }

    const response = await anthropic.models.list();
    const models = response.data || [];

    const filtered = models
      .map(model => ({
        id: model.id,
        label: model.display_name || model.id,
        createdAt: model.created_at,
        type: model.type
      }))
      .filter(isAnthropicModelSuitable);

    console.log(`[Model Fetcher] Anthropic: ${filtered.length} suitable models out of ${models.length} total`);
    return filtered;
  } catch (error) {
    console.error('[Model Fetcher] Error fetching Anthropic models:', error.message);
    return null;
  }
}

/**
 * Determine if a Google Gemini model is suitable for SVG animation generation
 *
 * Most reliable approach: Uses actual API capability fields (supportedGenerationMethods,
 * token limits) combined with model name pattern. This is the most reliable filtering
 * because Google provides explicit capability metadata.
 */
function isGoogleModelSuitable(model) {
  const id = model.id?.toLowerCase() || '';
  const methods = model.supportedGenerationMethods || [];
  const inputLimit = model.inputTokenLimit || 0;
  const outputLimit = model.outputTokenLimit || 0;

  // Must support content generation (this is the key capability check)
  // This is reliable because Google explicitly lists supported methods
  if (!methods.includes('generateContent')) {
    return false;
  }

  // Must be a Gemini model (exclude embedding models, etc.)
  if (!id.includes('gemini')) {
    return false;
  }

  // Exclude embedding models explicitly (even if they somehow pass above checks)
  if (id.includes('embedding') ||
      id.includes('embed-') ||
      id.includes('text-embedding')) {
    return false;
  }

  // Require reasonable token limits for practical SVG generation
  // SVG animations can be large, so we need models with decent capacity
  //
  // Primary check: Both input and output limits are reasonable
  // This catches most production-ready models
  if (inputLimit >= 8000 && outputLimit >= 1000) {
    return true;
  }

  // Secondary check: Very high output limit even if input is smaller
  // This catches models optimized for generation tasks
  if (outputLimit >= 8000) {
    return true;
  }

  // Default: exclude models with very small limits
  // These are likely experimental or specialized models not suitable for SVG generation
  return false;
}

/**
 * Fetch available models from Google Gemini API
 */
async function fetchGoogleModels() {
  if (!config.google.apiKey) {
    console.log('[Model Fetcher] Google API key not configured, skipping fetch');
    return null;
  }

  try {
    // Check if fetch is available (Node.js 18+)
    if (typeof fetch === 'undefined') {
      console.warn('[Model Fetcher] fetch API not available, skipping Google model fetch');
      return null;
    }

    // Google Gemini requires REST API call directly
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models?key=${config.google.apiKey}`,
      {
        method: 'GET',
        headers: {
          'Content-Type': 'application/json'
        }
      }
    );

    if (!response.ok) {
      const errorText = await response.text().catch(() => 'Unknown error');
      throw new Error(`Google API returned ${response.status}: ${response.statusText} - ${errorText}`);
    }

    const data = await response.json();
    const models = data.models || [];

    const filtered = models
      .map(model => {
        // Extract model ID from name (format: "models/gemini-2.5-flash")
        const modelId = model.name?.replace(/^models\//, '') || model.name;
        return {
          id: modelId,
          label: model.displayName || modelId,
          version: model.version,
          createTime: model.createTime, // RFC 3339 datetime string
          inputTokenLimit: model.inputTokenLimit,
          outputTokenLimit: model.outputTokenLimit,
          supportedGenerationMethods: model.supportedGenerationMethods
        };
      })
      .filter(isGoogleModelSuitable);

    console.log(`[Model Fetcher] Google: ${filtered.length} suitable models out of ${models.length} total`);
    return filtered;
  } catch (error) {
    console.error('[Model Fetcher] Error fetching Google models:', error.message);
    return null;
  }
}

/**
 * Extract release date from a model for sorting purposes
 * Simplified: Uses API-provided dates only (no ID parsing fallback)
 * - OpenAI: Unix timestamp in seconds → milliseconds
 * - Anthropic: RFC 3339 string → milliseconds
 * - Google: RFC 3339 string → milliseconds
 * Returns milliseconds since epoch, or 0 if no date (sorts to end)
 */
function getModelReleaseDate(model) {
  // OpenAI: Unix timestamp in seconds
  if (model.created && typeof model.created === 'number') {
    return model.created * 1000;
  }

  // Anthropic: RFC 3339 string
  if (model.createdAt && typeof model.createdAt === 'string') {
    const date = new Date(model.createdAt);
    if (!isNaN(date.getTime())) return date.getTime();
  }

  // Google: RFC 3339 string
  if (model.createTime && typeof model.createTime === 'string') {
    const date = new Date(model.createTime);
    if (!isNaN(date.getTime())) return date.getTime();
  }

  return 0; // No date - will sort to end
}

/**
 * Sort models by release date (newest first)
 * Models without dates (date = 0) are placed at the end
 */
function sortModelsByDate(models) {
  return models.sort((a, b) => {
    const dateA = getModelReleaseDate(a);
    const dateB = getModelReleaseDate(b);
    // Simple descending sort - 0 values (no date) will sort to end
    return dateB - dateA;
  });
}

/**
 * Merge API model data with hardcoded metadata from JSON
 * This preserves useCase, supportsTemperature, maxOutputTokens, etc.
 */
function mergeWithMetadata(provider, apiModels) {
  if (!apiModels || apiModels.length === 0) {
    return null;
  }

  const metadata = getProviderMetadata(provider);
  if (!metadata || !metadata.models) {
    // No metadata to merge, return API models as-is (sorted by date)
    const models = apiModels.map(model => ({
      id: model.id,
      label: model.label || model.id,
      useCase: undefined,
      supportsTemperature: undefined,
      // Preserve date fields for sorting
      created: model.created,
      createdAt: model.createdAt,
      createTime: model.createTime
    }));
    return sortModelsByDate(models);
  }

  // Create a map of metadata by model ID
  const metadataMap = new Map();
  metadata.models.forEach(meta => {
    metadataMap.set(meta.id, meta);
  });

  // Merge API models with metadata
  // Only use exact ID matching - don't do prefix matching to avoid wrong labels
  const merged = apiModels.map(apiModel => {
    // Only exact match - no prefix matching
    const meta = metadataMap.get(apiModel.id);

    // Determine if model supports temperature
    // Use metadata if available, otherwise infer from model ID
    let supportsTemperature = meta?.supportsTemperature;
    if (typeof supportsTemperature === 'undefined') {
      // Auto-detect models that don't support temperature
      const id = apiModel.id.toLowerCase();
      if (id.startsWith('gpt-5') || id.startsWith('o1')) {
        supportsTemperature = false;
      } else {
        // Default to true for unknown models (most models support temperature)
        supportsTemperature = true;
      }
    }

    return {
      id: apiModel.id,
      label: meta?.label || apiModel.label || apiModel.id,
      useCase: meta?.useCase,
      supportsTemperature: supportsTemperature,
      maxOutputTokens: meta?.maxOutputTokens,
      // Preserve date fields for sorting (we'll remove them before returning to frontend)
      created: apiModel.created,
      createdAt: apiModel.createdAt,
      createTime: apiModel.createTime
    };
  });

  // Remove exact duplicates by ID first
  const seenIds = new Set();
  const uniqueById = merged.filter(model => {
    if (seenIds.has(model.id)) return false;
    seenIds.add(model.id);
    return true;
  });

  // Then deduplicate by label - if multiple models have the same label, keep only one
  // Prefer models with exact metadata matches, then prefer shorter IDs (base models), then newest
  const labelMap = new Map();
  uniqueById.forEach(model => {
    const existing = labelMap.get(model.label);
    if (!existing) {
      labelMap.set(model.label, model);
    } else {
      // Decide which one to keep
      const hasMeta = metadataMap.has(model.id);
      const existingHasMeta = metadataMap.has(existing.id);

      // Prefer exact metadata match
      if (hasMeta && !existingHasMeta) {
        labelMap.set(model.label, model);
      } else if (!hasMeta && existingHasMeta) {
        // Keep existing
      } else {
        // Both have meta or both don't - prefer shorter ID (base model), then newest
        if (model.id.length < existing.id.length) {
          labelMap.set(model.label, model);
        } else if (model.id.length > existing.id.length) {
          // Keep existing
        } else {
          // Same length - prefer newest by created timestamp
          const createdA = model.created || 0;
          const createdB = existing.created || 0;
          if (createdA > createdB) {
            labelMap.set(model.label, model);
          }
        }
      }
    }
  });

  const deduplicated = Array.from(labelMap.values());

  // Sort by release date (newest first)
  return sortModelsByDate(deduplicated);
}

/**
 * Get models for a specific provider with caching and fallback
 */
async function getModelsForProvider(provider, forceRefresh = false) {
  // Check cache first (unless forcing refresh)
  if (!forceRefresh && isCacheValid(provider)) {
    console.log(`[Model Fetcher] Using cached models for ${provider}`);
    return cache[provider].data;
  }

  let apiModels = null;

  // Fetch from API
  switch (provider) {
    case 'openai':
      apiModels = await fetchOpenAIModels();
      break;
    case 'anthropic':
      apiModels = await fetchAnthropicModels();
      break;
    case 'google':
      apiModels = await fetchGoogleModels();
      break;
    default:
      console.warn(`[Model Fetcher] Unknown provider: ${provider}`);
      return null;
  }

  // Merge with metadata
  let mergedModels = null;
  if (apiModels && apiModels.length > 0) {
    mergedModels = mergeWithMetadata(provider, apiModels);

    // For OpenAI, apply additional deduplication after merge (in case metadata matching created duplicates)
    if (provider === 'openai' && mergedModels) {
      const beforeMerge = mergedModels.length;
      mergedModels = deduplicateOpenAIModels(mergedModels);
      if (mergedModels.length < beforeMerge) {
        console.log(`[Model Fetcher] Deduplicated ${provider} models: ${beforeMerge} -> ${mergedModels.length} after merge`);
      }
    }

    console.log(`[Model Fetcher] Fetched ${mergedModels.length} models from ${provider} API`);
  }

  // Fallback to hardcoded JSON if API fetch failed
  // This ensures we always have models available even if API calls fail
  if (!mergedModels || mergedModels.length === 0) {
    console.log(`[Model Fetcher] API fetch failed for ${provider}, using hardcoded models`);
    const metadata = getProviderMetadata(provider);
    if (metadata && metadata.models) {
      mergedModels = metadata.models.map(model => ({
        id: model.id,
        label: model.label,
        useCase: model.useCase,
        supportsTemperature: typeof model.supportsTemperature === 'boolean'
          ? model.supportsTemperature
          : undefined,
        maxOutputTokens: model.maxOutputTokens
      }));

      // Sort fallback models by date (extracted from ID if available)
      mergedModels = sortModelsByDate(mergedModels);
    }
  }

  // Note: The filtering is conservative by design. We prefer to miss some models
  // rather than include models that might not work well for SVG generation.
  // If a new model should be included, it can be added to the JSON file manually,
  // or the filtering logic can be adjusted if the model clearly matches our criteria.

  // Update cache
  if (mergedModels) {
    cache[provider] = {
      data: mergedModels,
      timestamp: Date.now()
    };
  }

  return mergedModels;
}

/**
 * Get all provider models (for all configured providers)
 */
async function getAllModels(forceRefresh = false) {
  const providers = ['openai', 'anthropic', 'google'];
  const results = {};

  // Fetch all providers in parallel
  const promises = providers.map(async (provider) => {
    const models = await getModelsForProvider(provider, forceRefresh);
    if (models) {
      results[provider] = models;
    }
  });

  await Promise.allSettled(promises);

  return results;
}

/**
 * Get public provider info with dynamic models
 * This replaces getPublicProviderInfo() when dynamic fetching is enabled
 */
async function getPublicProviderInfoWithDynamicModels(forceRefresh = false) {
  const allModels = await getAllModels(forceRefresh);
  const { providerRegistry } = require('../utils/provider-utils');

  return Object.values(providerRegistry).map(provider => {
    const dynamicModels = allModels[provider.id];
    let models = dynamicModels || provider.models;

    // Models are already sorted by date in mergeWithMetadata/getModelsForProvider
    // Just map to final format (removing internal date fields)
    return {
      id: provider.id,
      displayName: provider.displayName,
      description: provider.description,
      defaultModel: provider.defaultModel,
      models: models.map(model => ({
        id: model.id,
        label: model.label || model.id,
        useCase: model.useCase,
        supportsTemperature: typeof model.supportsTemperature === 'boolean'
          ? model.supportsTemperature
          : undefined,
        maxOutputTokens: model.maxOutputTokens
      }))
    };
  });
}

module.exports = {
  getModelsForProvider,
  getAllModels,
  getPublicProviderInfoWithDynamicModels,
  fetchOpenAIModels,
  fetchAnthropicModels,
  fetchGoogleModels
};
