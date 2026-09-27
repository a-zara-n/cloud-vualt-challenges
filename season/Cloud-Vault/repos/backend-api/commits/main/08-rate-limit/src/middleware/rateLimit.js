/**
 * Rate limiting middleware
 * Simple in-memory rate limiter for API endpoints
 * In production, use Redis-backed rate limiting for multi-instance deployments
 */

class RateLimiter {
  constructor(options = {}) {
    this.windowMs = options.windowMs || 60 * 1000; // 1 minute default
    this.maxRequests = options.maxRequests || 100;
    this.message = options.message || 'Too many requests, please try again later';
    this.keyGenerator = options.keyGenerator || this._defaultKeyGenerator;
    this.store = new Map();

    // Clean up expired entries periodically
    this._cleanupInterval = setInterval(() => {
      this._cleanup();
    }, this.windowMs);

    // Prevent the interval from keeping the process alive
    if (this._cleanupInterval.unref) {
      this._cleanupInterval.unref();
    }
  }

  middleware() {
    return (req, res, next) => {
      const key = this.keyGenerator(req);
      const now = Date.now();
      const windowStart = now - this.windowMs;

      let record = this.store.get(key);

      if (!record || record.resetTime <= now) {
        record = {
          count: 0,
          resetTime: now + this.windowMs,
        };
        this.store.set(key, record);
      }

      record.count++;

      // Set rate limit headers
      res.set('X-RateLimit-Limit', String(this.maxRequests));
      res.set('X-RateLimit-Remaining', String(Math.max(0, this.maxRequests - record.count)));
      res.set('X-RateLimit-Reset', String(Math.ceil(record.resetTime / 1000)));

      if (record.count > this.maxRequests) {
        const retryAfter = Math.ceil((record.resetTime - now) / 1000);
        res.set('Retry-After', String(retryAfter));

        return res.status(429).json({
          error: 'Too Many Requests',
          message: this.message,
          retryAfter,
        });
      }

      next();
    };
  }

  _defaultKeyGenerator(req) {
    return req.ip || req.headers['x-forwarded-for'] || 'unknown';
  }

  _cleanup() {
    const now = Date.now();
    for (const [key, record] of this.store.entries()) {
      if (record.resetTime <= now) {
        this.store.delete(key);
      }
    }
  }

  destroy() {
    clearInterval(this._cleanupInterval);
    this.store.clear();
  }
}

// Pre-configured rate limiters
const apiLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 100,
  message: 'API rate limit exceeded. Please try again later.',
});

const authLimiter = new RateLimiter({
  windowMs: 15 * 60 * 1000, // 15 minutes
  maxRequests: 10,
  message: 'Too many authentication attempts. Please try again later.',
});

const uploadLimiter = new RateLimiter({
  windowMs: 60 * 1000,
  maxRequests: 10,
  message: 'Upload rate limit exceeded. Please try again later.',
});

module.exports = {
  RateLimiter,
  apiLimiter: apiLimiter.middleware(),
  authLimiter: authLimiter.middleware(),
  uploadLimiter: uploadLimiter.middleware(),
};
