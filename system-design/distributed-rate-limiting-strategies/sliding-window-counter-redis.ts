/**
 * sliding-window-counter-redis.ts
 *
 * Implements the (approximate) Sliding Window Counter rate limiting algorithm using Redis.
 * This version uses basic INCR and GET operations. For true atomicity in a highly concurrent
 * environment, a Redis Lua script would be preferred to wrap the logic.
 *
 * Algorithm:
 * 1. Determine the current fixed window key and the previous fixed window key.
 * 2. Increment the current window counter.
 * 3. Get the count for the previous window.
 * 4. Calculate the weighted sum for the sliding window.
 * 5. Compare with the limit.
 */
import { Redis } from 'ioredis';

interface RateLimitOptions {
  limit: number; // Max requests allowed
  windowMs: number; // Time window in milliseconds (e.g., 60000 for 1 minute)
  key: string; // Unique identifier for the rate limit (e.g., user ID, IP address)
}

class SlidingWindowCounterRedis {
  private redis: Redis;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
  }

  /**
   * Checks if a request is allowed based on the approximate sliding window counter algorithm.
   * @returns true if the request is allowed, false otherwise.
   */
  public async isAllowed(options: RateLimitOptions): Promise<boolean> {
    const { limit, windowMs, key } = options;
    const now = Date.now(); // Current timestamp in milliseconds

    // Determine the current and previous fixed window start times
    const currentWindowStart = Math.floor(now / windowMs) * windowMs;
    const prevWindowStart = currentWindowStart - windowMs;

    // Keys for Redis counters
    const currentWindowKey = `${key}:${currentWindowStart}`;
    const prevWindowKey = `${key}:${prevWindowStart}`;

    // Calculate the weight of the previous window in the current sliding window
    // Example: if windowMs = 60000 (1 min) and now is 10:30:15
    // currentWindowStart = 10:30:00
    // prevWindowStart = 10:29:00
    // time_in_current_window = 15000 (15 seconds)
    // weight = 1 - (15000 / 60000) = 1 - 0.25 = 0.75
    const timeInCurrentWindow = now - currentWindowStart;
    const prevWindowWeight = 1 - (timeInCurrentWindow / windowMs);

    // Use a Redis pipeline for efficiency.
    // NOTE: This is NOT fully atomic for the read-modify-write on counters.
    // For true atomicity, a Lua script (as shown in the token bucket example) is needed.
    const pipeline = this.redis.pipeline();

    // Increment current window counter and set expiration
    pipeline.incr(currentWindowKey);
    // Set expiration to twice the window size to ensure it covers the sliding window
    // and eventually gets cleaned up.
    pipeline.expire(currentWindowKey, Math.ceil(windowMs / 1000) * 2);

    // Get previous window count
    pipeline.get(prevWindowKey);

    const results = await pipeline.exec();

    if (!results) {
      throw new Error('Redis pipeline execution failed.');
    n    }

    const currentCount = parseInt(results[0][1] as string, 10);
    const prevCountStr = results[2][1] as string | null; // GET command result
    const prevCount = prevCountStr ? parseInt(prevCountStr, 10) : 0;

    const estimatedCount = currentCount + (prevCount * prevWindowWeight);

    return estimatedCount <= limit;
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

  const rateLimiter = new SlidingWindowCounterRedis(redisClient);
  const userId = 'user:456:api';
  const limit = 5;
  const windowMs = 5000; // 5 seconds

  async function simulateRequests() {
    console.log(`--- Simulating requests for ${userId} (Limit: ${limit} in ${windowMs}ms) ---`);

    for (let i = 1; i <= 10; i++) {
      const allowed = await rateLimiter.isAllowed({ key: userId, limit, windowMs });
      console.log(`Request ${i}: ${allowed ? 'ALLOWED' : 'BLOCKED'}`);
      // Introduce a small delay to see the effect over time
      await new Promise(resolve => setTimeout(resolve, 500));
    }

    console.log("\n--- Waiting for window to partially shift ---");
    await new Promise(resolve => setTimeout(resolve, windowMs / 2)); // Wait for half window

    console.log("\n--- Simulating more requests after partial shift ---");
    for (let i = 11; i <= 15; i++) {
      const allowed = await rateLimiter.isAllowed({ key: userId, limit, windowMs });
      console.log(`Request ${i}: ${allowed ? 'ALLOWED' : 'BLOCKED'}`);
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    redisClient.quit();
  }

  simulateRequests().catch(console.error);
}