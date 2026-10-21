/**
 * linearizable-counter-example.ts
 * Illustrates the concept of a linearizable counter using a simplified distributed lock model.
 * In a linearizable system, operations appear to execute instantaneously and atomically in a global real-time order.
 * This simulation uses a mutex-like approach to enforce this global order for a shared counter.
 *
 * NOTE: This is a simplified, single-process simulation of linearizability principles.
 * A true distributed linearizable system would involve complex distributed consensus protocols
 * (e.g., Paxos, Raft) or a dedicated distributed lock service (e.g., ZooKeeper, Redis with Redlock).
 */

class LinearizableCounter {
    private count: number = 0;
    private lock: boolean = false; // Simulates a distributed lock status
    private waitingQueue: (() => void)[] = []; // Queue for operations waiting for the lock

    /**
     * Simulates acquiring a distributed lock.
     * In a real system, this would involve network calls and a consensus protocol.
     */
    private async acquireLock(): Promise<void> {
        return new Promise<void>(resolve => {
            if (!this.lock) {
                this.lock = true;
                // console.log("Lock acquired.");
                resolve();
            } else {
                // If lock is held, add current operation to a waiting queue
                this.waitingQueue.push(() => {
                    this.lock = true;
                    // console.log("Lock acquired from queue.");
                    resolve();
                });
            }
        });
    }

    /**
     * Simulates releasing a distributed lock.
     * Notifies the next waiting operation if any.
     */
    private releaseLock(): void {
        this.lock = false;
        // console.log("Lock released.");
        if (this.waitingQueue.length > 0) {
            const next = this.waitingQueue.shift();
            if (next) {
                // Execute the next waiting operation immediately
                process.nextTick(next); // Use process.nextTick for immediate execution after current stack clears
            }
        }
    }

    /**
     * Atomically increments the counter. This operation is linearizable.
     * Any read after this increment (from any client) will see the new value.
     */
    public async increment(clientId: string): Promise<number> {
        await this.acquireLock();
        try {
            const oldValue = this.count;
            this.count++;
            console.log(`[Client ${clientId}] Incremented. Old: ${oldValue}, New: ${this.count}`);
            return this.count;
        } finally {
            this.releaseLock();
        }
    }

    /**
     * Atomically reads the counter's current value. This operation is linearizable.
     * It will always return the most recently written value.
     */
    public async get(clientId: string): Promise<number> {
        await this.acquireLock();
        try {
            const value = this.count;
            console.log(`[Client ${clientId}] Read count: ${value}`);
            return value;
        } finally {
            this.releaseLock();
        }
    }
}

/**
 * Runs a demonstration of the LinearizableCounter.
 * Simulates multiple clients performing interleaved operations.
 */
async function runLinearizableDemo() {
    console.log("\n--- Linearizable Counter Demo ---");
    const counter = new LinearizableCounter();

    const clientIds = ["A", "B", "C", "D"];

    // Simulate interleaved operations from multiple clients.
    // Even though these promises are started concurrently, the internal locking
    // ensures that they execute sequentially, providing linearizability.
    const operations = [
        counter.increment(clientIds[0]),
        counter.get(clientIds[1]),
        counter.increment(clientIds[2]),
        counter.get(clientIds[0]),
        counter.increment(clientIds[1]),
        counter.get(clientIds[3]),
        counter.increment(clientIds[3]),
        counter.get(clientIds[2])
    ];

    // Execute all operations concurrently using Promise.all.
    // The output will show that reads always reflect the most recent write
    // according to a single, global, real-time order.
    await Promise.all(operations);

    console.log(`Final count: ${await counter.get("Demo_Final")}`);
    console.log("--- End Linearizable Counter Demo ---");
}

runLinearizableDemo();
