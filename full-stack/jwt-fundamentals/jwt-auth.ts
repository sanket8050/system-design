// full-stack/jwt-fundamentals/jwt-auth.ts
import jwt from 'jsonwebtoken';
import { Request, Response, NextFunction } from 'express';

// In a real application, this would come from environment variables or a secure configuration service.
// For demonstration, using a simple string. Ensure it's long and random in production.
const JWT_SECRET = process.env.JWT_SECRET || 'supersecretjwtkeythatshouldbemuchlongerandrandom';
const JWT_EXPIRATION_TIME = '1h'; // 1 hour for access token

// Extend Express Request type for custom property (for middleware demo)
// In a real project, you'd define this in a declaration file (e.g., src/types/express.d.ts)
declare global {
  namespace Express {
    interface Request {
      user?: UserPayload; // Add user property to Request
    }
  }
}

interface UserPayload {
  userId: string;
  username: string;
  // Add other non-sensitive user data that needs to be in the token
}

/**
 * Generates a new JWT for a given user payload.
 * @param payload User data to be included in the token.
 * @returns A signed JWT string.
 */
export function generateAccessToken(payload: UserPayload): string {
  return jwt.sign(payload, JWT_SECRET, { expiresIn: JWT_EXPIRATION_TIME });
}

/**
 * Verifies a JWT and returns the decoded payload.
 * Throws an error if the token is invalid or expired.
 * @param token The JWT string to verify.
 * @returns The decoded payload if verification is successful.
 */
export function verifyAccessToken(token: string): UserPayload {
  try {
    // The 'as UserPayload' is a type assertion for convenience.
    // In a real app, you might validate the structure more rigorously using a schema validator.
    return jwt.verify(token, JWT_SECRET) as UserPayload;
  } catch (error) {
    if (error instanceof jwt.TokenExpiredError) {
      throw new Error('Token expired');
    }
    if (error instanceof jwt.JsonWebTokenError) {
      throw new Error('Invalid token');
    }
    throw error; // Re-throw other unexpected errors
  }
}

/**
 * Express middleware to authenticate requests using JWT.
 * Attaches the decoded user payload to `req.user`.
 * Requires 'jsonwebtoken' and 'express'.
 */
export const authenticateJWT = (req: Request, res: Response, next: NextFunction) => {
  const authHeader = req.headers.authorization;

  if (authHeader) {
    const token = authHeader.split(' ')[1]; // Expects "Bearer TOKEN"

    try {
      const user = verifyAccessToken(token);
      req.user = user; // Attach user information to the request object
      next();
    } catch (error: any) {
      console.error('JWT authentication error:', error.message);
      return res.status(403).json({ message: error.message });
    }
  } else {
    res.status(401).json({ message: 'Authorization token not provided' });
  }
};

// --- Example Usage (simulated) ---
// To run this example:
// 1. Ensure you have Node.js and npm/yarn installed.
// 2. Install dependencies: `npm install jsonwebtoken express @types/express @types/jsonwebtoken ts-node`
// 3. Run: `ts-node jwt-auth.ts`
if (require.main === module) {
  console.log('--- JWT Utility Demonstration ---');

  const user = { userId: 'sanket_adsare_123', username: 'sanket.adsare' };

  // 1. Generate a token
  const accessToken = generateAccessToken(user);
  console.log('\nGenerated Access Token:', accessToken);

  // 2. Simulate an authenticated request
  console.log('\nSimulating an authenticated request...');
  try {
    const decodedUser = verifyAccessToken(accessToken);
    console.log('Token verified successfully. Decoded User:', decodedUser);
    if (decodedUser.userId === user.userId) {
      console.log('User ID matches!');
    }
  } catch (error: any) {
    console.error('Token verification failed:', error.message);
  }

  // 3. Simulate an expired token (create a short-lived token for this)
  // For actual testing of expiry, you'd need to wait or mock the clock.
  console.log('\nSimulating an expired token (create a short-lived token for this)...');
  const shortLivedToken = jwt.sign(user, JWT_SECRET, { expiresIn: '1s' });
  console.log('Short-lived token generated. Waiting 2 seconds for it to expire...');
  setTimeout(() => {
    try {
      verifyAccessToken(shortLivedToken);
      console.log('Expired token surprisingly verified (this should not happen in a real test)!');
    } catch (error: any) {
      console.error('Expected: Expired token verification failed:', error.message);
    }
  }, 2000); // Wait 2 seconds for 1-second token to expire

  // 4. Simulate an invalid token (e.g., tampered signature)
  console.log('\nSimulating an invalid token (tampered signature)...');
  const invalidToken = accessToken.slice(0, -5) + 'invalid_signature_part'; // Intentionally corrupt the signature
  try {
    verifyAccessToken(invalidToken);
    console.log('Invalid token surprisingly verified (this should not happen)!');
  } catch (error: any) {
    console.error('Expected: Invalid token verification failed:', error.message);
  }

  // 5. Simulate a token signed with a different secret
  console.log('\nSimulating a token signed with a different secret...');
  const otherSecret = 'anothersecret';
  const tokenFromOtherSecret = jwt.sign(user, otherSecret, { expiresIn: '1h' });
  try {
    verifyAccessToken(tokenFromOtherSecret); // Trying to verify with JWT_SECRET
    console.log('Token from other secret surprisingly verified (this should not happen)!');
  } catch (error: any) {
    console.error('Expected: Token from other secret verification failed:', error.message);
  }
}