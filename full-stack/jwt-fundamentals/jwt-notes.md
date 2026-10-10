# JWT Fundamentals

## What & Why

JSON Web Tokens (JWTs) are a compact, URL-safe means of representing claims to be transferred between two parties. They're typically used for authentication and authorization in modern web applications, especially with RESTful APIs.

**Why JWTs over session cookies?**
1.  **Statelessness:** Server doesn't need to store session data. This simplifies horizontal scaling.
2.  **Decoupled Frontend/Backend:** Ideal for microservices or separate frontend frameworks.
3.  **Mobile Friendly:** Easier to use with mobile apps than traditional cookies.

## Structure

A JWT has three parts, separated by dots: `header.payload.signature`

1.  **Header:** `{"alg": "HS256", "typ": "JWT"}`
    *   `alg`: Algorithm used for signing (e.g., HS256, RS256).
    *   `typ`: Type of token (always "JWT").
2.  **Payload (Claims):** `{"sub": "user123", "name": "Sanket Adsare", "iat": 1678886400, "exp": 1678890000}`
    *   **Registered Claims:** `iss` (issuer), `sub` (subject), `aud` (audience), `exp` (expiration time), `nbf` (not before), `iat` (issued at), `jti` (JWT ID). These are optional but recommended.
    *   **Public Claims:** Defined by users, but to avoid collisions, should be registered in the IANA JWT Registry or be a URI that contains a collision-resistant namespace.
    *   **Private Claims:** Custom claims agreed upon by the parties.
    *   **Opinion:** Keep payloads minimal. Do NOT store sensitive data here. It's base64 encoded, not encrypted.
3.  **Signature:** Created by taking the encoded header, encoded payload, a secret, the algorithm specified in the header, and signing it. This ensures the token hasn't been tampered with.

## How it Works (Authentication Flow)

1.  User authenticates with credentials (username/password).
2.  Server verifies credentials.
3.  Server creates a JWT, signs it with a secret key, and sends it back to the client.
4.  Client stores the JWT (e.g., in `localStorage` or `HttpOnly` cookie).
5.  For subsequent requests, client sends the JWT in the `Authorization` header (`Bearer <token>`).
6.  Server verifies the JWT's signature and expiration. If valid, it trusts the claims and grants access.

## Key Considerations & Best Practices

*   **Token Storage:**
    *   **`localStorage`:** Vulnerable to XSS. Not recommended for storing access tokens.
    *   **`HttpOnly` Cookies:** Preferred for access tokens. Mitigates XSS as JavaScript can't access them. Use `Secure` flag in production.
*   **Expiration (`exp`):** Use short expiry times for access tokens (e.g., 15-60 minutes). This limits the window for token misuse if compromised.
*   **Refresh Tokens:** Pair short-lived access tokens with long-lived refresh tokens.
    *   Refresh tokens are stored securely (e.g., `HttpOnly` cookie).
    *   Used to obtain new access tokens when the current one expires.
    *   Should be revocable and single-use to enhance security.
*   **Signature Secret:** Must be a strong, cryptographically secure random string. Never expose it.
*   **Revocation:** JWTs are stateless, making immediate revocation difficult. Strategies:
    *   **Short expiry + refresh tokens:** Revoke refresh tokens.
    *   **Blocklist/Blacklist:** Maintain a list of revoked JWTs on the server. Requires state, negating some JWT benefits. Use for critical scenarios (e.g., user logout, password change).
*   **Algorithms:** Prefer `HS256` (HMAC with SHA-256) for symmetric keys or `RS256` (RSA with SHA-256) for asymmetric keys.
