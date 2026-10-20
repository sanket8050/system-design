// Optimistic locking simulation with version columns

interface Record {
  id: number;
  data: string;
  version: number;
}

class InMemoryTable {
  private rows = new Map<number, Record>();

  insert(record: Record): void {
    this.rows.set(record.id, { ...record });
  }

  select(id: number): Record | undefined {
    const r = this.rows.get(id);
    return r ? { ...r } : undefined;
  }

  // Returns true if update succeeded, false if version conflict
  optimisticUpdate(id: number, data: string, expectedVersion: number): boolean {
    const current = this.rows.get(id);
    if (!current) throw new Error(`Row ${id} not found`);

    if (current.version !== expectedVersion) {
      return false; // version mismatch — concurrent update detected
    }

    this.rows.set(id, { ...current, data, version: current.version + 1 });
    return true;
  }
}

// Simulate two concurrent transactions
const table = new InMemoryTable();
table.insert({ id: 1, data: 'original', version: 1 });

// T1 reads
const t1Read = table.select(1)!;
// T2 reads the same row concurrently
const t2Read = table.select(1)!;

// T2 commits first
const t2Success = table.optimisticUpdate(1, 'updated-by-t2', t2Read.version);
console.assert(t2Success, 'T2 should succeed');

// T1 tries to commit but version has changed
const t1Success = table.optimisticUpdate(1, 'updated-by-t1', t1Read.version);
console.assert(!t1Success, 'T1 should fail with version conflict');

// T1 retries with fresh read
const t1Retry = table.select(1)!;
const t1RetrySuccess = table.optimisticUpdate(1, 'updated-by-t1-retry', t1Retry.version);
console.assert(t1RetrySuccess, 'T1 retry should succeed');

const final = table.select(1)!;
console.assert(final.version === 3, `Expected version 3, got ${final.version}`);
console.assert(final.data === 'updated-by-t1-retry');
console.log('Optimistic locking simulation passed');
