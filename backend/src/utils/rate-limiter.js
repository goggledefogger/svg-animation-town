/**
 * Simple token bucket rate limiter
 */
class RateLimiter {
  /**
   * @param {Object} options Rate limiter options
   * @param {number} options.tokensPerInterval Tokens added per interval
   * @param {number} options.interval Interval in milliseconds
   * @param {number} options.maxWaitTime Maximum time to wait for a token
   */
  constructor(options) {
    this.tokensPerInterval = options.tokensPerInterval || 60;
    this.interval = options.interval || 60 * 1000; // 1 minute default
    this.maxWaitTime = options.maxWaitTime || 30 * 1000; // 30 seconds default
    this.tokens = this.tokensPerInterval;
    this.lastRefill = Date.now();
    this.waitQueue = [];
  }

  /**
   * Refill tokens based on elapsed time
   * @private
   */
  _refillTokens() {
    const now = Date.now();
    const timePassed = now - this.lastRefill;
    const tokensToAdd = Math.floor(timePassed / this.interval) * this.tokensPerInterval;

    if (tokensToAdd > 0) {
      this.tokens = Math.min(this.tokensPerInterval, this.tokens + tokensToAdd);
      this.lastRefill = now;
    }
  }

  /**
   * Process the wait queue, resolving promises for waiters if tokens are available
   * @private
   */
  _processWaitQueue() {
    while (this.waitQueue.length > 0 && this.tokens > 0) {
      const waiter = this.waitQueue.shift();
      this.tokens--;
      waiter.resolve();
    }
  }

  /**
   * Get a token, waiting if necessary
   * @returns {Promise<void>} Resolves when a token is acquired
   */
  acquireToken() {
    this._refillTokens();

    // If tokens are available, grant immediately
    if (this.tokens > 0) {
      this.tokens--;
      return Promise.resolve();
    }

    // Otherwise, wait for a token
    return new Promise((resolve, reject) => {
      const timeout = setTimeout(() => {
        // Remove from queue on timeout
        const index = this.waitQueue.findIndex(w => w.resolve === resolve);
        if (index !== -1) {
          this.waitQueue.splice(index, 1);
        }
        reject(new Error('Rate limit wait timeout exceeded'));
      }, this.maxWaitTime);

      // Add to wait queue
      this.waitQueue.push({
        resolve: () => {
          clearTimeout(timeout);
          resolve();
        }
      });
    });
  }

  /**
   * Get available tokens
   * @returns {number} Number of available tokens
   */
  getAvailableTokens() {
    this._refillTokens();
    return this.tokens;
  }
}

module.exports = { RateLimiter };
