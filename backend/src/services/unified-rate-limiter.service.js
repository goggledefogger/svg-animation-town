const config = require('../config');

/**
 * Unified rate limiter for managing API request rates across providers
 * Uses token bucket algorithm with provider-specific configurations
 */
class UnifiedRateLimiter {
  constructor() {
    // Initialize separate buckets for each provider
    this.buckets = {
      claude: {
        tokens: config.claude.rateLimiter.tokensPerMinute,
        tokensPerRequest: config.claude.rateLimiter.tokensPerRequest,
        maxConcurrentRequests: config.claude.rateLimiter.maxConcurrentRequests,
        currentRequests: 0
      },
      openai: {
        tokens: config.openai.rateLimiter.tokensPerMinute,
        tokensPerRequest: config.openai.rateLimiter.tokensPerRequest,
        maxConcurrentRequests: config.openai.rateLimiter.maxConcurrentRequests,
        currentRequests: 0
      }
    };

    // Shared properties
    this.lastRefillTime = Date.now();
    this.requestQueue = [];
    this.processingQueue = false;
  }

  /**
   * Refill token buckets based on elapsed time
   * @private
   */
  refillBuckets() {
    const now = Date.now();
    const elapsedMs = now - this.lastRefillTime;

    // Refill each provider's bucket
    Object.entries(this.buckets).forEach(([provider, bucket]) => {
      const tokensToAdd = Math.floor((elapsedMs / 60000) * config[provider].rateLimiter.tokensPerMinute);
      if (tokensToAdd > 0) {
        bucket.tokens = Math.min(
          config[provider].rateLimiter.tokensPerMinute,
          bucket.tokens + tokensToAdd
        );
      }
    });

    this.lastRefillTime = now;
  }

  /**
   * Process the next request in the queue if possible
   * @private
   */
  async processQueue() {
    if (this.processingQueue) return;
    this.processingQueue = true;

    try {
      while (this.requestQueue.length > 0) {
        const nextRequest = this.requestQueue[0];
        const bucket = this.buckets[nextRequest.provider];

        // Check if we can process this request
        if (bucket.currentRequests >= bucket.maxConcurrentRequests ||
            bucket.tokens < bucket.tokensPerRequest) {
          break;
        }

        // Remove from queue and process
        this.requestQueue.shift();

        // Update bucket state
        bucket.currentRequests++;
        bucket.tokens -= bucket.tokensPerRequest;

        try {
          const result = await nextRequest.fn(...nextRequest.args);
          nextRequest.resolve(result);
        } catch (error) {
          // Handle rate limit errors
          if (error?.message?.includes('429') || error?.message?.includes('rate_limit')) {
            bucket.tokens = Math.min(bucket.tokens, bucket.tokensPerRequest / 2);
          }
          nextRequest.reject(error);
        } finally {
          bucket.currentRequests--;
        }

        // Refill buckets after each request
        this.refillBuckets();
      }
    } finally {
      this.processingQueue = false;
    }
  }

  /**
   * Enqueue a request to be executed when capacity is available
   * @param {Function} fn - The function to execute
   * @param {Array} args - Arguments for the function
   * @param {string} provider - The AI provider ('openai' or 'claude')
   * @returns {Promise} Resolves with the function result
   */
  async enqueueRequest(fn, args, provider) {
    // Validate provider
    if (!this.buckets[provider]) {
      throw new Error(`Invalid provider: ${provider}`);
    }

    // Refill buckets before checking capacity
    this.refillBuckets();

    return new Promise((resolve, reject) => {
      this.requestQueue.push({ fn, args, provider, resolve, reject });
      this.processQueue();
    });
  }

  /**
   * Get current status of the rate limiter
   * @returns {Object} Current state of all rate limiters
   */
  getStatus() {
    return {
      buckets: this.buckets,
      queueLength: this.requestQueue.length,
      lastRefillTime: this.lastRefillTime
    };
  }
}

// Export singleton instance
module.exports = new UnifiedRateLimiter();
