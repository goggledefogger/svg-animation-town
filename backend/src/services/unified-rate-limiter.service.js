const config = require('../config');

/**
 * Unified rate limiter for managing API request rates across providers
 * Uses token bucket algorithm with provider-specific configurations
 */
class UnifiedRateLimiter {
  constructor() {
    // Ensure maxConcurrent has default values
    const claudeMaxConcurrent = config.claude.rateLimiter.maxConcurrent || 2;
    const openaiMaxConcurrent = config.openai.rateLimiter.maxConcurrent || 10;

    this.buckets = {
      claude: {
        tokens: config.claude.rateLimiter.tokensPerMinute,
        maxTokens: config.claude.rateLimiter.tokensPerMinute,
        tokensPerRequest: 1600, // Claude uses about 1600 tokens per request
        currentRequests: 0,
        maxConcurrent: claudeMaxConcurrent,
        lastRefill: Date.now(),
        pendingRequests: new Set(),
        activePromises: new Map()
      },
      openai: {
        tokens: config.openai.rateLimiter.tokensPerMinute,
        maxTokens: config.openai.rateLimiter.tokensPerMinute,
        tokensPerRequest: 2000, // OpenAI uses about 2000 tokens per request
        currentRequests: 0,
        maxConcurrent: openaiMaxConcurrent,
        lastRefill: Date.now(),
        pendingRequests: new Set(),
        activePromises: new Map()
      }
    };

    console.log('[Rate Limiter] Initialized with config:', {
      claude: {
        tokensPerMinute: config.claude.rateLimiter.tokensPerMinute,
        maxConcurrent: claudeMaxConcurrent,
        tokensPerRequest: this.buckets.claude.tokensPerRequest
      },
      openai: {
        tokensPerMinute: config.openai.rateLimiter.tokensPerMinute,
        maxConcurrent: openaiMaxConcurrent,
        tokensPerRequest: this.buckets.openai.tokensPerRequest
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
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / 60000) * bucket.maxTokens);

    if (tokensToAdd > 0) {
      const oldTokens = bucket.tokens;
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
      console.log(`[Rate Limiter] Refilled ${provider} tokens:`, {
        added: tokensToAdd,
        before: oldTokens,
        after: bucket.tokens,
        max: bucket.maxTokens
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

    const hasCapacity = bucket.currentRequests < bucket.maxConcurrent;
    const hasTokens = bucket.tokens >= bucket.tokensPerRequest;

    console.log(`[Rate Limiter] Checking ${provider} capacity:`, {
      hasCapacity,
      hasTokens,
      currentRequests: bucket.currentRequests,
      maxConcurrent: bucket.maxConcurrent,
      currentTokens: bucket.tokens,
      neededTokens: bucket.tokensPerRequest
    });

    return hasCapacity && hasTokens;
  }

  /**
   * Calculate time until next token refill
   * @param {string} provider - The provider to check
   * @returns {number} Milliseconds until next refill
   */
  getTimeUntilNextRefill(provider) {
    const bucket = this.buckets[provider];
    const now = Date.now();
    const timeSinceLastRefill = now - bucket.lastRefill;
    const msPerMinute = 60000;

    // If we've passed a minute, tokens will be refilled immediately
    if (timeSinceLastRefill >= msPerMinute) {
      return 0;
    }

    // Otherwise, wait for the remainder of the minute
    return msPerMinute - timeSinceLastRefill;
  }

  /**
   * Wait for capacity based on token bucket timing
   * @param {string} provider - The provider to wait for
   */
  async waitForCapacity(provider) {
    const bucket = this.buckets[provider];
    let attempts = 0;
    const maxAttempts = 10;

    while (!this.canMakeRequest(provider)) {
      attempts++;
      if (attempts > maxAttempts) {
        throw new Error(`Rate limit exceeded for ${provider} after ${maxAttempts} attempts`);
      }

      const waitTime = this.getTimeUntilNextRefill(provider);

      console.log(`[Rate Limiter] Waiting ${Math.round(waitTime)}ms for ${provider} token refill:`, {
        currentTokens: bucket.tokens,
        maxTokens: bucket.maxTokens,
        currentRequests: bucket.currentRequests,
        maxConcurrent: bucket.maxConcurrent,
        attempt: attempts,
        maxAttempts
      });

      await new Promise(resolve => setTimeout(resolve, waitTime + 100));
    }
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
      throw new Error(`Unknown provider: ${provider}`);
    }

    const bucket = this.buckets[provider];
    const requestId = Math.random().toString(36).substring(7);

    // If we already have a promise for this exact request, return it
    const requestKey = JSON.stringify({ args, requestId });
    if (bucket.activePromises.has(requestKey)) {
      console.log(`[Rate Limiter] Reusing existing request for ${provider}`);
      return bucket.activePromises.get(requestKey);
    }

    const promise = (async () => {
      // Wait for capacity before starting
      await this.waitForCapacity(provider);

      // Track that we're about to start a request
      bucket.currentRequests++;
      bucket.tokens -= bucket.tokensPerRequest;
      bucket.pendingRequests.add(requestId);

      console.log(`[Rate Limiter] Starting ${provider} request:`, {
        concurrent: bucket.currentRequests,
        maxConcurrent: bucket.maxConcurrent,
        remainingTokens: bucket.tokens,
        requestId
      });

      let requestError = null;
      try {
        // Execute the actual request
        const result = await Promise.race([
          fn(...args),
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error('Request timeout')), 300000) // 5 min timeout
          )
        ]);
        return result;
      } catch (error) {
        requestError = error;
        console.error(`[Rate Limiter] ${provider} request failed:`, error);
        throw error;
      } finally {
        // Always clean up, even if the request failed
        bucket.currentRequests = Math.max(0, bucket.currentRequests - 1);
        bucket.pendingRequests.delete(requestId);
        bucket.activePromises.delete(requestKey);

        console.log(`[Rate Limiter] Completed ${provider} request:`, {
          newCount: bucket.currentRequests,
          remainingTokens: bucket.tokens,
          requestId,
          success: !requestError
        });
      }
    })();

    bucket.activePromises.set(requestKey, promise);
    return promise;
  }
}

// Export a singleton instance
module.exports = new UnifiedRateLimiter();
