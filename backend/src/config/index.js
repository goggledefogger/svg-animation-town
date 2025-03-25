/**
 * Application configuration settings
 */
const config = {
  // Server configuration
  server: {
    port: process.env.PORT || 3001,
    nodeEnv: process.env.NODE_ENV || 'development',
    isProduction: process.env.NODE_ENV === 'production',
  },

  // OpenAI configuration
  openai: {
    apiKey: process.env.OPENAI_API_KEY,
    model: process.env.OPENAI_MODEL || 'gpt-4o-mini',
    temperature: 0.7,
    maxTokens: 12000,
    // Rate limiter configuration
    rateLimiter: {
      tokensPerMinute: parseInt(process.env.OPENAI_RATE_LIMIT_TOKENS_PER_MINUTE, 10) || 10000,
      tokensPerRequest: parseInt(process.env.OPENAI_RATE_LIMIT_TOKENS_PER_REQUEST, 10) || 2000,
      maxConcurrentRequests: parseInt(process.env.OPENAI_RATE_LIMIT_MAX_CONCURRENT_REQUESTS, 10) || 3
    }
  },

  // Claude configuration
  claude: {
    apiKey: process.env.CLAUDE_API_KEY,
    model: process.env.CLAUDE_MODEL || 'claude-3-7-sonnet-20250219',
    temperature: 0.7,
    maxTokens: 12000,
    // Rate limiter configuration
    rateLimiter: {
      tokensPerMinute: parseInt(process.env.CLAUDE_RATE_LIMIT_TOKENS_PER_MINUTE, 10) || 8000,
      tokensPerRequest: parseInt(process.env.CLAUDE_RATE_LIMIT_TOKENS_PER_REQUEST, 10) || 1600,
      maxConcurrentRequests: parseInt(process.env.CLAUDE_RATE_LIMIT_MAX_CONCURRENT_REQUESTS, 10) || 2
    }
  },

  // AI Provider selection
  aiProvider: process.env.AI_PROVIDER || 'openai', // 'openai' or 'claude'

  // Cors configuration
  cors: {
    origin: process.env.CORS_ORIGIN || '*',
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'OPTIONS'],
  },
};

// Validate required environment variables
const validateConfig = () => {
  // Check for at least one API key based on provider or both
  if (config.aiProvider === 'openai' && !config.openai.apiKey) {
    console.warn('Warning: OpenAI API key is missing but OpenAI is selected as the provider.');
  }

  if (config.aiProvider === 'claude' && !config.claude.apiKey) {
    console.warn('Warning: Claude API key is missing but Claude is selected as the provider.');
  }

  // Validate other common settings
  const otherRequiredVars = [];
  const missingEnvVars = otherRequiredVars.filter(envVar => !process.env[envVar]);

  if (missingEnvVars.length > 0) {
    console.warn(`Warning: Missing other required environment variables: ${missingEnvVars.join(', ')}`);
    console.warn('Some features may not work correctly without these variables.');
  }
};

// Call the validation function
validateConfig();

module.exports = config;
