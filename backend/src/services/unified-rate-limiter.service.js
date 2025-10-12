const config = require('../config');
const { normalizeProvider } = require('../utils/provider-utils');

/**
 * Unified rate limiter for managing API request rates across providers
 * Uses token bucket algorithm with provider-specific configurations
 */
class UnifiedRateLimiter {
  constructor() {
    // Ensure maxConcurrent has default values and proper property names
    const anthropicMaxConcurrent = config.anthropic.rateLimiter.maxConcurrentRequests || 2;
    const openaiMaxConcurrent = config.openai.rateLimiter.maxConcurrentRequests || 10;
    const googleMaxConcurrent = config.google.rateLimiter.maxConcurrentRequests || 10;

    // For Claude, enforce a stricter limit to prevent 529 overload errors
    const anthropicConcurrencyLimit = Math.min(anthropicMaxConcurrent, 2);

    this.buckets = {
      anthropic: {
        tokens: config.anthropic.rateLimiter.tokensPerMinute,
        maxTokens: config.anthropic.rateLimiter.tokensPerMinute,
        tokensPerRequest: config.anthropic.rateLimiter.tokensPerRequest || 1600,
        currentRequests: 0,
        maxConcurrent: anthropicConcurrencyLimit,
        lastRefill: Date.now(),
        pendingRequests: new Set(),
        activePromises: new Map()
      },
      openai: {
        tokens: config.openai.rateLimiter.tokensPerMinute,
        maxTokens: config.openai.rateLimiter.tokensPerMinute,
        tokensPerRequest: config.openai.rateLimiter.tokensPerRequest || 2000,
        currentRequests: 0,
        maxConcurrent: openaiMaxConcurrent,
        lastRefill: Date.now(),
        pendingRequests: new Set(),
        activePromises: new Map()
      },
      google: {
        tokens: config.google.rateLimiter.tokensPerMinute,
        maxTokens: config.google.rateLimiter.tokensPerMinute,
        tokensPerRequest: config.google.rateLimiter.tokensPerRequest || 2000,
        currentRequests: 0,
        maxConcurrent: googleMaxConcurrent,
        lastRefill: Date.now(),
        pendingRequests: new Set(),
        activePromises: new Map()
      }
    };

    console.log('[Rate Limiter] Initialized with config:', {
      anthropic: {
        tokensPerMinute: config.anthropic.rateLimiter.tokensPerMinute,
        maxConcurrent: anthropicConcurrencyLimit,
        tokensPerRequest: this.buckets.anthropic.tokensPerRequest
      },
      openai: {
        tokensPerMinute: config.openai.rateLimiter.tokensPerMinute,
        maxConcurrent: openaiMaxConcurrent,
        tokensPerRequest: this.buckets.openai.tokensPerRequest
      },
      google: {
        tokensPerMinute: config.google.rateLimiter.tokensPerMinute,
        maxConcurrent: googleMaxConcurrent,
        tokensPerRequest: this.buckets.google.tokensPerRequest
      }
    });
  }

  resolveProviderKey(provider) {
    const normalized = normalizeProvider(provider);
    if (normalized && this.buckets[normalized]) {
      return normalized;
    }

    if (this.buckets[provider]) {
      return provider;
    }

    throw new Error(`Unknown provider: ${provider}`);
  }

  /**
   * Refill tokens for a provider based on elapsed time
   * @param {string} provider - The provider to refill tokens for
   */
  refillTokens(provider) {
    const providerKey = this.resolveProviderKey(provider);
    const bucket = this.buckets[providerKey];
    const now = Date.now();
    const timePassed = now - bucket.lastRefill;
    const tokensToAdd = Math.floor((timePassed / 60000) * bucket.maxTokens);

    if (tokensToAdd > 0) {
      const oldTokens = bucket.tokens;
      bucket.tokens = Math.min(bucket.maxTokens, bucket.tokens + tokensToAdd);
      bucket.lastRefill = now;
      console.log(`[Rate Limiter] Refilled ${providerKey} tokens:`, {
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
    const providerKey = this.resolveProviderKey(provider);
    const bucket = this.buckets[providerKey];
    this.refillTokens(providerKey);

    const hasCapacity = bucket.currentRequests < bucket.maxConcurrent;
    const hasTokens = bucket.tokens >= bucket.tokensPerRequest;

    console.log(`[Rate Limiter] Checking ${providerKey} capacity:`, {
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
    const providerKey = this.resolveProviderKey(provider);
    const bucket = this.buckets[providerKey];
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
    const providerKey = this.resolveProviderKey(provider);
    const bucket = this.buckets[providerKey];
    let attempts = 0;
    const maxAttempts = 10;

    // Keep trying until we successfully acquire capacity
    while (true) {
      // Atomically check and acquire capacity
      if (this.canMakeRequest(providerKey)) {
        // Immediately claim the capacity
        bucket.currentRequests++;
        bucket.tokens -= bucket.tokensPerRequest;

        console.log(`[Rate Limiter] Acquired capacity for ${providerKey}:`, {
          newCount: bucket.currentRequests,
          maxConcurrent: bucket.maxConcurrent,
          remainingTokens: bucket.tokens
        });

        return;
      }

      attempts++;
      if (attempts > maxAttempts) {
        throw new Error(`Rate limit exceeded for ${providerKey} after ${maxAttempts} attempts`);
      }

      const waitTime = this.getTimeUntilNextRefill(providerKey);

      console.log(`[Rate Limiter] Waiting ${Math.round(waitTime)}ms for ${providerKey} token refill:`, {
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
    const providerKey = this.resolveProviderKey(provider);
    const bucket = this.buckets[providerKey];
    const requestKey = JSON.stringify(args);

    // If we already have a promise for this exact request, return it
    if (bucket.activePromises.has(requestKey)) {
      return bucket.activePromises.get(requestKey);
    }

    const promise = (async () => {
      // Wait for and acquire capacity atomically
      await this.waitForCapacity(providerKey);

      console.log(`[Rate Limiter] Starting ${providerKey} request:`, {
        concurrent: bucket.currentRequests,
        maxConcurrent: bucket.maxConcurrent,
        remainingTokens: bucket.tokens,
        args: args.map(arg => typeof arg === 'string' ? arg.substring(0, 50) : typeof arg)
      });

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
        console.error(`[Rate Limiter] ${providerKey} request failed:`, error);
        throw error;
      } finally {
        // Always clean up, even if the request failed
        bucket.currentRequests--;
        bucket.activePromises.delete(requestKey);
      }
    })();

    // Store the promise so we can reuse it for identical requests
    bucket.activePromises.set(requestKey, promise);
    return promise;
  }
}

// Export a singleton instance
module.exports = new UnifiedRateLimiter();
