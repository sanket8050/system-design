/**
 * Day 49: Token Bucket Rate Limiter Implementation
 *
 * Implements a basic in-memory Token Bucket algorithm.
 * Tokens are refilled at a constant rate, and requests consume tokens.
 * Allows for burstiness up to the bucket capacity.
 */
class TokenBucket {
  private capacity: number; // Maximum number of tokens the bucket can hold
  private refillRate: number; // Tokens added per second
  private currentTokens: number; // Current number of tokens in the bucket
  private lastRefillTime: number; // Timestamp of the last refill (milliseconds)

  /**
   * @param capacity The maximum number of tokens the bucket can hold.
   * @param refillRate The rate at which tokens are added to the bucket, per second.
   * @param initialTokens Optional: The starting number of tokens. Defaults to capacity.
   */
  constructor(capacity: number, refillRate: number, initialTokens?: number) {
    if (capacity <= 0 || refillRate <= 0) {
      throw new Error("Capacity and refill rate must be positive.");
    }
    this.capacity = capacity;
    this.refillRate = refillRate;
    this.currentTokens = initialTokens !== undefined ? Math.min(initialTokens, capacity) : capacity;
    this.lastRefillTime = Date.now();
  }

  /**
   * Attempts to consume a specified number of tokens.
   * Automatically refills the bucket before attempting consumption.
   *
   * @param tokensToConsume The number of tokens required for the operation. Defaults to 1.
   * @returns True if tokens were consumed successfully, false otherwise.
   */
  public tryConsume(tokensToConsume: number = 1): boolean {
    if (tokensToConsume <= 0) {
      throw new Error("Tokens to consume must be positive.");
    }

    this.refill(); // Always refill before checking/consuming

    if (this.currentTokens >= tokensToConsume) {
      this.currentTokens -= tokensToConsume;
      return true;
    }
    return false;
  }

  /**
   * Manually refills the bucket based on the time elapsed since the last refill.
   * This method is automatically called by `tryConsume`, but can be called manually if needed.
   */
  private refill(): void {
    const now = Date.now();
    const timeElapsedSeconds = (now - this.lastRefillTime) / 1000; // Convert ms to seconds

    if (timeElapsedSeconds > 0) {
      const tokensToAdd = timeElapsedSeconds * this.refillRate;
      this.currentTokens = Math.min(this.capacity, this.currentTokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  /**
   * Returns the current number of tokens available in the bucket.
   */
  public getCurrentTokens(): number {
    this.refill(); // Ensure current tokens are up-to-date
    return this.currentTokens;
  }

  /**
   * Returns the bucket's capacity.
   */
  public getCapacity(): number {
    return this.capacity;
  }

  /**
   * Returns the bucket's refill rate.
   */
  public getRefillRate(): number {
    return this.refillRate;
  }
}

// --- Example Usage ---
// Limit to 10 requests per second, with a burst capacity of 20 requests.
const apiLimiter = new TokenBucket(20, 10); // Capacity: 20, Refill: 10 tokens/sec

console.log("--- Token Bucket Example ---");

// Initial burst
for (let i = 0; i < 25; i++) {
  if (apiLimiter.tryConsume()) {
    console.log(`Request ${i + 1}: ALLOWED. Tokens left: ${apiLimiter.getCurrentTokens().toFixed(2)}`);
  } else {
    console.log(`Request ${i + 1}: DENIED. Tokens left: ${apiLimiter.getCurrentTokens().toFixed(2)}`);
  }
}

// Wait a bit to allow refill
console.log("\nWaiting 1.5 seconds...");
setTimeout(() => {
  console.log(`\nAfter 1.5 seconds, tokens: ${apiLimiter.getCurrentTokens().toFixed(2)}`);
  for (let i = 0; i < 15; i++) {
    if (apiLimiter.tryConsume()) {
      console.log(`Request ${i + 1} (after wait): ALLOWED. Tokens left: ${apiLimiter.getCurrentTokens().toFixed(2)}`);
    } else {
      console.log(`Request ${i + 1} (after wait): DENIED. Tokens left: ${apiLimiter.getCurrentTokens().toFixed(2)}`);
    }
  }
}, 1500);

// To run this:
// 1. Save as `token-bucket-implementation.ts`
// 2. `npx ts-node token-bucket-implementation.ts`
