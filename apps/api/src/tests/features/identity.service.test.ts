import { describe, it, expect, beforeAll } from 'vitest'
import { createTestDb } from '../../db/test-utils.js'
import { IdentityService } from '../../features/identity/identity.service.js'

beforeAll(() => {
  process.env['JWT_SECRET'] = 'test-jwt-secret-must-be-at-least-32-chars!!'
  process.env['NODE_ENV'] = 'test'
})

describe('IdentityService.register', () => {
  it('creates a user and returns UserDto', async () => {
    const { db, close } = createTestDb()
    const svc = new IdentityService(db)
    const user = await svc.register({
      email: 'alice@example.com',
      password: 'password123',
      displayName: 'Alice',
    })
    expect(user.email).toBe('alice@example.com')
    expect(user.displayName).toBe('Alice')
    expect(typeof user.id).toBe('string')
    close()
  })

  it('throws 409 if email already registered', async () => {
    const { db, close } = createTestDb()
    const svc = new IdentityService(db)
    await svc.register({ email: 'alice@example.com', password: 'pw', displayName: 'A' })
    await expect(
      svc.register({ email: 'alice@example.com', password: 'pw2', displayName: 'A2' })
    ).rejects.toMatchObject({ status: 409 })
    close()
  })
})

describe('IdentityService.login', () => {
  it('returns accessToken, refreshToken, and UserDto on valid credentials', async () => {
    const { db, close } = createTestDb()
    const svc = new IdentityService(db)
    await svc.register({ email: 'bob@example.com', password: 'secret', displayName: 'Bob' })
    const result = await svc.login({ email: 'bob@example.com', password: 'secret' })
    expect(typeof result.accessToken).toBe('string')
    expect(typeof result.refreshToken).toBe('string')
    expect(result.user.email).toBe('bob@example.com')
    close()
  })

  it('throws 401 for wrong password', async () => {
    const { db, close } = createTestDb()
    const svc = new IdentityService(db)
    await svc.register({ email: 'bob@example.com', password: 'secret', displayName: 'Bob' })
    await expect(
      svc.login({ email: 'bob@example.com', password: 'wrongpass' })
    ).rejects.toMatchObject({ status: 401 })
    close()
  })

  it('throws 401 for unknown email', async () => {
    const { db, close } = createTestDb()
    const svc = new IdentityService(db)
    await expect(
      svc.login({ email: 'nobody@example.com', password: 'pw' })
    ).rejects.toMatchObject({ status: 401 })
    close()
  })
})

describe('IdentityService.refresh', () => {
  it('returns new accessToken and rotated refreshToken', async () => {
    const { db, close } = createTestDb()
    const svc = new IdentityService(db)
    await svc.register({ email: 'carol@example.com', password: 'pw', displayName: 'Carol' })
    const { refreshToken: rt1 } = await svc.login({ email: 'carol@example.com', password: 'pw' })
    const result = await svc.refresh(rt1)
    expect(typeof result.accessToken).toBe('string')
    expect(result.newRefreshToken).not.toBe(rt1)
    close()
  })

  it('invalidates the old refresh token after rotation', async () => {
    const { db, close } = createTestDb()
    const svc = new IdentityService(db)
    await svc.register({ email: 'carol@example.com', password: 'pw', displayName: 'Carol' })
    const { refreshToken: rt1 } = await svc.login({ email: 'carol@example.com', password: 'pw' })
    await svc.refresh(rt1)
    await expect(svc.refresh(rt1)).rejects.toMatchObject({ status: 401 })
    close()
  })
})

describe('IdentityService.logout', () => {
  it('invalidates the refresh token so refresh fails', async () => {
    const { db, close } = createTestDb()
    const svc = new IdentityService(db)
    await svc.register({ email: 'dave@example.com', password: 'pw', displayName: 'Dave' })
    const { refreshToken } = await svc.login({ email: 'dave@example.com', password: 'pw' })
    await svc.logout(refreshToken)
    await expect(svc.refresh(refreshToken)).rejects.toMatchObject({ status: 401 })
    close()
  })

  it('is idempotent — no error when token not found', async () => {
    const { db, close } = createTestDb()
    const svc = new IdentityService(db)
    await expect(svc.logout('nonexistent-token')).resolves.toBeUndefined()
    close()
  })
})
