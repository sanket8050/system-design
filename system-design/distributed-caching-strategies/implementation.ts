/**
 * Day 5: Distributed Caching Strategies - Cache-Aside Simulation
 * Author: Sanket Adsare
 * Date: 2026-10-14
 *
 * This simulation demonstrates the Cache-Aside pattern using mock services
 * for a database and a distributed cache (like Redis).
 */

// --- Mock Services --- //

/**
 * Simulates a simple key-value database.
 */
class MockDatabase {
  private store: Map<string, string> = new Map();

  constructor(initialData?: Record<string, string>) {
    if (initialData) {
      for (const key in initialData) {
        this.store.set(key, initialData[key]);
      }
    }
  }

  public async get(key: string): Promise<string | undefined> {
    console.log(`[DB] Fetching data for key: ${key}`);
    // Simulate network/disk latency
    await new Promise(resolve => setTimeout(resolve, 100));
    return this.store.get(key);
  }

  public async set(key: string, value: string): Promise<void> {
    console.log(`[DB] Setting data for key: ${key} = ${value}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    this.store.set(key, value);
  }

  public async delete(key: string): Promise<void> {
    console.log(`[DB] Deleting data for key: ${key}`);
    await new Promise(resolve => setTimeout(resolve, 50));
    this.store.delete(key);
  }
}

/**
 * Simulates a distributed cache client (e.g., Redis).
 */
class MockRedisClient {
  private cache: Map<string, string> = new Map();
  // In a real Redis, TTLs are managed by Redis itself. Here, we'll just simulate basic get/set/del.

  public async get(key: string): Promise<string | undefined> {
    console.log(`[CACHE] Checking cache for key: ${key}`);
    await new Promise(resolve => setTimeout(resolve, 20)); // Faster than DB
    return this.cache.get(key);
  }

  public async set(key: string, value: string, ttlSeconds?: number): Promise<void> {
    console.log(`[CACHE] Setting cache for key: ${key} = ${value} (TTL: ${ttlSeconds || 'N/A'}s)`);
    await new Promise(resolve => setTimeout(resolve, 10));
    this.cache.set(key, value);
    if (ttlSeconds) {
      setTimeout(() => {
        if (this.cache.get(key) === value) {
          this.cache.delete(key);
          console.log(`[CACHE] Expired key: ${key}`);
        }
      }, ttlSeconds * 1000);
    }
  }

  public async del(key: string): Promise<void> {
    console.log(`[CACHE] Deleting cache entry for key: ${key}`);
    await new Promise(resolve => setTimeout(resolve, 10));
    this.cache.delete(key);
  }
}

// --- Cache-Aside Service --- //

class ProductService {
  private db: MockDatabase;
  private cache: MockRedisClient;
  private cacheTTLSeconds: number = 60;

  constructor(db: MockDatabase, cache: MockRedisClient) {
    this.db = db;
    this.cache = cache;
  }

  /**
   * Implements the read path of Cache-Aside.
   * 1. Try to get from cache.
   * 2. If not found, get from DB.
   * 3. If found in DB, set in cache and return.
   * 4. If not found in DB, return null.
   */
  public async getProductDetails(productId: string): Promise<string | undefined> {
    console.log(`\n--- Requesting product: ${productId} ---`);

    // 1. Try to get from cache
    let productData = await this.cache.get(productId);

    if (productData) {
      console.log(`[ProductService] Cache hit for ${productId}.`);
      return productData;
    } else {
      console.log(`[ProductService] Cache miss for ${productId}.`);
      // 2. If not found, get from DB
      productData = await this.db.get(productId);

      if (productData) {
        // 3. If found in DB, set in cache and return
        console.log(`[ProductService] Data found in DB for ${productId}. Caching it.`);
        await this.cache.set(productId, productData, this.cacheTTLSeconds);
        return productData;
      } else {
        // 4. If not found in DB, return null
        console.log(`[ProductService] Product ${productId} not found in DB.`);
        return undefined;
      }
    }
  }

  /**
   * Implements the write path of Cache-Aside (DB write + cache invalidation).
   */
  public async updateProductDetails(productId: string, newDetails: string): Promise<void> {
    console.log(`\n--- Updating product: ${productId} ---`);

    // 1. Write data to the database
    await this.db.set(productId, newDetails);
    console.log(`[ProductService] Database updated for ${productId}.`);

    // 2. Invalidate (delete) the corresponding entry from the cache
    await this.cache.del(productId);
    console.log(`[ProductService] Cache invalidated for ${productId}.`);
  }
}

// --- Simulation --- //

async function runSimulation() {
  const db = new MockDatabase({
    'product-123': 'Laptop Pro X (v1)',
    'product-456': 'Smartphone Ultra (v1)'
  });
  const cache = new MockRedisClient();
  const productService = new ProductService(db, cache);

  console.log('--- Initial Reads (Cache Misses) ---');
  // First read for product-123 (cache miss, DB hit, cache populate)
  let details1 = await productService.getProductDetails('product-123');
  console.log(`Retrieved: ${details1}`);

  // First read for product-456 (cache miss, DB hit, cache populate)
  let details2 = await productService.getProductDetails('product-456');
  console.log(`Retrieved: ${details2}`);

  console.log('\n--- Subsequent Reads (Cache Hits) ---');
  // Second read for product-123 (cache hit)
  details1 = await productService.getProductDetails('product-123');
  console.log(`Retrieved: ${details1}`);

  // Second read for product-456 (cache hit)
  details2 = await productService.getProductDetails('product-456');
  console.log(`Retrieved: ${details2}`);

  console.log('\n--- Update Product (DB Write + Cache Invalidation) ---');
  await productService.updateProductDetails('product-123', 'Laptop Pro X (v2) - Updated');

  console.log('\n--- Read After Update (Forced Cache Miss) ---');
  // Read product-123 after update (should be a cache miss, then DB hit, then cache populate with new data)
  details1 = await productService.getProductDetails('product-123');
  console.log(`Retrieved: ${details1}`);

  console.log('\n--- Attempt to Read Non-Existent Product ---');
  const nonExistent = await productService.getProductDetails('product-999');
  console.log(`Retrieved non-existent product: ${nonExistent}`);

  console.log('\n--- Simulating Cache Expiration ---');
  // Set a short TTL for product-456 and wait
  await productService.updateProductDetails('product-456', 'Smartphone Ultra (v2) - Expiring Soon');
  // Re-read to populate cache with new, expiring data
  await productService.getProductDetails('product-456');
  console.log('Waiting for cache entry to expire (3 seconds)...');
  await new Promise(resolve => setTimeout(resolve, 3000)); // Wait longer than default TTL

  console.log('\n--- Read After Expiration (Forced Cache Miss) ---');
  // This should now be a cache miss again, hitting the DB
  details2 = await productService.getProductDetails('product-456');
  console.log(`Retrieved: ${details2}`);
}

runSimulation();
