import { dbGet, patch, post, postEmpty } from './api.mjs'

export async function ensureTask(projectId, taskDef, token) {
  const title = taskDef.title.replace(/'/g, "''")
  const existing = dbGet(`SELECT id FROM tasks WHERE title = '${title}' AND project_id = '${projectId}'`)
  if (existing) {
    console.log(`  ↳ "${taskDef.title}" exists`)
    return existing
  }
  const { tags = [], backgroundColor, doerId, ...payload } = taskDef
  const task = await post(`/projects/${projectId}/tasks`, payload, token)
  const updates = {}
  if (backgroundColor) updates.backgroundColor = backgroundColor
  if (doerId) updates.doerId = doerId
  if (Object.keys(updates).length) {
    await patch(`/projects/${projectId}/tasks/${task.id}`, updates, token)
  }
  for (const tag of tags) {
    await postEmpty(`/projects/${projectId}/tasks/${task.id}/tags/${tag}`, token)
  }
  console.log(`  ✓ [${taskDef.column}] ${taskDef.title}`)
  return task.id
}

export async function seedTasks(projectId, definitions, token) {
  const ids = {}
  for (const { key, task } of definitions) {
    ids[key] = await ensureTask(projectId, task, token)
  }
  return ids
}

export async function linkTasks(projectId, taskIds, pairs, token) {
  for (const [left, right] of pairs) {
    const a = taskIds[left]
    const b = taskIds[right]
    if (typeof a !== 'string' || typeof b !== 'string') continue
    const already = dbGet(`SELECT 1 FROM task_links WHERE (task_id='${a}' AND linked_task_id='${b}') OR (task_id='${b}' AND linked_task_id='${a}')`)
    if (!already) {
      try { await postEmpty(`/projects/${projectId}/tasks/${a}/links/${b}`, token) } catch {}
    }
  }
}

export async function addWatcher(projectId, taskId, userId, token) {
  if (typeof taskId !== 'string') return
  const hasWatcher = dbGet(`SELECT 1 FROM task_watchers WHERE task_id='${taskId}' AND user_id='${userId}'`)
  if (!hasWatcher) {
    try { await postEmpty(`/projects/${projectId}/tasks/${taskId}/watchers/${userId}`, token) } catch {}
  }
}

export async function archiveDoneTasks(projectId, taskIds, token) {
  for (const taskId of taskIds.filter(t => typeof t === 'string')) {
    const isArchived = dbGet(`SELECT archived_at FROM tasks WHERE id = '${taskId}'`)
    if (isArchived && isArchived !== 'null' && isArchived !== '') continue
    try {
      await post(`/projects/${projectId}/tasks/archive`, { taskIds: [taskId] }, token)
      console.log(`  ✓ archived task`)
    } catch (e) {
      console.log(`  ↳ archive: ${e.message}`)
    }
  }
}
