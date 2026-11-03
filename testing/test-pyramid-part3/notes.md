# The Test Pyramid

## Layers (Bottom → Top)

```
        ┌────────┐
        │  E2E   │  Slowest, most brittle, fewest
        ├────────┤
        │  Integ │  Medium speed, test contracts
        ├────────┤
        │  Unit  │  Fast, isolated, many
        └────────┘
```

## Unit Tests

Test a single function/class in complete isolation. Mock all external dependencies.

**What to test:**
- Pure functions (given input X → output Y)
- Business logic edge cases
- Error branches
- State transitions

**Good unit test properties (F.I.R.S.T):**
- **Fast** — ms-level
- **Isolated** — no network, disk, or DB
- **Repeatable** — same result every run
- **Self-Validating** — clear pass/fail
- **Timely** — written with/before the code

## Integration Tests

Test multiple components together (service + DB, handler + cache).

**What to test:**
- Database queries and transactions
- External service contracts
- Middleware chains
- Authentication flows

**Tip:** Use test containers (PostgreSQL in Docker) for real DB integration tests instead of mocking.

## End-to-End (E2E) Tests

Test the full user journey through the browser or API client.

**Tools:** Playwright, Cypress, Supertest

**Principles:**
- Cover critical user paths only (login, checkout, signup)
- Keep the suite small (<50 tests) and fast (<5 minutes)
- Run in CI on every PR, not in unit test runners

## Test Coverage Misconception

100% coverage ≠ bug-free code. Focus on:
1. **Branch coverage** over line coverage
2. **Mutation testing** (e.g., Stryker) to verify tests actually catch bugs
3. Testing behaviour, not implementation

## Contract Testing

In microservices, use consumer-driven contract tests (Pact) so that:
- Consumer defines what it expects from the provider
- Provider verifies it meets all consumers' contracts
- Prevents breaking API changes silently
