/**
 * Day 49: Fixed Window Rate Limiter Implementation
 *
 * Implements a basic in-memory Fixed Window Counter algorithm.
 * Requests are allowed until a limit is reached within a fixed time window.
 * The counter resets at the start of each new window.
 */
class FixedWindowRateLimiter {
  private limit: number; // Maximum requests allowed within the window
  private windowDurationMs: number; // Duration of the window in milliseconds
  private requestCounts: Map<string, { count: number; windowStartTime: number }>; // Stores counts per key

  /**
   * @param limit The maximum number of requests allowed per window.
   * @param windowDurationMs The duration of the window in milliseconds.
   */
  constructor(limit: number, windowDurationMs: number) {
    if (limit <= 0 || windowDurationMs <= 0) {
      throw new Error("Limit and window duration must be positive.");
    }
    this.limit = limit;
    this.windowDurationMs = windowDurationMs;
    this.requestCounts = new Map();
  }

  /**
   * Attempts to consume a request for a given key (e.g., user ID, IP address).
   *
   * @param key The identifier for which to apply the rate limit.
   * @returns True if the request is allowed, false otherwise.
   */
  public tryConsume(key: string): boolean {
    const now = Date.now();
    let entry = this.requestCounts.get(key);

    if (!entry || now >= entry.windowStartTime + this.windowDurationMs) {
      // Either no entry exists, or the current window has expired.
      // Start a new window.
      entry = { count: 0, windowStartTime: now };
      this.requestCounts.set(key, entry);
    }

    if (entry.count < this.limit) {
      entry.count++;
      return true;
    } else {
      return false; // Limit exceeded
    }
  }

  /**
   * Clears the rate limit state for a specific key.
   * @param key The identifier to clear.
   */
  public clear(key: string): void {
    this.requestCounts.delete(key);
  }

  /**
   * Clears all rate limit states.
   */
  public clearAll(): void {
    this.requestCounts.clear();
  }

  /**
   * Gets the current count and window start time for a key.
   * Useful for inspection, not typically part of the core algorithm.
   */
  public getStatus(key: string): { count: number; windowStartTime: number } | undefined {
    return this.requestCounts.get(key);
  }
}

// --- Example Usage ---
// Limit to 5 requests per 10-second window for each user.
const userRateLimiter = new FixedWindowRateLimiter(5, 10 * 1000); // 5 requests / 10 seconds

console.log("\n--- Fixed Window Rate Limiter Example ---");

const userId1 = "user-abc";
const userId2 = "user-xyz";

console.log(`\n--- User ${userId1} ---`);
for (let i = 0; i < 7; i++) {
  if (userRateLimiter.tryConsume(userId1)) {
    console.log(`Request ${i + 1} for ${userId1}: ALLOWED`);
  } else {
    console.log(`Request ${i + 1} for ${userId1}: DENIED`);
  }
}

console.log(`\n--- User ${userId2} (separate limit) ---`);
for (let i = 0; i < 3; i++) {
  if (userRateLimiter.tryConsume(userId2)) {
    console.log(`Request ${i + 1} for ${userId2}: ALLOWED`);
  } else {
    console.log(`Request ${i + 1} for ${userId2}: DENIED`);
  }
}

// Simulate time passing (e.g., 11 seconds later)
console.log("\nWaiting 11 seconds to reset window...");
setTimeout(() => {
  console.log(`\n--- User ${userId1} after window reset ---`);
  for (let i = 0; i < 3; i++) {
    if (userRateLimiter.tryConsume(userId1)) {
      console.log(`Request ${i + 1} for ${userId1} (after reset): ALLOWED`);
    } else {
      console.log(`Request ${i + 1} for ${userId1} (after reset): DENIED`);
    }
  }
}, 11000);

// To run this:
// 1. Save as `fixed-window-implementation.ts`
// 2. `npx ts-node fixed-window-implementation.ts`
