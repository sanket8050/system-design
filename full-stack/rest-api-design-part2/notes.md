# REST API Design Principles

## Resource Naming

- Use **nouns**, not verbs: `/orders` not `/getOrders`
- Use **plural nouns**: `/users`, `/products`
- Nest related resources: `/users/:userId/orders`
- Avoid deep nesting > 2 levels: prefer `/orders?userId=123`

## HTTP Methods

| Method | Usage | Idempotent? | Safe? |
|--------|-------|-------------|-------|
| GET | Retrieve resource | ✅ | ✅ |
| POST | Create resource | ❌ | ❌ |
| PUT | Replace resource entirely | ✅ | ❌ |
| PATCH | Partial update | ❌ usually | ❌ |
| DELETE | Remove resource | ✅ | ❌ |

## Status Codes

| Code | Meaning | When |
|------|---------|------|
| 200 | OK | Successful GET/PUT/PATCH |
| 201 | Created | Successful POST |
| 204 | No Content | Successful DELETE |
| 400 | Bad Request | Invalid input |
| 401 | Unauthorized | Missing/invalid auth |
| 403 | Forbidden | Authenticated but not allowed |
| 404 | Not Found | Resource doesn't exist |
| 409 | Conflict | Duplicate resource, version mismatch |
| 422 | Unprocessable Entity | Validation failed |
| 429 | Too Many Requests | Rate limited |
| 500 | Internal Server Error | Unexpected server failure |

## Versioning Strategies

1. **URL path**: `/v1/users` — explicit, easy to route. Most common.
2. **Header**: `Accept: application/vnd.api.v1+json` — clean URLs.
3. **Query param**: `/users?version=1` — avoid (cacheable resources may cache wrong version).

## Pagination

Prefer cursor-based pagination over offset for large, frequently-updated datasets:

```json
{
  "data": [...],
  "meta": {
    "nextCursor": "eyJpZCI6MTAwfQ",
    "hasNextPage": true,
    "total": 5000
  }
}
```

## Error Response Format

```json
{
  "error": {
    "code": "VALIDATION_FAILED",
    "message": "Email address is invalid",
    "details": [{ "field": "email", "issue": "must be a valid email" }],
    "requestId": "req_abc123"
  }
}
```
