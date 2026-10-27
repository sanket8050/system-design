/**
 * @file This file implements a simple Express middleware for handling idempotency keys.
 *       It uses a mock cache (`MockRedisClient`) to simulate storing and retrieving
 *       idempotency key states. In a real application, this would integrate with
 *       a proper distributed cache like Redis.
 */

import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// --- Mock Redis Client for demonstration ---
interface CacheEntry {
  status: 'pending' | 'completed' | 'failed';
  response?: { status: number; body: any };
  requestHash: string; // Hash of the request body/params to ensure consistent requests
  timestamp: number;
}

class MockRedisClient {
  private cache: Map<string, CacheEntry> = new Map();
  private readonly TTL_SECONDS = 60 * 60; // 1 hour for idempotency keys

  async get(key: string): Promise<CacheEntry | undefined> {
    const entry = this.cache.get(key);
    if (entry && (Date.now() - entry.timestamp) / 1000 > this.TTL_SECONDS) {
      this.cache.delete(key); // Expire
      return undefined;
    }
    return entry;
  }

  async set(key: string, value: CacheEntry): Promise<void> {
    this.cache.set(key, { ...value, timestamp: Date.now() });
  }

  async delete(key: string): Promise<void> {
    this.cache.delete(key);
  }
}

const redisClient = new MockRedisClient(); // Singleton mock client

// --- Idempotency Middleware ---

/**
 * Calculates a hash of the request body and query parameters.
 * This is used to ensure that a retried request with the same idempotency key
 * also has the same payload, preventing misuse of keys.
 */
function getRequestHash(req: Request): string {
  const dataToHash = {
    body: req.body,
    query: req.query,
    params: req.params,
    path: req.path,
    method: req.method,
  };
  return crypto.createHash('sha256').update(JSON.stringify(dataToHash)).digest('hex');
}

/**
 * Express middleware to handle idempotency using X-Idempotency-Key header.
 *
 * @param req The Express request object.
 * @param res The Express response object.
 * @param next The next middleware function.
 */
export async function idempotencyMiddleware(req: Request, res: Response, next: NextFunction) {
  const idempotencyKey = req.headers['x-idempotency-key'] as string | undefined;

  if (!idempotencyKey) {
    // No idempotency key provided, proceed as normal.
    // For critical operations, you might want to enforce it.
    return next();
  }

  if (req.method !== 'POST' && req.method !== 'PUT' && req.method !== 'PATCH') {
    // Idempotency is typically for state-changing operations.
    // GET/DELETE are usually idempotent by definition (though DELETE might be tricky).
    return next();
  }

  const requestHash = getRequestHash(req);

  try {
    const cachedEntry = await redisClient.get(idempotencyKey);

    if (cachedEntry) {
      if (cachedEntry.requestHash !== requestHash) {
        // Idempotency key reused with a different request payload.
        // This indicates a potential misuse or a client error.
        console.warn(`[Idempotency] Key ${idempotencyKey} reused with different request payload.`);
        return res.status(400).json({
          error: 'Idempotency key already used with a different request. Please generate a new key.',
        });
      }

      switch (cachedEntry.status) {
        case 'completed':
          console.log(`[Idempotency] Key ${idempotencyKey} already completed. Returning cached response.`);
          return res.status(cachedEntry.response?.status || 200).send(cachedEntry.response?.body);
        case 'pending':
          console.log(`[Idempotency] Key ${idempotencyKey} is in progress. Rejecting duplicate request.`);
          return res.status(409).json({
            error: 'Request with this idempotency key is already being processed.',
            status: 'pending',
          });
        case 'failed':
          // Optionally, allow retries for failed operations with the same key
          // or return the cached failure. For simplicity, we'll treat as completed failure.
          console.log(`[Idempotency] Key ${idempotencyKey} previously failed. Returning cached failure.`);
          return res.status(cachedEntry.response?.status || 500).send(cachedEntry.response?.body);
      }
    }

    // New idempotency key: Mark as pending and proceed with request processing.
    await redisClient.set(idempotencyKey, { status: 'pending', requestHash });

    // Wrap the original `res.send` and `res.json` methods to capture the response.
    const originalSend = res.send;
    const originalJson = res.json;
    let responseBody: any;
    let responseStatus: number = 200;

    res.send = function (body?: any): Response {
      responseBody = body;
      responseStatus = res.statusCode;
      // Restore original send and call it
      res.send = originalSend;
      return originalSend.apply(res, arguments as any);
    };

    res.json = function (body?: any): Response {
      responseBody = body;
      responseStatus = res.statusCode;
      // Restore original json and call it
      res.json = originalJson;
      return originalJson.apply(res, arguments as any);
    };

    // Proceed to the actual route handler
    next();

    // After the route handler has finished (and sent the response),
    // update the idempotency key status.
    // This is an asynchronous operation, the client won't wait for this.
    res.on('finish', async () => {
      const finalStatus = res.statusCode >= 200 && res.statusCode < 300 ? 'completed' : 'failed';
      await redisClient.set(idempotencyKey, {
        status: finalStatus,
        response: { status: responseStatus, body: responseBody },
        requestHash,
      });
      console.log(`[Idempotency] Key ${idempotencyKey} updated to '${finalStatus}'.`);
    });

    res.on('close', async () => {
      // If connection closes before finish, it means client disconnected.
      // The operation might still be processing on the server.
      // We could have a separate mechanism to handle this (e.g., background job checks).
      // For simplicity, we assume 'finish' covers successful completion or error response.
      // If the operation truly failed to complete, the 'finish' handler won't be called
      // or will capture a non-2xx status code.
      // If a timeout occurred and no response was sent, the key might remain 'pending'
      // until its TTL, which is a reasonable fallback.
    });

  } catch (error) {
    console.error(`[Idempotency] Error processing key ${idempotencyKey}:`, error);
    // If cache operation fails, we should probably allow the request to proceed
    // but log the error prominently, as we've lost idempotency guarantees.
    next();
  }
}
