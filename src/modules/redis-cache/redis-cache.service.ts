import { Inject, Injectable } from '@nestjs/common';
import { Redis } from 'ioredis';
export interface ITopTokenInfo {
  current_price: number;
  market_cap: number;
  price_change_24h: number;
  price_change_percentage_24h: number;
  total_volume: number;
}
@Injectable()
export class RedisCacheService {
  @Inject('REDIS_CACHE')
  private cache: Redis;

  constructor() {}

  async get(key: string): Promise<any> {
    return this.cache.get(key);
  }

  async set(key: string, value: any, time?: any) {
    // TODO: add ttl
    time
      ? await this.cache.set(key, value, 'PX', time)
      : await this.cache.set(key, value);
  }

  async hget(key: string, field: string): Promise<any> {
    return this.cache.hget(key, field);
  }

  async hset(key: string, value: Record<string, any>, expired?: any) {
    await this.cache.hset(key, value);
    await this.cache.expireat(
      key,
      Math.round(Date.now() / 1000) + (expired || 60),
    );
  }
  private convertDateProperties(obj: any): any {
    if (Array.isArray(obj)) {
      // Check if the array consists solely of date strings
      if (
        obj.every(
          (item) => typeof item === 'string' && !isNaN(Date.parse(item)),
        )
      ) {
        return obj.map((item) => new Date(item)); // Convert each string to Date
      } else {
        // If not all items are date strings, process each item recursively
        return obj.map((item) => this.convertDateProperties(item));
      }
    } else if (obj && typeof obj === 'object') {
      // If the input is an object, iterate over its properties
      for (const key in obj) {
        if (obj.hasOwnProperty(key)) {
          // Check if the value is a string that can be parsed as a date
          if (typeof obj[key] === 'string' && !isNaN(Date.parse(obj[key]))) {
            obj[key] = new Date(obj[key]); // Convert to Date object
          } else {
            // Recursively handle nested objects and arrays
            obj[key] = this.convertDateProperties(obj[key]);
          }
        }
      }
    }
    return obj; // Return the modified object or array
  }
  async setTopTokenInfo(symbol: string, data: ITopTokenInfo, expired?: number) {
    await this.cache.set(`top_token:${symbol}`, JSON.stringify(data));
    await this.cache.expireat(
      `top_token:${symbol}`,
      Math.round(Date.now() / 1000) + (expired || 10 * 60),
    );
  }

  async getTopTokenInfo(symbol: string): Promise<ITopTokenInfo> {
    const _tmp = (await this.cache.get(`top_token:${symbol}`)) as any;
    return JSON.parse(_tmp) as ITopTokenInfo;
  }

  async setATHTokenPrice(
    tokenAddress: string,
    date: Date,
    data: { ath: number; athSol: number },
    expired?: number,
  ) {
    await this.cache.set(
      `ath_token_price:${tokenAddress}:${date.getTime()}`,
      JSON.stringify(data),
    );
    await this.cache.expireat(
      `ath_token_price:${tokenAddress}:${date.getTime()}`,
      Math.round(Date.now() / 1000) + (expired || 60),
    );
  }

  async getATHTokenPrice(tokenAddress: string, date: Date): Promise<number> {
    const data = (await this.cache.get(
      `ath_token_price:${tokenAddress}:${date.getTime()}`,
    )) as any;
    return JSON.parse(data);
  }

  async reset() {
    await this.cache.reset();
  }

  async del(key: string) {
    await this.cache.del(key);
  }
}
