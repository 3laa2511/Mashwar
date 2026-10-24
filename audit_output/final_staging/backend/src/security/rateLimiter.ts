/**
 * Mashwar — Sliding-Window Rate Limiter Middleware
 * Protects sensitive authentication, order creation, cash collection, and webhook endpoints.
 */

import { Request, Response, NextFunction } from 'express';

interface RateLimitBucket {
  timestamps: number[];
}

const allStores: Array<Map<string, RateLimitBucket>> = [];

export interface RateLimiterOptions {
  windowMs: number;
  maxRequests: number;
  scope: string;
  keyGenerator?: (req: Request) => string;
}

export function createRateLimiter(options: RateLimiterOptions) {
  const bucketMap = new Map<string, RateLimitBucket>();
  allStores.push(bucketMap);

  return (req: Request, res: Response, next: NextFunction) => {
    const now = Date.now();
    const clientKey = options.keyGenerator
      ? options.keyGenerator(req)
      : `${options.scope}:${req.user?.id || req.ip || 'anonymous'}`;

    const entry = bucketMap.get(clientKey) || { timestamps: [] };
    entry.timestamps = entry.timestamps.filter((t) => now - t < options.windowMs);

    if (entry.timestamps.length >= options.maxRequests) {
      const retryAfterSeconds = Math.ceil(options.windowMs / 1000);
      res.setHeader('Retry-After', String(retryAfterSeconds));
      return res.status(429).json({
        success: false,
        error: {
          code: 'RATE_LIMIT_EXCEEDED',
          message: 'تم تجاوز الحد المسموح للطلبات المتتالية. يرجى الانتظار قليلاً والمحاولة مرة أخرى.',
          retryAfterSeconds,
        },
        meta: {
          timestamp: new Date().toISOString(),
          scope: options.scope,
        },
      });
    }

    entry.timestamps.push(now);
    bucketMap.set(clientKey, entry);
    return next();
  };
}

export function resetAllRateLimiters(): void {
  for (const store of allStores) {
    store.clear();
  }
}
