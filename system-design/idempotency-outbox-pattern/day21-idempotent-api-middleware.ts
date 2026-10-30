import { Request, Response, NextFunction } from 'express';

// In a real application, this would be a distributed cache (e.g., Redis)
// or a dedicated database table with a TTL for idempotency keys.
interface IdempotencyRecord {
  status: number;
  responseBody: any;
  timestamp: number;
}

// Simple in-memory store for demonstration. Not suitable for production.
const idempotencyStore = new Map<string, IdempotencyRecord>();

// Configure TTL for idempotency keys (e.g., 24 hours)
const IDEMPOTENCY_KEY_TTL_MS = 24 * 60 * 60 * 1000;

/**
 * Middleware to ensure API requests are idempotent using an 'X-Idempotency-Key' header.
 *
 * How it works:
 * 1. Checks for 'X-Idempotency-Key' in headers.
 * 2. If present, checks if this key has been seen before and processed successfully.
 * 3. If seen, returns the stored response immediately.
 * 4. If not seen, proceeds with the request, captures the response, stores it with the key,
 *    and then sends it to the client.
 * 5. Handles potential race conditions by setting a processing flag (simplified here).
 */
export const idempotentRequestMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  if (!idempotencyKey) {
    // No idempotency key provided, proceed normally.
    return next();
  }

  // Basic cleanup for expired keys (in a real system, Redis TTL handles this)
  pruneExpiredKeys();

  const existingRecord = idempotencyStore.get(idempotencyKey);

  if (existingRecord) {
    console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
    // Return the cached response for duplicate requests
    return res.status(existingRecord.status).json(existingRecord.responseBody);
  }

  // Mark the key as 'processing' to prevent concurrent processing of the same key.
  // In a real distributed system, this would require a distributed lock (e.g., Redlock).
  // For this simple example, we'll assume a single instance or that the first request wins.
  // A more robust approach would be to store a 'processing' status in the store.
  idempotencyStore.set(idempotencyKey, { status: 202, responseBody: { message: 'Processing...' }, timestamp: Date.now() });

  // Capture the original response sending function
  const originalSend = res.send;
  const originalJson = res.json;
  const originalStatus = res.status;

  let responseStatus: number = 200;
  let responseBody: any = null;

  // Override res.status to capture the status code
  res.status = function(status: number) {
    responseStatus = status;
    return originalStatus.apply(res, arguments as any);
  };

  // Override res.send to capture the response body
  res.send = function(body?: any) {
    responseBody = body;
    // Store the final response before sending
    idempotencyStore.set(idempotencyKey, { status: responseStatus, responseBody: parseBody(body), timestamp: Date.now() });
    return originalSend.apply(res, arguments as any);
  };

  // Override res.json to capture the response body
  res.json = function(body?: any) {
    responseBody = body;
    // Store the final response before sending
    idempotencyStore.set(idempotencyKey, { status: responseStatus, responseBody: body, timestamp: Date.now() });
    return originalJson.apply(res, arguments as any);
  };

  // Proceed with the actual request handling
  next();
};

function parseBody(body: any): any {
  if (typeof body === 'string') {
    try {
      return JSON.parse(body);
    } catch (e) {
      return body;
    }
  }
  return body;
}

function pruneExpiredKeys() {
  const now = Date.now();
  for (const [key, record] of idempotencyStore.entries()) {
    if (now - record.timestamp > IDEMPOTENCY_KEY_TTL_MS) {
      idempotencyStore.delete(key);
      console.log(`[Idempotency] Pruned expired key: ${key}`);
    }
  }
}

/*
// Example usage with Express:

import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());
app.use(idempotentRequestMiddleware);

// Simulate an order creation endpoint
app.post('/orders', (req, res) => {
  const idempotencyKey = req.headers['x-idempotency-key'];
  console.log(`Processing order with idempotency key: ${idempotencyKey}`);

  // Simulate async work
  setTimeout(() => {
    const orderId = uuidv4();
    res.status(201).json({
      message: 'Order created successfully',
      orderId: orderId,
      idempotencyKey: idempotencyKey
    });
  }, 1000);
});

app.listen(3000, () => {
  console.log('Server running on http://localhost:3000');
  console.log('Test with: curl -X POST -H "X-Idempotency-Key: your-unique-key" -H "Content-Type: application/json" -d \'{}\' http://localhost:3000/orders');
  console.log('Try sending the same request multiple times with the same key.');
});
*/
