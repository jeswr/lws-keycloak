import { createClient, RedisClientType } from 'redis';

export interface JTICacheOptions {
  redisHost: string;
  redisPort: number;
  redisPassword?: string;
  redisDb?: number;
}

export class JTICache {
  private client: RedisClientType | null = null;
  private memoryCache: Map<string, number> = new Map();
  private options: JTICacheOptions;

  constructor(options: JTICacheOptions) {
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
      console.log('JTI Cache Redis connected');
    } catch (error) {
      console.warn('Failed to connect to Redis for JTI cache, using in-memory cache:', (error as Error).message);
      this.client = null;
    }
  }

  async isUsed(jti: string): Promise<boolean> {
    if (this.client) {
      try {
        const exists = await this.client.exists(`jti:${jti}`);
        return exists === 1;
      } catch (error) {
        console.error('Redis JTI check error:', error);
      }
    }

    // Fallback to memory cache
    const expiry = this.memoryCache.get(jti);
    if (expiry) {
      if (expiry > Date.now()) {
        return true;
      }
      // Expired, clean up
      this.memoryCache.delete(jti);
    }
    
    return false;
  }

  async markUsed(jti: string, ttl: number): Promise<void> {
    if (this.client) {
      try {
        await this.client.setEx(`jti:${jti}`, ttl, '1');
        return;
      } catch (error) {
        console.error('Redis JTI mark error:', error);
      }
    }

    // Fallback to memory cache
    this.memoryCache.set(jti, Date.now() + ttl * 1000);

    // Periodic cleanup
    if (this.memoryCache.size > 10000) {
      this.cleanupMemoryCache();
    }
  }

  private cleanupMemoryCache() {
    const now = Date.now();
    for (const [jti, expiry] of this.memoryCache.entries()) {
      if (expiry <= now) {
        this.memoryCache.delete(jti);
      }
    }
  }

  async close() {
    if (this.client) {
      await this.client.quit();
    }
  }
}
