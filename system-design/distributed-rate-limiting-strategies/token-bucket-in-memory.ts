/**
 * token-bucket-in-memory.ts
 *
 * Basic in-memory Token Bucket implementation.
 * Suitable for a single application instance.
 */

class InMemoryTokenBucket {
  private capacity: number;
  private tokens: number;
  private refillRate: number; // tokens per second
  private lastRefillTime: number; // timestamp in milliseconds

  constructor(capacity: number, refillRatePerSecond: number) {
    if (capacity <= 0 || refillRatePerSecond <= 0) {
      throw new Error("Capacity and refill rate must be positive.");
    }
    this.capacity = capacity;
    this.tokens = capacity; // Start with a full bucket
    this.refillRate = refillRatePerSecond;
    this.lastRefillTime = Date.now();
  }

  /**
   * Attempts to consume a token.
   * @returns true if a token was acquired, false otherwise.
   */
  public acquire(): boolean {
    this.refill();

    if (this.tokens >= 1) {
      this.tokens--;
      return true;
    }
    return false;
  }

  /**
   * Refills the bucket based on the elapsed time and refill rate.
   */
  private refill(): void {
    const now = Date.now();
    const elapsedTimeSeconds = (now - this.lastRefillTime) / 1000;

    if (elapsedTimeSeconds > 0) {
      const tokensToAdd = elapsedTimeSeconds * this.refillRate;
      this.tokens = Math.min(this.capacity, this.tokens + tokensToAdd);
      this.lastRefillTime = now;
    }
  }

  /**
   * Get current token count (for debugging/monitoring).
   */
  public getCurrentTokens(): number {
    this.refill(); // Ensure tokens are up-to-date before reporting
    return this.tokens;
  }
}

// --- Example Usage ---
if (require.main === module) {
  const bucket = new InMemoryTokenBucket(5, 1); // Capacity 5, 1 token/sec refill
  console.log("Initial tokens:", bucket.getCurrentTokens()); // 5

  console.log("Acquire 1:", bucket.acquire()); // true, tokens: 4
  console.log("Acquire 2:", bucket.acquire()); // true, tokens: 3
  console.log("Acquire 3:", bucket.acquire()); // true, tokens: 2
  console.log("Acquire 4:", bucket.acquire()); // true, tokens: 1
  console.log("Acquire 5:", bucket.acquire()); // true, tokens: 0
  console.log("Acquire 6:", bucket.acquire()); // false, tokens: 0

  // Simulate passage of time
  setTimeout(() => {
    console.log("\n--- After 2.5 seconds ---");
    // Should have refilled 2.5 tokens, so total tokens should be 2 or 3 (0 + 2.5 = 2.5, capped at 5)
    // Since tokens are integers in this simplified model, it might be 2.
    // Let's refine the model to allow fractional tokens.
    console.log("Current tokens:", bucket.getCurrentTokens()); // Should be ~2.5
    console.log("Acquire after refill:", bucket.acquire()); // true, tokens: ~1.5
    console.log("Current tokens:", bucket.getCurrentTokens());
  }, 2500);

  // Note: For production, consider using a high-resolution timer or
  // a more robust time-tracking mechanism if accuracy is paramount.
}