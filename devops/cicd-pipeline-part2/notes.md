# CI/CD Pipeline Design

## Pipeline Stages

```
Push → Lint & Type Check → Unit Tests → Build → Integration Tests → Deploy (Staging) → Smoke Tests → Deploy (Prod)
```

## Principles

- **Fail fast** — Run the fastest checks first (lint before tests)
- **Cache aggressively** — Cache node_modules between runs
- **Parallelize** — Run independent jobs concurrently
- **Immutable artifacts** — Build once, deploy the same artifact to all envs
- **Secrets via environment variables** — Never hardcode credentials

## GitHub Actions Workflow

```yaml
name: CI/CD Pipeline

on:
  push:
    branches: [main, develop]
  pull_request:
    branches: [main]

env:
  NODE_VERSION: '20'

jobs:
  quality:
    name: Lint & Type Check
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with:
          node-version: ${{ env.NODE_VERSION }}
          cache: 'npm'
      - run: npm ci
      - run: npm run lint
      - run: npm run type-check

  test:
    name: Unit Tests
    runs-on: ubuntu-latest
    needs: quality
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: npm ci
      - run: npm test -- --coverage
      - uses: actions/upload-artifact@v4
        with:
          name: coverage-report
          path: coverage/

  integration:
    name: Integration Tests
    runs-on: ubuntu-latest
    needs: test
    services:
      postgres:
        image: postgres:16-alpine
        env:
          POSTGRES_PASSWORD: test
          POSTGRES_DB: testdb
        options: >-
          --health-cmd pg_isready
          --health-interval 10s
          --health-timeout 5s
          --health-retries 5
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
        with: { node-version: '${{ env.NODE_VERSION }}', cache: 'npm' }
      - run: npm ci
      - run: npm run test:integration
        env:
          DATABASE_URL: postgres://postgres:test@localhost:5432/testdb

  deploy-staging:
    name: Deploy to Staging
    runs-on: ubuntu-latest
    needs: integration
    if: github.ref == 'refs/heads/develop'
    environment: staging
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel deploy --token=${{ secrets.VERCEL_TOKEN }}

  deploy-prod:
    name: Deploy to Production
    runs-on: ubuntu-latest
    needs: integration
    if: github.ref == 'refs/heads/main'
    environment: production
    steps:
      - uses: actions/checkout@v4
      - run: npx vercel deploy --prod --token=${{ secrets.VERCEL_TOKEN }}
```
