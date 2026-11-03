import { strict as assert } from 'assert';
import { signJwt, verifyJwt, hasPermission } from './jwt-authentication';

const SECRET = 'test-secret-key-32-chars-minimum!!';

// Valid token
const token = signJwt({ sub: 'user-123', role: 'editor' }, SECRET, 300);
const payload = verifyJwt(token, SECRET);
assert.equal(payload.sub, 'user-123');
assert.equal(payload.role, 'editor');

// Tampered token must throw
const parts = token.split('.');
const tampered = `${parts[0]}.${parts[1]}.fakesignature`;
assert.throws(() => verifyJwt(tampered, SECRET), /signature/i);

// Wrong secret must throw
assert.throws(() => verifyJwt(token, 'wrong-secret'), /signature/i);

// Expired token
const expiredToken = signJwt({ sub: 'user-456', role: 'viewer' }, SECRET, -1);
assert.throws(() => verifyJwt(expiredToken, SECRET), /expired/i);

// RBAC
assert(hasPermission('admin', 'delete'));
assert(hasPermission('editor', 'write'));
assert(!hasPermission('editor', 'delete'));
assert(!hasPermission('viewer', 'write'));
assert(!hasPermission('unknown', 'read'));

console.log('JWT authentication and RBAC tests passed');
