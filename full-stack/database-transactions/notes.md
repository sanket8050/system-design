# Database Transactions and ACID

## ACID Properties

| Property | Meaning | Failure Without It |
|----------|---------|-------------------|
| **Atomicity** | All operations succeed or none do | Partial updates corrupt data |
| **Consistency** | Transaction takes DB from valid state to valid state | Referential integrity violations |
| **Isolation** | Concurrent transactions don't interfere | Dirty reads, lost updates |
| **Durability** | Committed data survives crashes | Data loss after crash |

## Isolation Levels

From weakest to strongest:

### Read Uncommitted (Avoid)
Can read uncommitted changes from other transactions.
- Problem: **Dirty reads** (reading data that might be rolled back)

### Read Committed (PostgreSQL default)
Only reads committed data.
- Problem: **Non-repeatable reads** (same row returns different values in same transaction)

### Repeatable Read (MySQL InnoDB default)
Same rows return same data within a transaction.
- Problem: **Phantom reads** (new rows added by another transaction appear in range queries)

### Serializable (Strictest)
Transactions execute as if serial.
- No anomalies but lower throughput.

## Common Concurrency Problems

```
Dirty Read:
  T1: writes X=20 (uncommitted)
  T2: reads X=20
  T1: rolls back → T2 read wrong data

Lost Update:
  T1: reads balance=100, T2: reads balance=100
  T1: writes balance=150, T2: writes balance=80
  → T1's update is lost

Phantom Read:
  T1: SELECT COUNT(*) FROM orders WHERE status='pending' → 5
  T2: INSERT new pending order
  T1: SELECT COUNT(*) WHERE status='pending' → 6
```

## SELECT FOR UPDATE

Locks the selected rows for the duration of the transaction:

```sql
BEGIN;
SELECT balance FROM accounts WHERE id = 1 FOR UPDATE;
-- T2 trying to SELECT FOR UPDATE on id=1 now blocks
UPDATE accounts SET balance = balance - 100 WHERE id = 1;
COMMIT;
```

## Optimistic vs Pessimistic Locking

**Pessimistic**: Lock the row when reading (SELECT FOR UPDATE). Good for high-conflict scenarios.
**Optimistic**: Read without lock, include a `version` column in the UPDATE condition. Retry on conflict. Good for low-conflict scenarios.

```sql
UPDATE products
SET stock = stock - 1, version = version + 1
WHERE id = 42 AND version = 7;
-- If 0 rows updated → conflict, retry
```
