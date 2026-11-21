# Input Validation and Injection Prevention

## SQL Injection

**Vulnerable:**
```typescript
const query = `SELECT * FROM users WHERE email = '${email}'`;
// Input: ' OR '1'='1 → returns all users
```

**Safe (parameterized queries):**
```typescript
const result = await db.query('SELECT * FROM users WHERE email = $1', [email]);
```

Never interpolate user input into SQL strings. Always use prepared statements or an ORM that parameterizes automatically.

## XSS (Cross-Site Scripting)

**Types:**
- **Stored XSS** — malicious script saved to DB, executed when other users view
- **Reflected XSS** — script in URL parameter, reflected in response
- **DOM XSS** — script injected via client-side JS without server involvement

**Prevention:**
- React/Vue escape output by default (use `dangerouslySetInnerHTML` cautiously)
- Set `Content-Security-Policy` header
- Sanitize HTML with DOMPurify when rich text is required

## CSRF (Cross-Site Request Forgery)

**Prevention:**
- Use `SameSite=Strict` or `SameSite=Lax` cookies
- Verify `Origin` and `Referer` headers on state-changing endpoints
- Double-submit CSRF token pattern for non-SameSite scenarios

## Security Headers Checklist

```
Content-Security-Policy: default-src 'self'
Strict-Transport-Security: max-age=63072000; includeSubDomains; preload
X-Content-Type-Options: nosniff
X-Frame-Options: DENY
Referrer-Policy: strict-origin-when-cross-origin
Permissions-Policy: camera=(), microphone=()
```

## Dependency Vulnerabilities

```bash
npm audit                      # scan for known vulnerabilities
npm audit fix                  # auto-fix safe upgrades
npx better-npm-audit --level high  # fail CI on high/critical
```
