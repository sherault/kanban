import { API, dbGet, post, sq } from './api.mjs'

export async function ensureOrg(alice) {
  let orgId = dbGet(`SELECT id FROM organizations WHERE name = 'Acme Corp'`)
  if (!orgId) {
    const org = await post('/organizations', { name: 'Acme Corp', website: 'https://acmecorp.io' }, alice.token)
    orgId = org.id
    console.log(`  ✓ created Acme Corp`)
  } else {
    console.log(`  ↳ Acme Corp already exists`)
  }
  return orgId
}

export async function ensureMembers(orgId, alice, members) {
  for (const [member, name, email] of members) {
    const isMember = dbGet(`SELECT user_id FROM memberships WHERE organization_id = '${orgId}' AND user_id = '${member.id}'`)
    if (isMember) {
      console.log(`  ↳ ${name} already member`)
      continue
    }
    const invite = await post(`/organizations/${orgId}/invitations`, {}, alice.token)
    await post(`/invite/${invite.rawToken}`, { email, password: 'demo1234', displayName: name }, member.token)
      .catch(async () => {
        const res = await fetch(`${API}/invite/${invite.rawToken}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${member.token}` },
          body: JSON.stringify({}),
        })
        if (!res.ok) {
          sq(`INSERT OR IGNORE INTO memberships (user_id, organization_id, role) VALUES ('${member.id}', '${orgId}', 'member')`)
        }
      })
    console.log(`  ✓ ${name} joined Acme Corp`)
  }
}

export async function ensureProject(orgId, name, token) {
  let projectId = dbGet(`SELECT id FROM projects WHERE name = '${name}' AND organization_id = '${orgId}'`)
  if (!projectId) {
    const project = await post(`/organizations/${orgId}/projects`, { name }, token)
    projectId = project.id
    console.log(`  ✓ ${name}`)
  } else {
    console.log(`  ↳ ${name} exists`)
  }
  return projectId
}
