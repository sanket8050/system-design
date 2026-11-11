import { strict as assert } from 'assert';
import { SlidingWindowRateLimiter } from './rate-limiter-sliding-window';

const WINDOW_MS = 60_000; // 1 minute
const LIMIT = 5;
const limiter = new SlidingWindowRateLimiter(LIMIT, WINDOW_MS);

let t = Date.now();

// First 5 requests should pass
for (let i = 0; i < LIMIT; i++) {
  assert(limiter.isAllowed('user:1', t + i * 100), `Request ${i + 1} should be allowed`);
}

// 6th should be denied
assert(!limiter.isAllowed('user:1', t + 600), '6th request must be rate limited');
assert.equal(limiter.remaining('user:1', t + 600), 0);

const retryMs = limiter.retryAfterMs('user:1', t + 600);
assert(retryMs > 0, 'retryAfter must be positive when rate limited');
console.log(`Retry after: ${retryMs}ms`);

// After the window passes, requests should be allowed again
t += WINDOW_MS + 1000;
assert(limiter.isAllowed('user:1', t), 'Should allow after window expires');

// Different user is independent
assert(limiter.isAllowed('user:2', Date.now()), 'Different user should not be rate limited');

console.log('Sliding window rate limiter tests passed');
