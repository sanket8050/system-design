import { Request, Response, NextFunction } from 'express';
import { IdempotencyStore, IdempotencyStatus } from '../utils/database-idempotency-store';

/**
 * Represents the structure of a stored API response.
 */
interface StoredApiResponse {
  statusCode: number;
  headers: Record<string, string | string[] | undefined>;
  body: any;
}

/**
 * Factory function to create an Express-like idempotency middleware.
 * @param idempotencyStore The store to use for tracking idempotency keys.
 * @param ttlSeconds Time-to-live for idempotency keys in seconds (default: 1 hour).
 * @returns An Express-compatible middleware function.
 */
export const createIdempotencyMiddleware = (
  idempotencyStore: IdempotencyStore,
  ttlSeconds: number = 3600 // 1 hour
) => {
  return async (req: Request, res: Response, next: NextFunction) => {
    const idempotencyKey = req.headers['idempotency-key'] as string | undefined;

    // Only apply idempotency to POST/PATCH methods
    if (!idempotencyKey || !['POST', 'PATCH'].includes(req.method.toUpperCase())) {
      return next();
    }

    console.log(`[IdempotencyMiddleware] Processing request with Idempotency-Key: ${idempotencyKey}`);

    try {
      const existingRecord = await idempotencyStore.get(idempotencyKey);

      if (existingRecord) {
        if (existingRecord.status === IdempotencyStatus.COMPLETED) {
          const storedResponse = existingRecord.result as StoredApiResponse;
          console.log(`[IdempotencyMiddleware] Returning cached response for key: ${idempotencyKey}`);
          // Replay the original response
          for (const headerName in storedResponse.headers) {
            const headerValue = storedResponse.headers[headerName];
            if (headerValue !== undefined) {
              res.setHeader(headerName, headerValue);
            }
          }
          return res.status(storedResponse.statusCode).send(storedResponse.body);
        } else if (existingRecord.status === IdempotencyStatus.PENDING) {
          console.warn(`[IdempotencyMiddleware] Concurrent request detected for key: ${idempotencyKey}`);
          return res.status(409).json({ message: 'A request with this idempotency key is already in progress.' });
        }
      }

      // No existing record, or it failed previously (could retry or treat as new)
      // For simplicity, we'll treat a non-existent or failed record as a new attempt.
      // Record pending state
      // In a real scenario, you'd want to store more context like request body/params for validation.
      await idempotencyStore.set(idempotencyKey, IdempotencyStatus.PENDING, null, req.path, req.method);

      // Monkey patch res.send and res.json to capture the response
      const originalSend = res.send;
      const originalJson = res.json;
      const originalEnd = res.end;

      let capturedBody: any;
      let capturedHeaders: Record<string, string | string[] | undefined> = {};

      res.send = function (body?: any) {
        capturedBody = body;
        return originalSend.apply(this, arguments);
      };

      res.json = function (body?: any) {
        capturedBody = body;
        return originalJson.apply(this, arguments);
      };

      res.end = function(chunk?: any, encoding?: BufferEncoding, callback?: (() => void) | undefined) {
        // Capture headers before they are sent
        capturedHeaders = res.getHeaders();
        return originalEnd.apply(this, arguments);
      }

      // Proceed to route handler
      res.on('finish', async () => {
        // After the response is sent, capture its details and store them
        if (res.statusCode >= 200 && res.statusCode < 300) {
          const storedResponse: StoredApiResponse = {
            statusCode: res.statusCode,
            headers: capturedHeaders, // Headers might need careful serialization if complex
            body: capturedBody // Ensure body is serializable
          };
          await idempotencyStore.update(idempotencyKey, IdempotencyStatus.COMPLETED, storedResponse, ttlSeconds);
          console.log(`[IdempotencyMiddleware] Stored successful response for key: ${idempotencyKey}`);
        } else if (res.statusCode >= 400) {
          // For client/server errors, mark as failed, or don't store for retry
          await idempotencyStore.update(idempotencyKey, IdempotencyStatus.FAILED, { message: 'API call failed' }, ttlSeconds);
          console.error(`[IdempotencyMiddleware] Stored failed response for key: ${idempotencyKey}`);
        }
      });

      next();

    } catch (error) {
      console.error(`[IdempotencyMiddleware] Error processing idempotency for key ${idempotencyKey}:`, error);
      // Ensure we don't block the request even if idempotency store fails
      next();
    }
  };
};

// Example of how to use it with Express (conceptual)
/*
import express from 'express';
const app = express();
const idempotencyStore = new IdempotencyStore();

app.use(express.json());
app.use(createIdempotencyMiddleware(idempotencyStore));

app.post('/api/orders', async (req, res) => {
  console.log('Processing new order...');
  // Simulate async work
  await new Promise(resolve => setTimeout(resolve, 1000));
  const orderId = `order_${Date.now()}`;
  res.status(201).json({ message: 'Order created successfully', orderId, data: req.body });
});

app.listen(3000, () => console.log('Server running on port 3000'));

// To test:
// curl -X POST -H "Content-Type: application/json" -H "Idempotency-Key: my-unique-order-key-1" -d '{"item":"Laptop", "quantity":1}' http://localhost:3000/api/orders
// Repeat the curl command with the same key.
*/
