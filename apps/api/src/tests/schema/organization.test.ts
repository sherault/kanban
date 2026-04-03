import { describe, it, expect, beforeEach, afterEach } from 'vitest'
import type { BetterSQLite3Database } from 'drizzle-orm/better-sqlite3'
import type * as schema from '../../db/schema/index.js'
import { createTestDb } from '../../db/test-utils.js'
import { users, organizations, memberships } from '../../db/schema/index.js'

let db: BetterSQLite3Database<typeof schema>
let closeDb: () => void

beforeEach(() => {
  const testDb = createTestDb()
  db = testDb.db
  closeDb = testDb.close
})

afterEach(() => closeDb())

describe('memberships table', () => {
  it('creates a membership with owner role', () => {
    db.insert(users).values({ id: 'u1', email: 'a@b.com', passwordHash: 'h', displayName: 'A' }).run()
    db.insert(organizations).values({ id: 'o1', name: 'Acme' }).run()
    db.insert(memberships).values({ userId: 'u1', organizationId: 'o1', role: 'owner' }).run()

    const result = db.select().from(memberships).all()
    expect(result[0]?.role).toBe('owner')
  })

  it('enforces composite primary key (no duplicate membership)', () => {
    db.insert(users).values({ id: 'u1', email: 'a@b.com', passwordHash: 'h', displayName: 'A' }).run()
    db.insert(organizations).values({ id: 'o1', name: 'Acme' }).run()
    db.insert(memberships).values({ userId: 'u1', organizationId: 'o1', role: 'owner' }).run()

    expect(() =>
      db.insert(memberships).values({ userId: 'u1', organizationId: 'o1', role: 'member' }).run()
    ).toThrow()
  })

  it('cascades delete when organization is deleted', () => {
    db.insert(users).values({ id: 'u1', email: 'a@b.com', passwordHash: 'h', displayName: 'A' }).run()
    db.insert(organizations).values({ id: 'o1', name: 'Acme' }).run()
    db.insert(memberships).values({ userId: 'u1', organizationId: 'o1', role: 'owner' }).run()

    db.delete(organizations).run()
    expect(db.select().from(memberships).all()).toHaveLength(0)
  })
})
