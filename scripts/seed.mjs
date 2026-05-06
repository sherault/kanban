#!/usr/bin/env node
/**
 * Seed script — creates realistic demo data.
 * Run from repo root: node scripts/seed.mjs
 */

import { ensureUser } from './seed/api.mjs'
import { mobileTasks, websiteArchiveKeys, websiteLinks, websiteTasks } from './seed/demo-data.mjs'
import { ensureMembers, ensureOrg, ensureProject } from './seed/orgs.mjs'
import { addWatcher, archiveDoneTasks, linkTasks, seedTasks } from './seed/tasks.mjs'

async function main() {
  console.log('🌱 Seeding database...\n')

  console.log('Creating demo users...')
  const alice = await ensureUser('alice@acmecorp.io', 'demo1234', 'Alice Martin')
  const bob = await ensureUser('bob@acmecorp.io', 'demo1234', 'Bob Chen')
  const carol = await ensureUser('carol@acmecorp.io', 'demo1234', 'Carol Singh')
  const users = { alice, bob, carol }

  console.log('\nSetting up organization...')
  const orgId = await ensureOrg(alice)
  await ensureMembers(orgId, alice, [
    [bob, 'Bob Chen', 'bob@acmecorp.io'],
    [carol, 'Carol Singh', 'carol@acmecorp.io'],
  ])

  console.log('\nCreating projects...')
  const websiteProjectId = await ensureProject(orgId, 'Website Redesign', alice.token)
  const mobileProjectId = await ensureProject(orgId, 'Mobile App v2', bob.token)

  console.log('\nCreating tasks for Website Redesign...')
  const websiteTaskIds = await seedTasks(
    websiteProjectId,
    websiteTasks(users),
    alice.token,
  )

  await linkTasks(websiteProjectId, websiteTaskIds, websiteLinks, alice.token)
  await addWatcher(websiteProjectId, websiteTaskIds.tokens, carol.id, alice.token)

  console.log('\nArchiving completed tasks...')
  await archiveDoneTasks(
    websiteProjectId,
    websiteArchiveKeys.map((key) => websiteTaskIds[key]),
    alice.token,
  )

  console.log('\nCreating tasks for Mobile App v2...')
  await seedTasks(mobileProjectId, mobileTasks(users), bob.token)

  console.log('\n✅ Seed complete!\n')
  console.log('Demo accounts (password: demo1234):')
  console.log('  Alice Martin  alice@acmecorp.io')
  console.log('  Bob Chen      bob@acmecorp.io')
  console.log('  Carol Singh   carol@acmecorp.io')
  console.log('\nOrganization: Acme Corp')
  console.log('Projects: Website Redesign · Mobile App v2')
}

main().catch((error) => {
  console.error(error.message)
  process.exit(1)
})
