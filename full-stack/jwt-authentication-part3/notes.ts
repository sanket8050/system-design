// JWT-based auth utilities — production patterns

import * as crypto from 'crypto';

// ─── Types ────────────────────────────────────────────────────
export interface JwtPayload {
  sub: string;       // subject (user ID)
  role: string;
  iat?: number;      // issued at
  exp?: number;      // expiry
  jti?: string;      // JWT ID (for revocation)
}

// ─── Minimal JWT (HS256) ──────────────────────────────────────
// Note: In production, use a vetted library (jose, jsonwebtoken).
// This is for understanding the internals.

function base64url(input: string | Buffer): string {
  const buf = typeof input === 'string' ? Buffer.from(input, 'utf-8') : input;
  return buf.toString('base64').replace(/+/g, '-').replace(///g, '_').replace(/=+$/, '');
}

function base64urlDecode(input: string): Buffer {
  const padded = input + '='.repeat((4 - (input.length % 4)) % 4);
  return Buffer.from(padded.replace(/-/g, '+').replace(/_/g, '/'), 'base64');
}

export function signJwt(payload: JwtPayload, secret: string, expiresInSeconds = 3600): string {
  const header = base64url(JSON.stringify({ alg: 'HS256', typ: 'JWT' }));
  const now = Math.floor(Date.now() / 1000);
  const body = base64url(JSON.stringify({
    ...payload,
    iat: now,
    exp: now + expiresInSeconds,
    jti: crypto.randomBytes(8).toString('hex'),
  }));

  const sig = crypto
    .createHmac('sha256', secret)
    .update(`${header}.${body}`)
    .digest('base64url');

  return `${header}.${body}.${sig}`;
}

export function verifyJwt(token: string, secret: string): JwtPayload {
  const [headerB64, bodyB64, sigB64] = token.split('.');
  if (!headerB64 || !bodyB64 || !sigB64) throw new Error('Invalid JWT format');

  const expectedSig = crypto
    .createHmac('sha256', secret)
    .update(`${headerB64}.${bodyB64}`)
    .digest('base64url');

  if (!crypto.timingSafeEqual(Buffer.from(sigB64), Buffer.from(expectedSig))) {
    throw new Error('JWT signature verification failed');
  }

  const payload: JwtPayload & { exp?: number } = JSON.parse(base64urlDecode(bodyB64).toString('utf-8'));

  if (payload.exp && payload.exp < Math.floor(Date.now() / 1000)) {
    throw new Error('JWT has expired');
  }
  return payload;
}

// ─── RBAC helper ─────────────────────────────────────────────
type Role = 'admin' | 'editor' | 'viewer';
type Permission = 'read' | 'write' | 'delete';

const ROLE_PERMISSIONS: Record<Role, Permission[]> = {
  admin:  ['read', 'write', 'delete'],
  editor: ['read', 'write'],
  viewer: ['read'],
};

export function hasPermission(role: string, permission: Permission): boolean {
  return (ROLE_PERMISSIONS[role as Role] ?? []).includes(permission);
}
