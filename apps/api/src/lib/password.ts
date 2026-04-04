import argon2 from 'argon2'

// Lower cost in test environment so the test suite stays fast.
const OPTIONS =
  process.env['NODE_ENV'] === 'test'
    ? { timeCost: 1, memoryCost: 1024 }
    : {}

export const hashPassword = (password: string): Promise<string> =>
  argon2.hash(password, OPTIONS)

export const verifyPassword = (hash: string, password: string): Promise<boolean> =>
  argon2.verify(hash, password)
