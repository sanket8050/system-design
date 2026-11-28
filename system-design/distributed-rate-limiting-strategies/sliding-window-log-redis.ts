/**
 * sliding-window-log-redis.ts
 *
 * Implements the Sliding Window Log rate limiting algorithm using Redis Sorted Sets.
 *
 * Algorithm:
 * 1. Store timestamps of all incoming requests in a Redis Sorted Set.
 *    The score of each member is its timestamp (e.g., milliseconds since epoch).
 * 2. When a new request arrives:
 *    a. Remove all timestamps older than the current window start (current_time - window_size).
 *    b. Add the current request's timestamp to the set.
 *    c. Count the remaining timestamps in the set.
 *    d. If the count is less than or equal to the limit, allow the request.
 *    e. Otherwise, reject the request.
 */
import { Redis } from 'ioredis';

interface RateLimitOptions {
  limit: number; // Max requests allowed
  windowMs: number; // Time window in milliseconds
  key: string; // Unique identifier for the rate limit (e.g., user ID, IP address)
}

class SlidingWindowLogRedis {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * Checks if a request is allowed based on the sliding window log algorithm.
   * @returns true if the request is allowed, false otherwise.
   */
  public async isAllowed(options: RateLimitOptions): Promise<boolean> {
    const { limit, windowMs, key } = options;
    const now = Date.now(); // Current timestamp in milliseconds
    const windowStart = now - windowMs;

    // Use a Redis pipeline for atomicity and efficiency
    const pipeline = this.redis.pipeline();

    // 1. Remove old requests (timestamps outside the current window)
    // ZREMRANGEBYSCORE key min max
    pipeline.zremrangebyscore(key, 0, windowStart);

    // 2. Add the current request's timestamp
    // ZADD key score member
    pipeline.zadd(key, now.toString(), now.toString()); // Score and member are the timestamp

    // 3. Count the remaining requests in the window
    // ZCARD key
    pipeline.zcard(key);

    // 4. Set an expiration on the key to clean up old data
    // The expiration should be slightly longer than the window to ensure old data is eventually cleared
    // or handle cases where no new requests come in for a long time.
    // A common strategy is to set it to windowMs + a buffer, e.g., 2 * windowMs.
    pipeline.expire(key, Math.ceil(windowMs / 1000) * 2); // Convert windowMs to seconds, add buffer

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline execution failed.');
    }

    // Results array structure:
    // [ [null, number], [null, number], [null, number], [null, number] ]
    // Each inner array is [error, result] for a command in the pipeline.
    const zcardResult = results[2][1] as number; // The result of ZCARD

    return zcardResult <= limit;
  }
}

// --- Example Usage ---
if (require.main === module) {
  // To run this example, ensure you have ioredis installed: npm install ioredis
  // And a Redis server running on localhost:6379
  const IORedis = require('ioredis');
  const redisClient = new IORedis({
    host: 'localhost', // or your Redis host
    port: 6379,
    // password: 'your_password',
  });

  const rateLimiter = new SlidingWindowLogRedis(redisClient);
  const userId = 'user:123';
  const limit = 5;
  const windowMs = 5000; // 5 seconds

  async function simulateRequests() {
    console.log(`--- Simulating requests for ${userId} (Limit: ${limit} in ${windowMs}ms) ---`);

    for (let i = 1; i <= 10; i++) {
      const allowed = await rateLimiter.isAllowed({ key: userId, limit, windowMs });
      console.log(`Request ${i}: ${allowed ? 'ALLOWED' : 'BLOCKED'}`);
      // Introduce a small delay to see the effect over time
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    console.log("\n--- Waiting for window to reset ---");
    await new Promise(resolve => setTimeout(resolve, windowMs + 1000)); // Wait for window to pass

    console.log("\n--- Simulating requests after window reset ---");
    for (let i = 1; i <= 3; i++) {
      const allowed = await rateLimiter.isAllowed({ key: userId, limit, windowMs });
      console.log(`Request ${i}: ${allowed ? 'ALLOWED' : 'BLOCKED'}`);
      await new Promise(resolve => setTimeout(resolve, 100));
    }

    redisClient.quit();
  }

  simulateRequests().catch(console.error);
}