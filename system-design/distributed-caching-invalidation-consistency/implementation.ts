import EventEmitter from 'events';

// --- Core Components ---

/**
 * Simulates a persistent data store (e.g., a database).
 */
class DataStore {
  private store: Map<string, string> = new Map();

  public async get(key: string): Promise<string | undefined> {
    console.log(`[DataStore] Fetching key: ${key}`);
    await new Promise(resolve => setTimeout(resolve, 100)); // Simulate network/DB latency
    return this.store.get(key);
  }

  public async set(key: string, value: string): Promise<void> {
    console.log(`[DataStore] Setting key: ${key}, value: ${value}`);
    await new Promise(resolve => setTimeout(resolve, 50)); // Simulate network/DB latency
    this.store.set(key, value);
  }
}

/**
 * Simulates a distributed cache node (e.g., Redis instance).
 */
class CacheNode {
  private cache: Map<string, string> = new Map();
  private name: string;

  constructor(name: string) {
    this.name = name;
  }

  public get(key: string): string | undefined {
    const value = this.cache.get(key);
    if (value) {
      console.log(`[CacheNode:${this.name}] HIT for key: ${key}`);
    } else {
      console.log(`[CacheNode:${this.name}] MISS for key: ${key}`);
    }
    return value;
  }

  public set(key: string, value: string): void {
    console.log(`[CacheNode:${this.name}] Setting key: ${key}`);
    this.cache.set(key, value);
  }

  public invalidate(key: string): void {
    const deleted = this.cache.delete(key);
    if (deleted) {
      console.log(`[CacheNode:${this.name}] Invalidated key: ${key}`);
    }
  }

  public clear(): void {
    this.cache.clear();
    console.log(`[CacheNode:${this.name}] Cleared all entries.`);
  }
}

/**
 * Simulates a Pub/Sub system for cache invalidation events.
 */
class EventBus extends EventEmitter {
  public static readonly CACHE_INVALIDATE_EVENT = 'cacheInvalidate';

  public publishInvalidate(key: string): void {
    console.log(`[EventBus] Publishing invalidation for key: ${key}`);
    this.emit(EventBus.CACHE_INVALIDATE_EVENT, key);
  }
}

// --- Application Logic (Service Layer) ---

interface User {
  id: string;
  name: string;
  email: string;
}

/**
 * A service that uses a cache-aside pattern with event-driven invalidation.
 */
class UserService {
  private dataStore: DataStore;
  private cache: CacheNode;
  private eventBus: EventBus;

  constructor(dataStore: DataStore, cache: CacheNode, eventBus: EventBus) {
    this.dataStore = dataStore;
    this.cache = cache;
    this.eventBus = eventBus;

    // Subscribe to invalidation events
    this.eventBus.on(EventBus.CACHE_INVALIDATE_EVENT, (key: string) => {
      // Only invalidate if the key matches our domain (e.g., 'user:<id>')
      if (key.startsWith('user:')) {
        this.cache.invalidate(key);
      }
    });
  }

  private getUserCacheKey(userId: string): string {
    return `user:${userId}`;
  }

  public async getUser(userId: string): Promise<User | undefined> {
    const cacheKey = this.getUserCacheKey(userId);
    let userJson = this.cache.get(cacheKey);

    if (userJson) {
      console.log(`[UserService] Getting user ${userId} from cache.`);
      return JSON.parse(userJson) as User;
    }

    // Cache miss, fetch from data store
    console.log(`[UserService] Getting user ${userId} from DataStore.`);
    userJson = await this.dataStore.get(cacheKey);

    if (userJson) {
      const user = JSON.parse(userJson) as User;
      this.cache.set(cacheKey, userJson); // Populate cache
      return user;
    }

    return undefined;
  }

  public async createUser(user: User): Promise<void> {
    const cacheKey = this.getUserCacheKey(user.id);
    await this.dataStore.set(cacheKey, JSON.stringify(user));
    // No need to invalidate on create if no prior entry exists, but good practice
    // to publish in case other services might have 'all users' caches.
    this.eventBus.publishInvalidate(cacheKey);
  }

  public async updateUser(userId: string, updates: Partial<User>): Promise<User | undefined> {
    const cacheKey = this.getUserCacheKey(userId);
    const existingUserJson = await this.dataStore.get(cacheKey);

    if (!existingUserJson) {
      console.log(`[UserService] User ${userId} not found for update.`);
      return undefined;
    }

    const existingUser = JSON.parse(existingUserJson) as User;
    const updatedUser = { ...existingUser, ...updates };

    console.log(`[UserService] Updating user ${userId} in DataStore.`);
    await this.dataStore.set(cacheKey, JSON.stringify(updatedUser));

    // Invalidate the cache entry for this user
    this.eventBus.publishInvalidate(cacheKey);

    return updatedUser;
  }
}

// --- Simulation ---

async function simulateDistributedCaching() {
  console.log('--- Simulation Start ---');

  const dataStore = new DataStore();
  const eventBus = new EventBus();

  // Simulate two different application instances (e.g., running on different servers)
  // Each has its own local cache node, but they share the same data store and event bus.
  const cacheNodeA = new CacheNode('AppInstance-A');
  const cacheNodeB = new CacheNode('AppInstance-B');

  const userServiceA = new UserService(dataStore, cacheNodeA, eventBus);
  const userServiceB = new UserService(dataStore, cacheNodeB, eventBus);

  const userId = 'user-123';
  const initialUser: User = { id: userId, name: 'Alice', email: 'alice@example.com' };

  // 1. Create a user
  console.log('\n--- Step 1: Create User ---\n');
  await userServiceA.createUser(initialUser);

  // 2. App Instance A reads user (cache miss, then populate cacheA)
  console.log('\n--- Step 2: App A reads user (cache miss) ---\n');
  let userA = await userServiceA.getUser(userId);
  console.log('User A (first read):', userA?.name);
  userA = await userServiceA.getUser(userId); // Second read should be a cache hit
  console.log('User A (second read):', userA?.name);

  // 3. App Instance B reads user (cache miss, then populate cacheB)
  console.log('\n--- Step 3: App B reads user (cache miss) ---\n');
  let userB = await userServiceB.getUser(userId);
  console.log('User B (first read):', userB?.name);
  userB = await userServiceB.getUser(userId); // Second read should be a cache hit
  console.log('User B (second read):', userB?.name);

  // 4. App Instance A updates user (updates DB, publishes invalidate event)
  console.log('\n--- Step 4: App A updates user ---\n');
  const updatedUser = await userServiceA.updateUser(userId, { name: 'Alicia' });
  console.log('Updated User:', updatedUser?.name);

  // Small delay to allow event propagation and cache invalidation
  await new Promise(resolve => setTimeout(resolve, 50));

  // 5. App Instance A reads again (cache was invalidated, so cache miss, then populate cacheA with new data)
  console.log('\n--- Step 5: App A reads user after update (cache miss again) ---\n');
  userA = await userServiceA.getUser(userId);
  console.log('User A (after update):', userA?.name);

  // 6. App Instance B reads again (cache was invalidated by event, so cache miss, then populate cacheB with new data)
  console.log('\n--- Step 6: App B reads user after update (cache miss again) ---\n');
  userB = await userServiceB.getUser(userId);
  console.log('User B (after update):', userB?.name);

  console.log('\n--- Simulation End ---');
}

simulateDistributedCaching().catch(console.error);
