/**
 * Sliding Window Counter Rate Limiter
 *
 * More accurate than fixed-window: prevents burst at window boundaries.
 * Redis ZSET-based design (simulated in-memory here).
 */
export class SlidingWindowRateLimiter {
  // userId -> sorted list of request timestamps (ms)
  private readonly store = new Map<string, number[]>();
  private readonly limitPerWindow: number;
  private readonly windowMs: number;

  constructor(limitPerWindow: number, windowMs: number) {
    this.limitPerWindow = limitPerWindow;
    this.windowMs = windowMs;
  }

  isAllowed(userId: string, nowMs = Date.now()): boolean {
    const windowStart = nowMs - this.windowMs;
    const timestamps = (this.store.get(userId) ?? []).filter(t => t > windowStart);

    if (timestamps.length >= this.limitPerWindow) {
      this.store.set(userId, timestamps);
      return false;
    }

    timestamps.push(nowMs);
    this.store.set(userId, timestamps);
    return true;
  }

  remaining(userId: string, nowMs = Date.now()): number {
    const windowStart = nowMs - this.windowMs;
    const active = (this.store.get(userId) ?? []).filter(t => t > windowStart);
    return Math.max(0, this.limitPerWindow - active.length);
  }

  retryAfterMs(userId: string, nowMs = Date.now()): number {
    const windowStart = nowMs - this.windowMs;
    const active = (this.store.get(userId) ?? []).filter(t => t > windowStart).sort((a, b) => a - b);
    if (active.length < this.limitPerWindow) return 0;
    // When oldest request expires, a slot opens up
    return active[0] + this.windowMs - nowMs;
  }
}
