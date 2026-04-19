#!/usr/bin/env node
/**
 * Seed script — creates realistic demo data.
 * Run from repo root: node scripts/seed.mjs
 */

import { execSync } from 'node:child_process'

const API = 'http://localhost:3010'
const DB = 'data/kanban.db'

const sq = (sql) => execSync(`sqlite3 "${DB}" "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim()
const sqMulti = (sql) => execSync(`sqlite3 "${DB}" <<'ENDSQL'\n${sql}\nENDSQL`, { encoding: 'utf8', shell: '/bin/bash' }).trim()

async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3009',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

async function patch(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: { 
      'Content-Type': 'application/json', 
      'Origin': 'http://localhost:3009',
      Authorization: `Bearer ${token}` 
    },
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`)
  return res.json()
}

async function postEmpty(path, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: { 
      'Origin': 'http://localhost:3009',
      Authorization: `Bearer ${token}` 
    },
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json()
}

async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: { 
      'Content-Type': 'application/json',
      'Origin': 'http://localhost:3009'
    },
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`)
  const data = await res.json()
  return data.accessToken
}

function dbGet(sql) {
  return sq(sql)
}

async function ensureUser(email, password, displayName) {
  const existing = dbGet(`SELECT id FROM users WHERE email = '${email}'`)
  if (!existing) {
    try {
      await post('/auth/register', { email, password, displayName })
      sq(`UPDATE users SET email_verified = 1 WHERE email = '${email}'`)
      console.log(`  ✓ created ${displayName} (${email})`)
    } catch (e) {
      console.log(`  ↳ ${email}: ${e.message}`)
    }
  } else {
    console.log(`  ↳ ${email} already exists`)
  }
  const token = await login(email, password)
  const id = dbGet(`SELECT id FROM users WHERE email = '${email}'`)
  return { id, token }
}

async function main() {
  console.log('🌱 Seeding database...\n')

  // ── Users ─────────────────────────────────────────────────────────────────
  console.log('Creating demo users...')
  const alice = await ensureUser('alice@acmecorp.io', 'demo1234', 'Alice Martin')
  const bob   = await ensureUser('bob@acmecorp.io',   'demo1234', 'Bob Chen')
  const carol = await ensureUser('carol@acmecorp.io',  'demo1234', 'Carol Singh')

  // ── Organization ──────────────────────────────────────────────────────────
  console.log('\nSetting up organization...')
  let orgId = dbGet(`SELECT id FROM organizations WHERE name = 'Acme Corp'`)
  if (!orgId) {
    const org = await post('/organizations', { name: 'Acme Corp', website: 'https://acmecorp.io' }, alice.token)
    orgId = org.id
    console.log(`  ✓ created Acme Corp`)
  } else {
    console.log(`  ↳ Acme Corp already exists`)
  }

  // Invite Bob & Carol via invitation link
  for (const [member, name] of [[bob, 'Bob Chen'], [carol, 'Carol Singh']]) {
    const isMember = dbGet(`SELECT user_id FROM memberships WHERE organization_id = '${orgId}' AND user_id = '${member.id}'`)
    if (!isMember) {
      const invite = await post(`/organizations/${orgId}/invitations`, {}, alice.token)
      // Accept the invite as the new member
      await post(`/invite/${invite.rawToken}`, { email: name === 'Bob Chen' ? 'bob@acmecorp.io' : 'carol@acmecorp.io', password: 'demo1234', displayName: name }, member.token)
        .catch(async () => {
          // Try accepting as existing user
          const res = await fetch(`${API}/invite/${invite.rawToken}`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${member.token}` },
            body: JSON.stringify({}),
          })
          if (!res.ok) {
            // Direct insert as fallback
            const mid = crypto.randomUUID()
            sq(`INSERT OR IGNORE INTO memberships (user_id, organization_id, role) VALUES ('${member.id}', '${orgId}', 'member')`)
          }
        })
      console.log(`  ✓ ${name} joined Acme Corp`)
    } else {
      console.log(`  ↳ ${name} already member`)
    }
  }

  // ── Project 1: Website Redesign ───────────────────────────────────────────
  console.log('\nCreating projects...')
  let p1Id = dbGet(`SELECT id FROM projects WHERE name = 'Website Redesign' AND organization_id = '${orgId}'`)
  if (!p1Id) {
    const p = await post(`/organizations/${orgId}/projects`, { name: 'Website Redesign' }, alice.token)
    p1Id = p.id
    console.log(`  ✓ Website Redesign`)
  } else {
    console.log(`  ↳ Website Redesign exists`)
  }

  // ── Project 2: Mobile App v2 ──────────────────────────────────────────────
  let p2Id = dbGet(`SELECT id FROM projects WHERE name = 'Mobile App v2' AND organization_id = '${orgId}'`)
  if (!p2Id) {
    const p = await post(`/organizations/${orgId}/projects`, { name: 'Mobile App v2' }, bob.token)
    p2Id = p.id
    console.log(`  ✓ Mobile App v2`)
  } else {
    console.log(`  ↳ Mobile App v2 exists`)
  }

  // ── Tasks: Website Redesign ───────────────────────────────────────────────
  console.log('\nCreating tasks for Website Redesign...')

  async function ensureTask(projectId, taskDef, token) {
    const existing = dbGet(`SELECT id FROM tasks WHERE title = '${taskDef.title.replace(/'/g, "''")}' AND project_id = '${projectId}'`)
    if (existing) {
      console.log(`  ↳ "${taskDef.title}" exists`)
      return existing
    }
    const { tags = [], backgroundColor, doerId, ...payload } = taskDef
    const task = await post(`/projects/${projectId}/tasks`, payload, token)
    const updates = {}
    if (backgroundColor) updates.backgroundColor = backgroundColor
    if (doerId) updates.doerId = doerId
    if (Object.keys(updates).length) await patch(`/projects/${projectId}/tasks/${task.id}`, updates, token)
    for (const tag of tags) {
      await postEmpty(`/projects/${projectId}/tasks/${task.id}/tags/${tag}`, token)
    }
    console.log(`  ✓ [${taskDef.column}] ${taskDef.title}`)
    return task.id
  }

  const t1 = await ensureTask(p1Id, {
    title: 'Add dark mode support',
    description: 'Users have been requesting dark mode for 6 months. Should follow system preferences by default with a manual override toggle.',
    column: 'ideas', startDate: '2026-04-01', endDate: '2026-06-30',
    objective: 'User Experience', tags: ['ux', 'frontend'],
  }, alice.token)

  const t2 = await ensureTask(p1Id, {
    title: 'Implement A/B testing framework',
    description: 'Set up infrastructure for landing page A/B tests. Goal: improve sign-up conversion by 15%.',
    column: 'ideas', startDate: '2026-05-01', endDate: '2026-07-31',
    objective: 'Growth', tags: ['analytics', 'backend'],
  }, alice.token)

  const t3 = await ensureTask(p1Id, {
    title: 'Redesign homepage hero section',
    description: 'New design mockups are ready in Figma. Implement responsive layout with animated headline and updated CTAs.',
    column: 'todo', startDate: '2026-04-01', endDate: '2026-04-18',
    objective: 'Brand Refresh', tags: ['frontend', 'design'],
    backgroundColor: '#fef9c3',
  }, alice.token)

  const t4 = await ensureTask(p1Id, {
    title: 'Migrate blog to Contentful CMS',
    description: 'Moving from WordPress to Contentful. Export 200+ posts, configure webhooks, set up preview mode.',
    column: 'todo', startDate: '2026-04-10', endDate: '2026-04-25',
    objective: 'Infrastructure', tags: ['backend', 'devops'],
  }, alice.token)

  const t5 = await ensureTask(p1Id, {
    title: 'Fix mobile navigation crash on iOS Safari',
    description: 'The hamburger menu overflows the viewport when the keyboard appears on iOS 16. Reproducible on iPhone 14.',
    column: 'todo', startDate: '2026-04-05', endDate: '2026-04-14',
    objective: 'Bug Fixes', tags: ['frontend', 'mobile', 'bug'],
    backgroundColor: '#fee2e2',
  }, alice.token)

  const t6 = await ensureTask(p1Id, {
    title: 'Implement new design system tokens',
    description: 'Migrate all hardcoded colour values to CSS custom properties from the new Figma token library. ~400 occurrences.',
    column: 'doing', startDate: '2026-04-01', endDate: '2026-04-20',
    objective: 'Brand Refresh', tags: ['frontend', 'design'],
    backgroundColor: '#dbeafe', doerId: bob.id,
  }, alice.token)

  const t7 = await ensureTask(p1Id, {
    title: 'SEO audit and Core Web Vitals fixes',
    description: 'Lighthouse audit all public pages. Fix missing meta tags, structured data, and improve CWV score above 90.',
    column: 'doing', startDate: '2026-03-25', endDate: '2026-04-15',
    objective: 'Growth', tags: ['seo', 'frontend'],
    doerId: carol.id,
  }, alice.token)

  const t8 = await ensureTask(p1Id, {
    title: 'Set up CI/CD pipeline with GitHub Actions',
    description: 'Lint → test → build → deploy to staging on PR. Auto-deploy to prod on merge. Slack notifications on failure.',
    column: 'done', startDate: '2026-03-01', endDate: '2026-03-20',
    objective: 'Infrastructure', tags: ['devops'],
  }, alice.token)

  const t9 = await ensureTask(p1Id, {
    title: 'GDPR cookie consent banner update',
    description: 'New banner with granular category controls (analytics, marketing, preferences). Integrates with OneTrust.',
    column: 'done', startDate: '2026-03-10', endDate: '2026-03-28',
    objective: 'Compliance', tags: ['legal', 'frontend'],
  }, alice.token)

  const t10 = await ensureTask(p1Id, {
    title: 'Lazy-load images for faster LCP',
    description: 'Native lazy loading on all below-fold images. LCP improved from 4.2s to 1.8s. Passed Core Web Vitals.',
    column: 'done', startDate: '2026-03-15', endDate: '2026-04-01',
    objective: 'Growth', tags: ['frontend', 'performance'],
  }, alice.token)

  // Link related tasks
  for (const [a, b] of [[t3, t6], [t7, t10]]) {
    if (typeof a === 'string' && typeof b === 'string') {
      const already = dbGet(`SELECT 1 FROM task_links WHERE (task_id='${a}' AND linked_task_id='${b}') OR (task_id='${b}' AND linked_task_id='${a}')`)
      if (!already) {
        try { await postEmpty(`/projects/${p1Id}/tasks/${a}/links/${b}`, alice.token) } catch {}
      }
    }
  }

  // Add watchers
  if (typeof t6 === 'string') {
    const hasWatcher = dbGet(`SELECT 1 FROM task_watchers WHERE task_id='${t6}' AND user_id='${carol.id}'`)
    if (!hasWatcher) {
      try { await postEmpty(`/projects/${p1Id}/tasks/${t6}/watchers/${carol.id}`, alice.token) } catch {}
    }
  }

  // Archive done tasks
  console.log('\nArchiving completed tasks...')
  for (const taskId of [t8, t9, t10].filter(t => typeof t === 'string')) {
    const isArchived = dbGet(`SELECT archived_at FROM tasks WHERE id = '${taskId}'`)
    if (!isArchived || isArchived === 'null' || isArchived === '') {
      try {
        await post(`/projects/${p1Id}/tasks/archive`, { taskIds: [taskId] }, alice.token)
        console.log(`  ✓ archived task`)
      } catch (e) {
        console.log(`  ↳ archive: ${e.message}`)
      }
    }
  }

  // ── Tasks: Mobile App v2 ──────────────────────────────────────────────────
  console.log('\nCreating tasks for Mobile App v2...')

  await ensureTask(p2Id, {
    title: 'Push notification system',
    description: 'Integrate Firebase Cloud Messaging. Support topic subscriptions, deep-link payloads, and notification preferences.',
    column: 'ideas', startDate: '2026-05-01', endDate: '2026-06-15',
    objective: 'Engagement', tags: ['mobile', 'backend'],
  }, bob.token)

  await ensureTask(p2Id, {
    title: 'Biometric authentication (Face ID / Touch ID)',
    description: 'Store JWT refresh token in Keychain/Keystore. Use LocalAuthentication API. Fall back to PIN on failure.',
    column: 'ideas', startDate: '2026-05-15', endDate: '2026-07-01',
    objective: 'Security', tags: ['mobile', 'security'],
  }, bob.token)

  await ensureTask(p2Id, {
    title: 'Onboarding flow redesign',
    description: '5-step onboarding funnel with progress indicator. Drop-off analysis shows 60% leave on step 3 — simplify it.',
    column: 'todo', startDate: '2026-04-10', endDate: '2026-04-30',
    objective: 'User Experience', tags: ['mobile', 'design'],
    backgroundColor: '#fef9c3',
  }, bob.token)

  await ensureTask(p2Id, {
    title: 'Offline mode with sync queue',
    description: 'Cache board data with SQLite. Queue mutations when offline, replay on reconnect with conflict resolution.',
    column: 'doing', startDate: '2026-04-01', endDate: '2026-04-22',
    objective: 'Reliability', tags: ['mobile', 'backend'],
    backgroundColor: '#dcfce7', doerId: carol.id,
  }, bob.token)

  await ensureTask(p2Id, {
    title: 'App Store review response automation',
    description: 'Fetch reviews via App Store Connect API, classify sentiment, auto-draft responses for 1–2 star reviews.',
    column: 'done', startDate: '2026-03-01', endDate: '2026-03-25',
    objective: 'Growth', tags: ['backend'],
  }, bob.token)

  console.log('\n✅ Seed complete!\n')
  console.log('Demo accounts (password: demo1234):')
  console.log('  Alice Martin  alice@acmecorp.io')
  console.log('  Bob Chen      bob@acmecorp.io')
  console.log('  Carol Singh   carol@acmecorp.io')
  console.log('\nOrganization: Acme Corp')
  console.log('Projects: Website Redesign · Mobile App v2')
}

main().catch(e => { console.error(e.message); process.exit(1) })
