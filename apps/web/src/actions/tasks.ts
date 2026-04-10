'use server'

import { redirect } from 'next/navigation'
import { revalidatePath } from 'next/cache'
import { api, ApiError } from '../lib/api'
import { getAccessToken } from '../lib/session'
import { Column } from '@kanban/shared'
import type { TaskDto, TaskHistoryDto } from '@kanban/shared'

export async function createTaskAction(
  projectId: string,
  orgId: string,
  _prev: { error?: string; task?: TaskDto },
  formData: FormData
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const title = formData.get('title') as string
  const column = (formData.get('column') as Column) ?? Column.TODO
  const startDate = formData.get('startDate') as string
  const endDate = formData.get('endDate') as string
  const description = (formData.get('description') as string) || null
  const objective = (formData.get('objective') as string) || null
  const tags = formData.getAll('tags') as string[]
  const bgRaw = formData.get('backgroundColor') as string | null
  const backgroundColor = bgRaw && bgRaw !== '#ffffff' ? bgRaw : null

  try {
    const { data: task } = await api.tasks.create(token, projectId, {
      title,
      column,
      startDate,
      endDate,
      description,
      objective,
      tags,
      backgroundColor,
    })
    revalidatePath(`/orgs/${orgId}/projects/${projectId}`)
    return { task }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to create task' }
  }
}

export async function updateTaskAction(
  projectId: string,
  taskId: string,
  body: {
    title?: string
    description?: string | null
    objective?: string | null
    startDate?: string
    endDate?: string
    doerId?: string | null
    validatorId?: string | null
    backgroundColor?: string | null
    globalSubject?: string | null
  }
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data: task } = await api.tasks.update(token, projectId, taskId, body)
    return { task }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to update task' }
  }
}

export async function deleteTaskAction(
  projectId: string,
  taskId: string
): Promise<{ error?: string }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    await api.tasks.delete(token, projectId, taskId)
    return {}
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to delete task' }
  }
}

export async function importCsvAction(
  projectId: string,
  _prev: { error?: string; result?: { imported: number; skipped: number } },
  formData: FormData
): Promise<{ error?: string; result?: { imported: number; skipped: number } }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  const file = formData.get('file')
  if (!(file instanceof File) || file.size === 0) return { error: 'Please select a CSV file' }

  try {
    const { data: result } = await api.tasks.importCsv(token, projectId, file)
    revalidatePath(`/orgs/[orgId]/projects/${projectId}`)
    return { result }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Import failed' }
  }
}

export async function getTaskHistoryAction(
  projectId: string,
  taskId: string
): Promise<{ history?: TaskHistoryDto[]; error?: string }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data: history } = await api.tasks.getHistory(token, projectId, taskId)
    return { history }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to load history' }
  }
}

export async function addTagAction(
  projectId: string,
  taskId: string,
  tag: string
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data: task } = await api.tasks.addTag(token, projectId, taskId, tag)
    return { task }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to add tag' }
  }
}

export async function removeTagAction(
  projectId: string,
  taskId: string,
  tag: string
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data: task } = await api.tasks.removeTag(token, projectId, taskId, tag)
    return { task }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to remove tag' }
  }
}

export async function addWatcherAction(
  projectId: string,
  taskId: string,
  userId: string
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data: task } = await api.tasks.addWatcher(token, projectId, taskId, userId)
    return { task }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to add watcher' }
  }
}

export async function removeWatcherAction(
  projectId: string,
  taskId: string,
  userId: string
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data: task } = await api.tasks.removeWatcher(token, projectId, taskId, userId)
    return { task }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to remove watcher' }
  }
}

export async function addAdvisorAction(
  projectId: string,
  taskId: string,
  userId: string
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data: task } = await api.tasks.addAdvisor(token, projectId, taskId, userId)
    return { task }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to add advisor' }
  }
}

export async function removeAdvisorAction(
  projectId: string,
  taskId: string,
  userId: string
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data: task } = await api.tasks.removeAdvisor(token, projectId, taskId, userId)
    return { task }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to remove advisor' }
  }
}

export async function moveTaskAction(
  projectId: string,
  taskId: string,
  column: Column
): Promise<{ error?: string; task?: TaskDto }> {
  const token = await getAccessToken()
  if (!token) redirect('/login')

  try {
    const { data: task } = await api.tasks.move(token, projectId, taskId, { column })
    return { task }
  } catch (e) {
    return { error: e instanceof ApiError ? e.message : 'Failed to move task' }
  }
}
