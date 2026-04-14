import { Context, Next } from 'hono'
import { HTTPException } from 'hono/http-exception'

interface RateLimitRecord {
  count: number
  reset: number
}

const memoryStore = new Map<string, RateLimitRecord>()

/**
 * Simple memory-based rate limiter middleware for Hono.
 * @param limit Maximum number of requests allowed in the window.
 * @param windowMs Window duration in milliseconds.
 */
export const rateLimit = (limit: number, windowMs: number) => {
  return async (c: Context, next: Next) => {
    // In a real production app, use use c.req.header('cf-connecting-ip') or similar
    // depending on the proxy. For local/dev, x-forwarded-for or a placeholder.
    const ip = c.req.header('x-forwarded-for')?.split(',')[0] || '127.0.0.1'
    const now = Date.now()
    
    let record = memoryStore.get(ip)

    if (!record || now > record.reset) {
      record = { count: 1, reset: now + windowMs }
      memoryStore.set(ip, record)
    } else {
      record.count++
    }

    if (record.count > limit) {
      const retryAfter = Math.ceil((record.reset - now) / 1000)
      c.header('Retry-After', retryAfter.toString())
      throw new HTTPException(429, { message: 'Too many requests. Please try again later.' })
    }

    await next()
  }
}
