import { Request, Response, NextFunction } from 'express';
import crypto from 'crypto';

// In a real application, this would be a persistent store like Redis or a database.
// Using an in-memory map for demonstration purposes.
interface IdempotencyRecord {
  status: 'processing' | 'completed';
  response?: { statusCode: number; body: any; headers: Record<string, string> };
  requestHash: string;
  createdAt: number;
}

// Max age for idempotency keys (e.g., 24 hours)
const IDEMPOTENCY_KEY_TTL = 24 * 60 * 60 * 1000;
const idempotencyStore = new Map<string, IdempotencyRecord>();

/**
 * Calculates a hash of the request body and URL to detect changes in retried requests.
 * @param req Express Request object
 * @returns SHA256 hash string
 */
function getRequestHash(req: Request): string {
  const bodyString = JSON.stringify(req.body || {});
  const url = req.originalUrl || req.url;
  const dataToHash = `${req.method}:${url}:${bodyString}`;
  return crypto.createHash('sha256').update(dataToHash).digest('hex');
}

/**
 * Express middleware to enforce request idempotency using an 'X-Idempotency-Key' header.
 *
 * - If a key is present and processing, returns 409 Conflict.
 * - If a key is present and completed, returns the cached response.
 * - If a key is new, marks it as processing, executes the request, then stores the result.
 *
 * This is a simplified example. A production implementation would use a robust, distributed store
 * and handle edge cases like concurrent requests for the same key more gracefully (e.g., locking).
 */
export const idempotencyMiddleware = async (
  req: Request,
  res: Response,
  next: NextFunction
) => {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  if (!idempotencyKey) {
    return next(); // No idempotency key, proceed as normal
  }

  const currentRequestHash = getRequestHash(req);
  const existingRecord = idempotencyStore.get(idempotencyKey);

  // Clean up expired records (simple garbage collection)
  if (existingRecord && (Date.now() - existingRecord.createdAt) > IDEMPOTENCY_KEY_TTL) {
    console.log(`[Idempotency] Cleaning up expired key: ${idempotencyKey}`);
    idempotencyStore.delete(idempotencyKey);
  }

  if (existingRecord) {
    if (existingRecord.requestHash !== currentRequestHash) {
      // Request body/URL changed for the same idempotency key. This is an error.
      return res.status(400).send({
        error: 'Idempotency key used with a different request payload.',
        idempotencyKey,
      });
    }

    if (existingRecord.status === 'processing') {
      // Request is already being processed with this key
      return res.status(409).send({
        error: 'Request with this idempotency key is already processing.',
        idempotencyKey,
      });
    } else if (existingRecord.status === 'completed') {
      // Request was already completed, return cached response
      console.log(`[Idempotency] Returning cached response for key: ${idempotencyKey}`);
      if (existingRecord.response) {
        Object.keys(existingRecord.response.headers).forEach(headerName => {
          res.setHeader(headerName, existingRecord.response!.headers[headerName]);
        });
        return res.status(existingRecord.response.statusCode).send(existingRecord.response.body);
      }
    }
  }

  // New key or expired key. Mark as processing.
  idempotencyStore.set(idempotencyKey, {
    status: 'processing',
    requestHash: currentRequestHash,
    createdAt: Date.now(),
  });
  console.log(`[Idempotency] Key ${idempotencyKey} marked as processing.`);

  // Override res.send and res.json to capture the response
  const originalSend = res.send;
  const originalJson = res.json;
  let responseBody: any;
  let responseStatusCode: number = 200;
  const responseHeaders: Record<string, string> = {};

  res.send = function (body?: any) {
    responseBody = body;
    responseStatusCode = res.statusCode;
    res.getHeaders().forEach((value, name) => {
      if (typeof value === 'string') {
        responseHeaders[name] = value;
      }
    });
    return originalSend.apply(res, arguments as any);
  };

  res.json = function (body?: any) {
    responseBody = body;
    responseStatusCode = res.statusCode;
    res.getHeaders().forEach((value, name) => {
      if (typeof value === 'string') {
        responseHeaders[name] = value;
      }
    });
    return originalJson.apply(res, arguments as any);
  };

  // Proceed with the actual request handling
  await new Promise<void>((resolve) => next(resolve));

  // After the request handler finishes, store the result if successful
  const record = idempotencyStore.get(idempotencyKey);
  if (record && record.status === 'processing') {
    idempotencyStore.set(idempotencyKey, {
      ...record,
      status: 'completed',
      response: { statusCode: responseStatusCode, body: responseBody, headers: responseHeaders },
    });
    console.log(`[Idempotency] Key ${idempotencyKey} completed and response cached.`);
  }
};

// Example usage (not part of the file, just for context):
/*
import express from 'express';
const app = express();
app.use(express.json());
app.use(idempotencyMiddleware);

app.post('/payments', async (req, res) => {
  console.log(`Processing payment for: ${req.body.amount}`);
  // Simulate async operation
  await new Promise(resolve => setTimeout(resolve, 1000));
  res.status(201).json({ message: 'Payment processed successfully', transactionId: 'txn_123' });
});

app.listen(3000, () => console.log('Server running on port 3000'));
*/
