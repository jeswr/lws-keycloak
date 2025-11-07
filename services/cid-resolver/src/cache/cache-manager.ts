import { createClient, RedisClientType } from 'redis';

export interface CacheManagerOptions {
  ttl: number;
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb?: number;
}

export class CacheManager {
  private client: RedisClientType | null = null;
  private memoryCache: Map<string, { value: string; expires: number }> = new Map();
  private options: CacheManagerOptions;

  constructor(options: CacheManagerOptions) {
    this.options = options;
    this.initRedis();
  }

  private async initRedis() {
    try {
      this.client = createClient({
        socket: {
          host: this.options.redisHost,
          port: this.options.redisPort,
        },
        password: this.options.redisPassword,
        database: this.options.redisDb || 0,
      });

      this.client.on('error', (err) => {
        console.error('Redis Client Error:', err);
        this.client = null;
      });

      await this.client.connect();
      console.log('Redis cache connected');
    } catch (error) {
      console.warn('Failed to connect to Redis, using in-memory cache:', (error as Error).message);
      this.client = null;
    }
  }

  async get(key: string): Promise<string | null> {
    if (this.client) {
      try {
        return await this.client.get(key);
      } catch (error) {
        console.error('Redis get error:', error);
      }
    }

    // Fallback to memory cache
    const cached = this.memoryCache.get(key);
    if (cached && cached.expires > Date.now()) {
      return cached.value;
    }
    
    if (cached) {
      this.memoryCache.delete(key);
    }
    
    return null;
  }

  async set(key: string, value: string, ttl?: number): Promise<void> {
    const expirationTime = ttl || this.options.ttl;

    if (this.client) {
      try {
        await this.client.setEx(key, expirationTime, value);
        return;
      } catch (error) {
        console.error('Redis set error:', error);
      }
    }

    // Fallback to memory cache
    this.memoryCache.set(key, {
      value,
      expires: Date.now() + expirationTime * 1000,
    });

    // Clean up expired entries periodically
    if (this.memoryCache.size > 1000) {
      this.cleanupMemoryCache();
    }
  }

  async delete(key: string): Promise<void> {
    if (this.client) {
      try {
        await this.client.del(key);
      } catch (error) {
        console.error('Redis delete error:', error);
      }
    }

    this.memoryCache.delete(key);
  }

  async clear(): Promise<void> {
    if (this.client) {
      try {
        await this.client.flushDb();
      } catch (error) {
        console.error('Redis clear error:', error);
      }
    }

    this.memoryCache.clear();
  }

  private cleanupMemoryCache() {
    const now = Date.now();
    for (const [key, value] of this.memoryCache.entries()) {
      if (value.expires <= now) {
        this.memoryCache.delete(key);
      }
    }
  }

  async close() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
