/**
 * eventual-consistency-simulation.ts
 * Simulates a basic eventually consistent key-value store across multiple nodes.
 * Demonstrates how reads can be stale immediately after a write but eventually converge.
 */

interface DataStore {
    [key: string]: string;
}

/**
 * Represents a single node in a distributed key-value store.
 * Each node maintains its own local copy of the data.
 */
class Node {
    private store: DataStore = {};
    private nodeId: string;

    constructor(id: string) {
        this.nodeId = id;
    }

    /**
     * Writes a key-value pair to this node's local store.
     * In a real system, this would trigger asynchronous replication to other nodes.
     */
    write(key: string, value: string): void {
        this.store[key] = value;
        console.log(`[Node ${this.nodeId}] Wrote '${value}' to '${key}'.`);
    }

    /**
     * Reads a value from this node's local store.
     * The value might be stale if other nodes have more recent updates that haven't propagated yet.
     */
    read(key: string): string | undefined {
        const value = this.store[key];
        console.log(`[Node ${this.nodeId}] Read '${value || 'undefined'}' from '${key}'.`);
        return value;
    }

    /**
     * Simulates a simplistic synchronization process where this node pulls updates
     * from another node's store. In a real system, this would be a more complex
     * merge process (e.g., using vector clocks, CRDTs, or timestamps).
     */
    sync(otherNodeStore: DataStore): void {
        console.log(`[Node ${this.nodeId}] Syncing from another node...`);
        let updatedCount = 0;
        for (const key in otherNodeStore) {
            // For simplicity: if the other node has a value, we take it.
            // This implies a 'last-writer-wins' if we assume the 'otherNodeStore'
            // is more recent or authoritative for this sync.
            if (this.store[key] !== otherNodeStore[key]) {
                this.store[key] = otherNodeStore[key];
                updatedCount++;
            }
        }
        if (updatedCount > 0) {
            console.log(`[Node ${this.nodeId}] Synced ${updatedCount} updates.`);
        } else {
            console.log(`[Node ${this.nodeId}] No new updates during sync.`);
        }
    }

    // Expose store for simulation purposes (not typical in real node implementation)
    public getStore(): DataStore {
        return { ...this.store };
    }
}

/**
 * Represents a client interacting with the distributed system.
 */
class Client {
    private id: string;

    constructor(id: string) {
        this.id = id;
    }

    /**
     * Performs a series of operations to demonstrate eventual consistency.
     */
    async performEventuallyConsistentOps(nodes: Node[]): Promise<void> {
        const key = "userProfile";
        const initialValue = "status:online";
        const updatedValue = "status:away";

        console.log(`\n--- Client ${this.id}: Starting Eventual Consistency Demo ---`);

        const nodeA = nodes[0]; // Node for primary writes
        const nodeB = nodes[1]; // Node for potentially stale reads
        const nodeC = nodes[2]; // Another node for comparison

        // 1. Client writes to Node A
        console.log(`\nClient ${this.id}: Writing initial value to Node ${nodeA['nodeId']}.`);
        nodeA.write(key, initialValue);

        // Simulate a short network delay for potential replication
        await new Promise(resolve => setTimeout(resolve, 50));

        // 2. Client reads from Node B immediately after write to Node A
        // Node B might not have received the update yet.
        console.log(`\nClient ${this.id}: Reading from Node ${nodeB['nodeId']} immediately after write.`);
        let readValue = nodeB.read(key);
        console.log(`Client ${this.id}: Read value from Node ${nodeB['nodeId']}: '${readValue || 'undefined'}'. (Expected: '${initialValue}' but might be stale)`);

        // 3. Node A updates the value
        console.log(`\nClient ${this.id}: Writing updated value to Node ${nodeA['nodeId']}.`);
        nodeA.write(key, updatedValue);

        // Simulate a longer delay for replication to *eventually* propagate
        await new Promise(resolve => setTimeout(resolve, 150));

        // 4. Manually trigger sync for demonstration purposes.
        // In a real system, nodes would constantly gossip or pull updates.
        console.log(`\nClient ${this.id}: Manually triggering syncs for demonstration.`);
        nodeB.sync(nodeA.getStore()); // Node B syncs from Node A
        nodeC.sync(nodeA.getStore()); // Node C syncs from Node A

        await new Promise(resolve => setTimeout(resolve, 50)); // Allow sync to "settle"

        // 5. Client reads from Node B and Node C again (should now be eventually consistent)
        console.log(`\nClient ${this.id}: Reading from Node ${nodeB['nodeId']} and Node ${nodeC['nodeId']} after sync delay.`);
        readValue = nodeB.read(key);
        console.log(`Client ${this.id}: Read value from Node ${nodeB['nodeId']}: '${readValue || 'undefined'}'. (Expected: '${updatedValue}')`);

        readValue = nodeC.read(key);
        console.log(`Client ${this.id}: Read value from Node ${nodeC['nodeId']}: '${readValue || 'undefined'}'. (Expected: '${updatedValue}')`);

        console.log(`\n--- Client ${this.id}: Eventual Consistency Demo Finished ---`);
    }
}

// --- Demo Setup ---
const node1 = new Node("A");
const node2 = new Node("B");
const node3 = new Node("C");
const client1 = new Client("User1");

client1.performEventuallyConsistentOps([node1, node2, node3]);
