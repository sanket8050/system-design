import express from 'express';
import { v4 as uuidv4 } from 'uuid';

const app = express();
app.use(express.json());

// Simulate a database/cache for idempotency keys and processed orders
interface ProcessedRequest {
    status: 'success' | 'failed' | 'pending';
    result: any;
    timestamp: number;
}
const idempotencyStore = new Map<string, ProcessedRequest>();
const ordersDb = new Map<string, any>(); // Simulate actual orders storage

// Configuration for idempotency key expiration
const IDEMPOTENCY_KEY_EXPIRATION_MS = 1000 * 60 * 60; // 1 hour

/**
 * Simulates the core business logic for processing an order.
 * This function might fail or succeed randomly to demonstrate retry scenarios.
 */
async function processOrderLogic(orderData: any): Promise<any> {
    return new Promise((resolve, reject) => {
        const delay = Math.random() * 500 + 100; // Simulate 100-600ms processing time
        setTimeout(() => {
            if (Math.random() > 0.8) { // Simulate 20% failure rate
                reject(new Error('Payment processing failed unexpectedly.'));
            } else {
                const orderId = uuidv4();
                const processedOrder = {
                    orderId,
                    ...orderData,
                    status: 'completed',
                    processedAt: new Date().toISOString()
                };
                ordersDb.set(orderId, processedOrder);
                resolve(processedOrder);
            }
        }, delay);
    });
}

/**
 * API endpoint for creating orders with idempotency protection.
 * Expects an 'X-Idempotency-Key' header.
 */
app.post('/orders', async (req, res) => {
    const idempotencyKey = req.headers['x-idempotency-key'] as string;
    const orderData = req.body;

    if (!idempotencyKey) {
        return res.status(400).json({ message: 'X-Idempotency-Key header is required.' });
    }

    const existingRequest = idempotencyStore.get(idempotencyKey);

    if (existingRequest) {
        // Check if the existing request is still valid (not expired)
        if (Date.now() - existingRequest.timestamp < IDEMPOTENCY_KEY_EXPIRATION_MS) {
            console.log(`[${idempotencyKey}] Returning cached result for status: ${existingRequest.status}`);
            if (existingRequest.status === 'success') {
                return res.status(200).json(existingRequest.result); // Return 200 OK for successful re-attempts
            } else if (existingRequest.status === 'pending') {
                // If a request with this key is already being processed, return a conflict.
                // Client should ideally wait and retry or handle this as a concurrent attempt.
                return res.status(409).json({ message: 'Request is currently being processed. Please retry later.' });
            } else { // existingRequest.status === 'failed'
                // For a failed request, we might want to allow a retry with the same key
                // or require a new key. For this example, we'll return the original failure.
                // In a real-world scenario, you might clear the failed state to allow a retry.
                return res.status(500).json({ message: 'Previous attempt with this key failed.', error: existingRequest.result });
            }
        } else {
            console.log(`[${idempotencyKey}] Expired key detected, re-processing.`);
            idempotencyStore.delete(idempotencyKey); // Clear expired entry to allow fresh processing
        }
    }

    // Mark as pending before actual processing to handle concurrent requests with the same key
    idempotencyStore.set(idempotencyKey, { status: 'pending', result: null, timestamp: Date.now() });
    console.log(`[${idempotencyKey}] Starting new order processing.`);

    try {
        const result = await processOrderLogic(orderData);
        idempotencyStore.set(idempotencyKey, { status: 'success', result, timestamp: Date.now() });
        console.log(`[${idempotencyKey}] Order processed successfully.`);
        return res.status(201).json(result); // 201 Created for the first successful attempt
    } catch (error: any) {
        idempotencyStore.set(idempotencyKey, { status: 'failed', result: error.message, timestamp: Date.now() });
        console.error(`[${idempotencyKey}] Order processing failed: ${error.message}`);
        return res.status(500).json({ message: 'Failed to process order.', error: error.message });
    }
});

const PORT = 3000;
app.listen(PORT, () => {
    console.log(`Order service listening on port ${PORT}`);
    console.log('\n--- Test Scenarios ---');
    console.log('1. First request (success):');
    console.log(`   curl -X POST -H "Content-Type: application/json" -H "X-Idempotency-Key: \$(uuidgen)" -d '{"items": ["Laptop", "Mouse"], "amount": 1200}' http://localhost:${PORT}/orders`);
    console.log('\n2. Retrying the same request (same key, returns cached result):');
    console.log(`   # Run the command from scenario 1, then immediately run it again with the same X-Idempotency-Key`);
    console.log('\n3. Retrying a failed request (same key, returns original error):');
    console.log(`   # Repeatedly run a request with a fixed X-Idempotency-Key until it fails, then run it again.`);
    console.log(`   # Example: KEY="\$(uuidgen)"; for i in \$(seq 1 5); do echo "Attempt \$i"; curl -X POST -H "Content-Type: application/json" -H "X-Idempotency-Key: \$KEY" -d '{"items": ["Keyboard"], "amount": 150}' http://localhost:${PORT}/orders; done`);
    console.log('\n4. Concurrent requests (same key, one will be pending):');
    console.log(`   # KEY="\$(uuidgen)"; curl -X POST -H "Content-Type: application/json" -H "X-Idempotency-Key: \$KEY" -d '{"items": ["Monitor"], "amount": 300}' http://localhost:${PORT}/orders & curl -X POST -H "Content-Type: application/json" -H "X-Idempotency-Key: \$KEY" -d '{"items": ["Monitor"], "amount": 300}' http://localhost:${PORT}/orders`);
});
