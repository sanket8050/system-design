/**
 * distributed-token-bucket-lua.ts
 *
 * Implements a distributed Token Bucket rate limiting algorithm using a Redis Lua script.
 * Lua scripts in Redis are executed atomically, ensuring consistency in a distributed environment.
 *
 * Algorithm (Lua Script Logic):
 * 1. Get current tokens and last refill time for the given key.
 * 2. Calculate how many tokens should have been refilled since last access.
 * 3. Add refilled tokens, capping at capacity.
 * 4. If enough tokens are available for the current request (cost=1):
 *    a. Decrement tokens.
 *    b. Update last refill time to 'now'.
 *    c. Return 1 (allowed).
 * 5. Else:
 *    a. Return 0 (blocked).
 * 6. Set an expiration on the key.
 */
import { Redis } from 'ioredis';

interface RateLimitOptions {
  key: string; // Unique identifier for the rate limit (e.g., user ID, IP address)
  capacity: number; // Max tokens the bucket can hold
  refillRate: number; // Tokens to add per second
  cost?: number; // Tokens consumed by this request, defaults to 1
  ttlSeconds: number; // How long the key should live in Redis (e.g., 2 * window size)
}

class DistributedTokenBucketRedis {
  private redis: Redis;
  private readonly script: string;

  constructor(redisClient: Redis) {
    this.redis = redisClient;
    // Lua script for atomic token bucket logic
    // KEYS: [key]
    // ARGV: [capacity, refillRate, now_ms, cost, ttl_seconds]
    this.script = `
      local key = KEYS[1]
      local capacity = tonumber(ARGV[1])
      local refillRate = tonumber(ARGV[2]) -- tokens per second
      local now = tonumber(ARGV[3])        -- current timestamp in milliseconds
      local cost = tonumber(ARGV[4])       -- tokens consumed by this request (default 1)
      local ttl = tonumber(ARGV[5])        -- key expiration in seconds

      local res = redis.call('HMGET', key, 'tokens', 'lastRefillTime')
      local currentTokens = tonumber(res[1])
      local lastRefillTime = tonumber(res[2])

      if not currentTokens then
        currentTokens = capacity
      end

      if not lastRefillTime then
        lastRefillTime = now
      end

      local elapsedTimeSeconds = (now - lastRefillTime) / 1000
      if elapsedTimeSeconds > 0 then
        local tokensToAdd = elapsedTimeSeconds * refillRate
        currentTokens = math.min(capacity, currentTokens + tokensToAdd)
      end

      if currentTokens >= cost then
        currentTokens = currentTokens - cost
        redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefillTime', now)
        redis.call('EXPIRE', key, ttl)
        return 1 -- Allowed
      else
        redis.call('HMSET', key, 'tokens', currentTokens, 'lastRefillTime', now) -- Update time even if blocked to ensure accurate refill next time.
        redis.call('EXPIRE', key, ttl)
        return 0 -- Blocked
      end
    `;
  }

  /**
   * Attempts to acquire tokens from the distributed token bucket.
   * @returns true if tokens were acquired (request allowed), false otherwise.
   */
  public async acquire(options: RateLimitOptions): Promise<boolean> {
    const { key, capacity, refillRate, cost = 1, ttlSeconds } = options;
    const now = Date.now(); // Current timestamp in milliseconds

    const result = await this.redis.eval(
      this.script,
      1, // Number of keys
      key,
      capacity,
      refillRate,
      now,
      cost,
      ttlSeconds
    );

    return result === 1;
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

  const rateLimiter = new DistributedTokenBucketRedis(redisClient);
  const userId = 'user:789:api';
  const capacity = 5;
  const refillRate = 1; // 1 token per second
  const ttlSeconds = 10; // Key expires after 10 seconds of inactivity

  async function simulateRequests() {
    console.log(`--- Simulating requests for ${userId} (Capacity: ${capacity}, Refill: ${refillRate}/sec) ---`);

    for (let i = 1; i <= 10; i++) {
      const allowed = await rateLimiter.acquire({
        key: userId,
        capacity,
        refillRate,
        ttlSeconds,
      });
      console.log(`Request ${i}: ${allowed ? 'ALLOWED' : 'BLOCKED'}`);
      // Introduce a small delay to see the refill effect
      await new Promise(resolve => setTimeout(resolve, 300));
    }

    console.log("\n--- Waiting for refill ---");
    await new Promise(resolve => setTimeout(resolve, 3000)); // Wait 3 seconds (3 tokens should refill)

    console.log("\n--- Simulating more requests after refill ---");
    for (let i = 11; i <= 15; i++) {
      const allowed = await rateLimiter.acquire({
        key: userId,
        capacity,
        refillRate,
        ttlSeconds,
      });
      console.log(`Request ${i}: ${allowed ? 'ALLOWED' : 'BLOCKED'}`);
      await new Promise(resolve => setTimeout(resolve, 200));
    }

    redisClient.quit();
  }

  simulateRequests().catch(console.error);
}