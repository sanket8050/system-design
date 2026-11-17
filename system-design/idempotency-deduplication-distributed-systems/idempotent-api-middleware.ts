import { Request, Response, NextFunction } from 'express';

// Mock IdempotencyStore - In a real system, this would be Redis, a database, etc.
interface IdempotencyRecord {
  status: number;
  headers: Record<string, string>;
  body: any;
  timestamp: number;
}

const idempotencyStore = new Map<string, IdempotencyRecord>();

/**
 * Middleware to ensure API requests are idempotent using an 'X-Idempotency-Key' header.
 * Records successful responses to prevent re-processing identical requests.
 */
export const idempotentRequestMiddleware = async (req: Request, res: Response, next: NextFunction) => {
  const idempotencyKey = req.headers['x-idempotency-key'] as string;

  if (!idempotencyKey) {
    // If no key, proceed as normal. Not all endpoints require idempotency.
    return next();
  }

  // Check if we've already processed this key
  const storedResponse = idempotencyStore.get(idempotencyKey);

  if (storedResponse) {
    console.log(`[Idempotency] Returning stored response for key: ${idempotencyKey}`);
    // Replay the stored response
    res.status(storedResponse.status);
    Object.entries(storedResponse.headers).forEach(([key, value]) => {
      res.setHeader(key, value);
    });
    return res.send(storedResponse.body);
  }

  // Mark the key as 'processing' to prevent concurrent identical requests
  // For simplicity, we'll store a placeholder. A real system might use a distributed lock.
  // idempotencyStore.set(idempotencyKey, { status: 202, headers: {}, body: { message: 'Processing' }, timestamp: Date.now() });

  // Override res.send to capture the response before sending
  const originalSend = res.send;
  res.send = (body?: any) => {
    const responseRecord: IdempotencyRecord = {
      status: res.statusCode,
      headers: res.getHeaders() as Record<string, string>,
      body: body,
      timestamp: Date.now(),
    };
    idempotencyStore.set(idempotencyKey, responseRecord);
    console.log(`[Idempotency] Stored response for key: ${idempotencyKey}`);
    return originalSend.call(res, body);
  };

  // Override res.json as well, as it's a common method
  const originalJson = res.json;
  res.json = (body?: any) => {
    const responseRecord: IdempotencyRecord = {
      status: res.statusCode,
      headers: res.getHeaders() as Record<string, string>,
      body: body,
      timestamp: Date.now(),
    };
    idempotencyStore.set(idempotencyKey, responseRecord);
    console.log(`[Idempotency] Stored JSON response for key: ${idempotencyKey}`);
    return originalJson.call(res, body);
  };

  next();
};

// Example usage (conceptual, assuming an Express app)
/*
import express from 'express';
const app = express();
app.use(express.json());
app.use(idempotentRequestMiddleware);

app.post('/orders', (req, res) => {
  // In a real app, validate input, perform business logic, save to DB
  const orderId = `order_${Date.now()}`;
  console.log(`Processing new order: ${orderId} with data:`, req.body);
  res.status(201).json({ message: 'Order created successfully', orderId });
});

app.listen(3000, () => console.log('Server running on port 3000'));

// To test:
// curl -X POST -H "Content-Type: application/json" -H "X-Idempotency-Key: abc-123" -d '{"item":"Laptop", "quantity":1}' http://localhost:3000/orders
// Run the same curl command multiple times. Only the first should trigger 'Processing new order'.
*/
