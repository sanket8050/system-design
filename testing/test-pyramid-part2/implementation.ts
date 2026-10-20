import { strict as assert } from 'assert';

// ──────────────────────────────────────────────────────────────
// Example: Testing a UserService with a mocked UserRepository
// This demonstrates the pattern — not a real test runner
// ──────────────────────────────────────────────────────────────

interface User {
  id: string;
  email: string;
  passwordHash: string;
  createdAt: Date;
}

interface UserRepository {
  findByEmail(email: string): Promise<User | null>;
  save(user: Omit<User, 'id'>): Promise<User>;
}

class UserService {
  constructor(private readonly repo: UserRepository) {}

  async register(email: string, passwordHash: string): Promise<User> {
    const existing = await this.repo.findByEmail(email);
    if (existing) throw new Error('Email already registered');

    return this.repo.save({ email, passwordHash, createdAt: new Date() });
  }
}

// Mock repository — zero dependencies, fully controlled
function createMockRepo(existingUsers: User[] = []): UserRepository {
  const db = new Map(existingUsers.map(u => [u.email, u]));
  let idSeq = existingUsers.length;

  return {
    findByEmail: async (email) => db.get(email) ?? null,
    save: async (user) => {
      const saved: User = { ...user, id: `user-${++idSeq}` };
      db.set(saved.email, saved);
      return saved;
    },
  };
}

// Test: successful registration
async function testRegisterSuccess() {
  const repo = createMockRepo();
  const service = new UserService(repo);
  const user = await service.register('alice@example.com', 'hashed-pw');
  assert.equal(user.email, 'alice@example.com');
  assert(user.id.startsWith('user-'));
  console.log('✓ successful registration');
}

// Test: duplicate email
async function testDuplicateEmail() {
  const existing: User = { id: 'user-1', email: 'bob@example.com', passwordHash: 'pw', createdAt: new Date() };
  const repo = createMockRepo([existing]);
  const service = new UserService(repo);
  await assert.rejects(
    () => service.register('bob@example.com', 'new-pw'),
    /already registered/i
  );
  console.log('✓ duplicate email rejected');
}

await testRegisterSuccess();
await testDuplicateEmail();
console.log('Test pyramid unit test examples passed');
