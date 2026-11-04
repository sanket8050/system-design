# .dockerignore
node_modules
.git
.env
.env.local
*.log
coverage
.next
dist
*.test.ts
*.spec.ts
__tests__
.github
README.md

---
# docker-compose.yml (development with hot reload)
version: '3.9'

services:
  app:
    build:
      context: .
      dockerfile: Dockerfile
      target: builder   # use the builder stage for dev
    ports:
      - '3000:3000'
    volumes:
      - .:/app
      - /app/node_modules  # preserve container's node_modules
    environment:
      NODE_ENV: development
      DATABASE_URL: postgres://dev:dev@db:5432/appdb
    depends_on:
      db:
        condition: service_healthy
    command: npm run dev

  db:
    image: postgres:16-alpine
    environment:
      POSTGRES_USER: dev
      POSTGRES_PASSWORD: dev
      POSTGRES_DB: appdb
    ports:
      - '5432:5432'
    volumes:
      - pgdata:/var/lib/postgresql/data
    healthcheck:
      test: ['CMD-SHELL', 'pg_isready -U dev -d appdb']
      interval: 5s
      timeout: 5s
      retries: 5

volumes:
  pgdata:
