# Docker Multi-Stage Builds

Multi-stage builds produce lean production images by separating the build environment from the runtime environment.

## Single-Stage Problem

A naive Dockerfile installs dev dependencies, compiles, and ships everything:

```dockerfile
FROM node:20
WORKDIR /app
COPY . .
RUN npm install
RUN npm run build
CMD ["node", "dist/server.js"]
# Image size: ~900MB (includes node_modules, TypeScript compiler, source maps)
```

## Multi-Stage Solution

```dockerfile
# Stage 1: Build
FROM node:20-alpine AS builder
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Stage 2: Production
FROM node:20-alpine AS production
WORKDIR /app
ENV NODE_ENV=production

# Install only production dependencies
COPY package*.json ./
RUN npm ci --omit=dev

# Copy only the compiled output
COPY --from=builder /app/dist ./dist

EXPOSE 3000
USER node
CMD ["node", "dist/server.js"]
```

**Result:** Image shrinks from ~900MB to ~120MB (only runtime deps + compiled JS).

## Docker Layer Caching

Order layers from least to most frequently changed:

```dockerfile
# ✅ Good: dependencies before source code
COPY package*.json ./
RUN npm ci          # cached unless package.json changes
COPY . .
RUN npm run build   # only re-runs when source changes

# ❌ Bad: COPY . . first invalidates npm ci cache on every change
COPY . .
RUN npm ci
```

## Security Best Practices

- Use `USER node` (non-root) — privilege escalation protection
- Use `--omit=dev` in production
- Pin base image digests: `FROM node:20-alpine@sha256:...`
- Use `.dockerignore` to exclude `node_modules`, `.env`, test files
- Scan image with `docker scout` or Trivy

## Health Check

```dockerfile
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:3000/health || exit 1
```
