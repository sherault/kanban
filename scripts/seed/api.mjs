import { execSync } from 'node:child_process'

export const API = 'http://localhost:3010'
const DB = 'data/kanban.db'

export const sq = (sql) => execSync(`sqlite3 "${DB}" "${sql.replace(/"/g, '\\"')}"`, { encoding: 'utf8' }).trim()
export const sqMulti = (sql) => execSync(`sqlite3 "${DB}" <<'ENDSQL'\n${sql}\nENDSQL`, { encoding: 'utf8', shell: '/bin/bash' }).trim()
export const dbGet = (sql) => sq(sql)

function headers(token, json = true) {
  return {
    ...(json ? { 'Content-Type': 'application/json' } : {}),
    'Origin': 'http://localhost:3009',
    ...(token ? { Authorization: `Bearer ${token}` } : {}),
  }
}

export async function post(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: headers(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) {
    const text = await res.text()
    throw new Error(`POST ${path} → ${res.status}: ${text}`)
  }
  return res.json()
}

export async function patch(path, body, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'PATCH',
    headers: headers(token),
    body: JSON.stringify(body),
  })
  if (!res.ok) throw new Error(`PATCH ${path} → ${res.status}`)
  return res.json()
}

export async function postEmpty(path, token) {
  const res = await fetch(`${API}${path}`, {
    method: 'POST',
    headers: headers(token, false),
  })
  if (!res.ok) throw new Error(`POST ${path} → ${res.status}`)
  return res.json()
}

export async function login(email, password) {
  const res = await fetch(`${API}/auth/login`, {
    method: 'POST',
    headers: headers(undefined),
    body: JSON.stringify({ email, password }),
  })
  if (!res.ok) throw new Error(`Login failed for ${email}: ${res.status}`)
  const data = await res.json()
  return data.accessToken
}

export async function ensureUser(email, password, displayName) {
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
