const {
  normalizeProvider,
  resolveModelId,
  getDefaultModel,
  getPublicProviderInfo
} = require('../utils/provider-utils');

const parseIntWithDefault = (value, fallback) => {
  const parsed = parseInt(value, 10);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const parseFloatWithDefault = (value, fallback) => {
  const parsed = parseFloat(value);
  return Number.isFinite(parsed) ? parsed : fallback;
};

const serverConfig = {
  port: process.env.PORT || 3001,
  nodeEnv: process.env.NODE_ENV || 'development',
  isProduction: process.env.NODE_ENV === 'production'
};

const openaiConfig = {
  apiKey: process.env.OPENAI_API_KEY,
  model: resolveModelId('openai', process.env.OPENAI_MODEL),
  temperature: parseFloatWithDefault(process.env.OPENAI_TEMPERATURE, 0.7),
  maxTokens: parseIntWithDefault(process.env.OPENAI_MAX_TOKENS, 12000),
  rateLimiter: {
    tokensPerMinute: parseIntWithDefault(process.env.OPENAI_RATE_LIMIT_TOKENS_PER_MINUTE, 10000),
    tokensPerRequest: parseIntWithDefault(process.env.OPENAI_RATE_LIMIT_TOKENS_PER_REQUEST, 2000),
    maxConcurrentRequests: parseIntWithDefault(process.env.OPENAI_RATE_LIMIT_MAX_CONCURRENT_REQUESTS, 10)
  }
};

const anthropicConfig = {
  apiKey: process.env.ANTHROPIC_API_KEY || process.env.CLAUDE_API_KEY,
  model: resolveModelId('anthropic', process.env.ANTHROPIC_MODEL || process.env.CLAUDE_MODEL),
  temperature: parseFloatWithDefault(process.env.ANTHROPIC_TEMPERATURE || process.env.CLAUDE_TEMPERATURE, 0.7),
  maxTokens: parseIntWithDefault(process.env.ANTHROPIC_MAX_TOKENS || process.env.CLAUDE_MAX_TOKENS, 8192),
  rateLimiter: {
    tokensPerMinute: parseIntWithDefault(
      process.env.ANTHROPIC_RATE_LIMIT_TOKENS_PER_MINUTE || process.env.CLAUDE_RATE_LIMIT_TOKENS_PER_MINUTE,
      8000
    ),
    tokensPerRequest: parseIntWithDefault(
      process.env.ANTHROPIC_RATE_LIMIT_TOKENS_PER_REQUEST || process.env.CLAUDE_RATE_LIMIT_TOKENS_PER_REQUEST,
      1600
    ),
    maxConcurrentRequests: parseIntWithDefault(
      process.env.ANTHROPIC_RATE_LIMIT_MAX_CONCURRENT_REQUESTS || process.env.CLAUDE_RATE_LIMIT_MAX_CONCURRENT_REQUESTS,
      10
    )
  }
};

const googleConfig = {
  apiKey: process.env.GOOGLE_API_KEY || process.env.GEMINI_API_KEY,
  model: resolveModelId('google', process.env.GOOGLE_MODEL || process.env.GEMINI_MODEL),
  temperature: parseFloatWithDefault(process.env.GOOGLE_TEMPERATURE || process.env.GEMINI_TEMPERATURE, 0.7),
  maxTokens: parseIntWithDefault(process.env.GOOGLE_MAX_TOKENS || process.env.GEMINI_MAX_TOKENS, 12000),
  rateLimiter: {
    tokensPerMinute: parseIntWithDefault(
      process.env.GOOGLE_RATE_LIMIT_TOKENS_PER_MINUTE || process.env.GEMINI_RATE_LIMIT_TOKENS_PER_MINUTE,
      10000
    ),
    tokensPerRequest: parseIntWithDefault(
      process.env.GOOGLE_RATE_LIMIT_TOKENS_PER_REQUEST || process.env.GEMINI_RATE_LIMIT_TOKENS_PER_REQUEST,
      2000
    ),
    maxConcurrentRequests: parseIntWithDefault(
      process.env.GOOGLE_RATE_LIMIT_MAX_CONCURRENT_REQUESTS || process.env.GEMINI_RATE_LIMIT_MAX_CONCURRENT_REQUESTS,
      10
    )
  }
};

const normalizedProvider = normalizeProvider(process.env.AI_PROVIDER) || 'openai';

const config = {
  server: serverConfig,
  providers: {
    openai: openaiConfig,
    anthropic: anthropicConfig,
    google: googleConfig
  },
  openai: openaiConfig,
  anthropic: anthropicConfig,
  // Legacy aliases retained for backwards compatibility
  claude: anthropicConfig,
  google: googleConfig,
  gemini: googleConfig,
  aiProvider: normalizedProvider,
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS']
  },
  defaults: {
    openai: getDefaultModel('openai'),
    anthropic: getDefaultModel('anthropic'),
    google: getDefaultModel('google')
  },
  publicProviders: getPublicProviderInfo()
};

const validateConfig = () => {
  if (config.aiProvider === 'openai' && !config.openai.apiKey) {
    console.warn('Warning: OpenAI API key is missing but OpenAI is selected as the provider.');
  }

  if (config.aiProvider === 'anthropic' && !config.anthropic.apiKey) {
    console.warn('Warning: Anthropic API key is missing but Anthropic is selected as the provider.');
  }

  if (config.aiProvider === 'google' && !config.google.apiKey) {
    console.warn('Warning: Google Gemini API key is missing but Google is selected as the provider.');
  }

  const otherRequiredVars = [];
  const missingEnvVars = otherRequiredVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    console.warn(`Warning: Missing other required environment variables: ${missingEnvVars.join(', ')}`);
    console.warn('Some features may not work correctly without these variables.');
  }
};

validateConfig();

module.exports = config;
