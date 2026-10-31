import { Request, Response, NextFunction } from 'express';
import Redis from 'ioredis'; // Using ioredis for Redis client

/**
 * Configuration for the idempotency middleware.
 */
interface IdempotencyMiddlewareOptions {
  redisClient: Redis; // Pre-configured Redis client
  ttlSeconds?: number; // Time-to-live for idempotency keys in Redis (default: 60 minutes)
  headerName?: string; // Name of the idempotency key header (default: 'Idempotency-Key')
  statusCodesToCache?: number[]; // HTTP status codes for which to cache responses (default: [200, 201, 202, 204])
}

/**
 * Represents a cached response for an idempotent request.
 */
interface CachedResponse {
  statusCode: number;
  headers: Record<string, string | string[]>;
  body: any;
}

// Helper to serialize/deserialize headers correctly
const serializeHeaders = (headers: Record<string, string | string[]>) => {
  const serialized: Record<string, string> = {};
  for (const key in headers) {
    const value = headers[key];
    if (Array.isArray(value)) {
      serialized[key] = value.join(';'); // Or another separator, or JSON.stringify
    } else if (value !== undefined) {
      serialized[key] = String(value);
    }
  }
  return serialized;
};

const deserializeHeaders = (serializedHeaders: Record<string, string>) => {
  const headers: Record<string, string | string[]> = {};
  for (const key in serializedHeaders) {
    headers[key] = serializedHeaders[key];
  }
  return headers;
};

/**
 * Express middleware to enforce idempotency using a Redis cache.
 * It expects an `Idempotency-Key` header in the request.
 *
 * @param options Configuration for the middleware.
 * @returns An Express middleware function.
 */
export function idempotencyKeyMiddleware(options: IdempotencyMiddlewareOptions) {
  const { 
    redisClient,
    ttlSeconds = 60 * 60, // 1 hour
    headerName = 'Idempotency-Key',
    statusCodesToCache = [200, 201, 202, 204]
  } = options;

  return async (req: Request, res: Response, next: NextFunction) => {
    // Only apply to POST, PUT, PATCH requests where idempotency is typically needed
    if (!['POST', 'PUT', 'PATCH'].includes(req.method.toUpperCase())) {
      return next();
    }

    const idempotencyKey = req.headers[headerName.toLowerCase()] as string;

    if (!idempotencyKey) {
      // For idempotent operations, a key is required. Otherwise, it's a non-idempotent operation.
      // Or, you could return a 400 Bad Request if the key is mandatory for the route.
      return next();
    }

    const cacheKey = `idempotency:${idempotencyKey}`;

    try {
      const cachedResult = await redisClient.get(cacheKey);

      if (cachedResult) {
        // Request already processed, return cached response
        const { statusCode, headers, body } = JSON.parse(cachedResult) as CachedResponse;
        res.status(statusCode);
        Object.keys(headers).forEach(headerName => {
          res.setHeader(headerName, headers[headerName]);
        });
        return res.send(body);
      }

      // No cached result, mark key as 'processing' to prevent concurrent processing
      const setNxResult = await redisClient.set(cacheKey, 'processing', 'EX', ttlSeconds, 'NX');

      if (setNxResult === null) {
        // Another request with the same key is already processing or cached
        // You might want to wait and retry, or return a 409 Conflict.
        // For simplicity, we'll return a 409.
        return res.status(409).send({ message: 'Duplicate request already in progress or completed.' });
      }

      // Original request, proceed with processing
      const originalSend = res.send;
      const originalJson = res.json;
      const originalEnd = res.end;
      const originalStatus = res.status;

      let responseBody: any = null;
      let responseStatusCode = 200;
      const responseHeaders: Record<string, string | string[]> = {};

      // Intercept response to cache it
      res.send = function (body?: any) {
        responseBody = body;
        return originalSend.apply(res, arguments as any);
      } as any;

      res.json = function (body?: any) {
        responseBody = body;
        return originalJson.apply(res, arguments as any);
      } as any;

      res.end = function (chunk?: any, encoding?: string) {
        if (chunk) {
          responseBody = chunk.toString(); // Simple handling for non-json bodies
        }
        // Capture status code
        responseStatusCode = res.statusCode;
        // Capture headers
        const headers = res.getHeaders();
        for (const key in headers) { // Clone headers object
            responseHeaders[key] = headers[key];
        }

        // Only cache successful responses
        if (statusCodesToCache.includes(responseStatusCode)) {
          const cachedResponse: CachedResponse = {
            statusCode: responseStatusCode,
            headers: serializeHeaders(responseHeaders),
            body: responseBody,
          };
          // Update the key with the actual response and set TTL
          redisClient.set(cacheKey, JSON.stringify(cachedResponse), 'EX', ttlSeconds)
            .catch(cacheError => console.error('Failed to cache response:', cacheError));
        }

        return originalEnd.apply(res, arguments as any);
      } as any;

      next();

    } catch (error) {
      console.error('Idempotency middleware error:', error);
      // Ensure the processing lock is released if an error occurs before response is sent
      redisClient.del(cacheKey).catch(delError => console.error('Failed to delete idempotency key on error:', delError));
      next(error); // Pass the error to the next error middleware
    }
  };
}

// Example Usage (conceptual)
/*
import express from 'express';

const app = express();
const redis = new Redis(); // Connects to 127.0.0.1:6379 by default

app.use(express.json());

app.post('/orders', idempotencyKeyMiddleware({ redisClient: redis }), async (req, res) => {
  // Simulate order creation logic
  console.log('Processing new order:', req.body);
  const orderId = `order-${Date.now()}`;
  // Simulate some async work
  await new Promise(resolve => setTimeout(resolve, 1000));

  if (Math.random() < 0.2) {
    return res.status(500).json({ message: 'Simulated internal server error' });
  }

  res.status(201).json({ orderId, status: 'created', data: req.body });
});

app.listen(3000, () => {
  console.log('Server running on port 3000');
  console.log('Test with: curl -X POST -H "Content-Type: application/json" -H "Idempotency-Key: <UUID>" -d \'{"item":"Widget"}\' http://localhost:3000/orders');
});
*/
