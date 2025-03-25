const config = require('../config');

/**
 * Unified rate limiter for managing API request rates across providers
 * Uses token bucket algorithm with provider-specific configurations
 */
class UnifiedRateLimiter {
  constructor() {
    // Initialize buckets for each provider
    this.buckets = {
      claude: {
        tokens: config.claude.rateLimiter.tokensPerMinute,
        tokensPerRequest: config.claude.rateLimiter.tokensPerRequest,
        maxConcurrent: config.claude.rateLimiter.maxConcurrentRequests,
        currentRequests: 0,
        lastRefill: Date.now()
      },
      openai: {
        tokens: config.openai.rateLimiter.tokensPerMinute,
        tokensPerRequest: config.openai.rateLimiter.tokensPerRequest,
        maxConcurrent: config.openai.rateLimiter.maxConcurrentRequests,
        currentRequests: 0,
        lastRefill: Date.now()
      }
    };

    // Debug logging
    console.log('[Rate Limiter] Initialized with config:', {
      claude: {
        tokensPerMinute: config.claude.rateLimiter.tokensPerMinute,
        maxConcurrent: config.claude.rateLimiter.maxConcurrentRequests
      },
      openai: {
        tokensPerMinute: config.openai.rateLimiter.tokensPerMinute,
        maxConcurrent: config.openai.rateLimiter.maxConcurrentRequests
      }
    });
  }

  /**
   * Refill tokens for a provider based on elapsed time
   * @param {string} provider - The provider to refill tokens for
   */
  refillTokens(provider) {
    const bucket = this.buckets[provider];
    const now = Date.now();
    const elapsedMinutes = (now - bucket.lastRefill) / 60000;

    if (elapsedMinutes > 0) {
      const tokensToAdd = Math.floor(elapsedMinutes * bucket.tokensPerRequest);
      const maxTokens = config[provider].rateLimiter.tokensPerMinute;

      bucket.tokens = Math.min(maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;

      console.log(`[Rate Limiter] Refilled ${provider} tokens:`, {
        added: tokensToAdd,
        current: bucket.tokens,
        max: maxTokens
      });
    }
  }

  /**
   * Check if we can make a request for a provider
   * @param {string} provider - The provider to check
   * @returns {boolean} Whether we can make a request
   */
  canMakeRequest(provider) {
    const bucket = this.buckets[provider];
    this.refillTokens(provider);

    return bucket.currentRequests < bucket.maxConcurrent &&
           bucket.tokens >= bucket.tokensPerRequest;
  }

  /**
   * Execute a rate-limited request
   * @param {Function} fn - The function to execute
   * @param {Array} args - Arguments for the function
   * @param {string} provider - The AI provider
   * @returns {Promise} Result of the function
   */
  async executeRequest(fn, args, provider) {
    if (!this.buckets[provider]) {
      throw new Error(`Invalid provider: ${provider}`);
    }

    // Wait for capacity using exponential backoff
    let attempts = 0;
    const maxAttempts = 5;
    const baseDelay = 1000;

    while (!this.canMakeRequest(provider)) {
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error(`Rate limit exceeded for ${provider} after ${maxAttempts} attempts`);
      }

      const delay = Math.min(baseDelay * Math.pow(2, attempts), 10000);
      console.log(`[Rate Limiter] Waiting ${delay}ms for ${provider} capacity (attempt ${attempts}/${maxAttempts})`);
      await new Promise(resolve => setTimeout(resolve, delay));
    }

    // Update bucket state
    const bucket = this.buckets[provider];
    bucket.currentRequests++;
    bucket.tokens -= bucket.tokensPerRequest;

    console.log(`[Rate Limiter] Starting ${provider} request:`, {
      concurrent: bucket.currentRequests,
      maxConcurrent: bucket.maxConcurrent,
      remainingTokens: bucket.tokens
    });

    try {
      const result = await fn(...args);
      return result;
    } finally {
      bucket.currentRequests--;
      console.log(`[Rate Limiter] Completed ${provider} request. Current requests: ${bucket.currentRequests}`);
    }
  }
}

// Export a singleton instance
module.exports = new UnifiedRateLimiter();
