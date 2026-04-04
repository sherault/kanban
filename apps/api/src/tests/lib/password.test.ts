import { describe, it, expect } from 'vitest'
import { hashPassword, verifyPassword } from '../../lib/password.js'

describe('hashPassword', () => {
  it('produces a hash different from the original', async () => {
    const hash = await hashPassword('mySecret123')
    expect(hash).not.toBe('mySecret123')
    expect(hash.length).toBeGreaterThan(20)
  })

  it('produces different hashes for the same password (salt)', async () => {
    const h1 = await hashPassword('same')
    const h2 = await hashPassword('same')
    expect(h1).not.toBe(h2)
  })
})

describe('verifyPassword', () => {
  it('returns true for the correct password', async () => {
    const hash = await hashPassword('correct-horse')
    expect(await verifyPassword(hash, 'correct-horse')).toBe(true)
  })

  it('returns false for a wrong password', async () => {
    const hash = await hashPassword('correct-horse')
    expect(await verifyPassword(hash, 'wrong-password')).toBe(false)
  })
})
