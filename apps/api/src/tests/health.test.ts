import { describe, it, expect } from 'vitest'
import { app } from '../app.js'

describe('GET /health', () => {
  it('returns 200 with status ok', async () => {
    const res = await app.request('/health')
    expect(res.status).toBe(200)
    const body = (await res.json()) as { status: string }
    expect(body).toEqual({ status: 'ok' })
  })
})
