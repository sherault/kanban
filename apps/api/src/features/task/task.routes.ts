import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppDb, Broadcaster, HonoEnv } from '../../types.js'
import { noopBroadcaster } from '../../types.js'
import { authnMiddleware } from '../../middleware/authn.js'
import { makeProjectAuthz } from '../../middleware/project-member.js'
import { TaskService } from './task.service.js'
import { notFound, unprocessable } from '../../lib/errors.js'

const columnEnum = z.enum(['ideas', 'todo', 'doing', 'done'])

const createTaskSchema = z.object({
  title: z.string().min(1).max(500),
  description: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  startDate: z.string(),
  endDate: z.string(),
  backgroundColor: z.string().nullable().optional(),
  globalSubject: z.string().nullable().optional(),
  column: columnEnum.optional(),
  doerId: z.string().uuid().nullable().optional(),
  validatorId: z.string().uuid().nullable().optional(),
})

const updateTaskSchema = z.object({
  title: z.string().min(1).max(500).optional(),
  description: z.string().nullable().optional(),
  objective: z.string().nullable().optional(),
  startDate: z.string().optional(),
  endDate: z.string().optional(),
  backgroundColor: z.string().nullable().optional(),
  globalSubject: z.string().nullable().optional(),
  doerId: z.string().uuid().nullable().optional(),
  validatorId: z.string().uuid().nullable().optional(),
})

export function taskRoutes(
  db: AppDb,
  broadcast: Broadcaster = noopBroadcaster
): Hono<HonoEnv> {
  const router = new Hono<HonoEnv>()
  const svc = new TaskService(db, broadcast)
  const projectAuthz = makeProjectAuthz(db)

  router.use('*', authnMiddleware)

  // All task routes require project membership (sets orgId in context)
  router.use('/:projectId/*', projectAuthz.requireProjectMember())

  // CRUD
  router.get('/:projectId/tasks', (c) => c.json(svc.listTasks(c.req.param('projectId'))))

  router.post(
    '/:projectId/tasks',
    zValidator('json', createTaskSchema),
    (c) => {
      const task = svc.createTask(
        c.req.param('projectId'),
        c.get('userId'),
        c.req.valid('json')
      )
      return c.json(task, 201)
    }
  )

  router.get('/:projectId/tasks/:taskId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(task)
  })

  router.patch(
    '/:projectId/tasks/:taskId',
    zValidator('json', updateTaskSchema),
    (c) => {
      const task = svc.getTask(c.req.param('taskId'))
      if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
      return c.json(svc.updateTask(c.req.param('taskId'), c.get('userId'), c.req.valid('json')))
    }
  )

  router.delete('/:projectId/tasks/:taskId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    svc.deleteTask(c.req.param('taskId'))
    return c.json({ success: true })
  })

  router.get('/:projectId/tasks/:taskId/history', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.getTaskHistory(c.req.param('taskId')))
  })

  // Tags
  router.post('/:projectId/tasks/:taskId/tags/:tag', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.addTag(c.req.param('taskId'), c.req.param('tag')))
  })

  router.delete('/:projectId/tasks/:taskId/tags/:tag', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.removeTag(c.req.param('taskId'), c.req.param('tag')))
  })

  // Links
  router.post('/:projectId/tasks/:taskId/links/:linkedTaskId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.addLink(c.req.param('taskId'), c.req.param('linkedTaskId')))
  })

  router.delete('/:projectId/tasks/:taskId/links/:linkedTaskId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.removeLink(c.req.param('taskId'), c.req.param('linkedTaskId')))
  })

  // Watchers
  router.post('/:projectId/tasks/:taskId/watchers/:userId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.addWatcher(c.req.param('taskId'), c.req.param('userId'), c.get('userId')))
  })

  router.delete('/:projectId/tasks/:taskId/watchers/:userId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.removeWatcher(c.req.param('taskId'), c.req.param('userId'), c.get('userId')))
  })

  // Advisors
  router.post('/:projectId/tasks/:taskId/advisors/:userId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.addAdvisor(c.req.param('taskId'), c.req.param('userId'), c.get('userId')))
  })

  router.delete('/:projectId/tasks/:taskId/advisors/:userId', (c) => {
    const task = svc.getTask(c.req.param('taskId'))
    if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
    return c.json(svc.removeAdvisor(c.req.param('taskId'), c.req.param('userId'), c.get('userId')))
  })

  const moveSchema = z.object({
    column: columnEnum,
    position: z.number().positive().optional(),
  })

  const reorderSchema = z.object({
    position: z.number().positive(),
  })

  router.post(
    '/:projectId/tasks/:taskId/move',
    zValidator('json', moveSchema),
    (c) => {
      const task = svc.getTask(c.req.param('taskId'))
      if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
      return c.json(svc.moveTask(c.req.param('taskId'), c.get('userId'), c.req.valid('json')))
    }
  )

  router.post(
    '/:projectId/tasks/:taskId/reorder',
    zValidator('json', reorderSchema),
    (c) => {
      const task = svc.getTask(c.req.param('taskId'))
      if (!task || task.projectId !== c.req.param('projectId')) throw notFound('Task not found')
      return c.json(svc.reorderTask(c.req.param('taskId'), c.req.valid('json').position))
    }
  )

  // CSV import
  router.post('/:projectId/import', async (c) => {
    const body = await c.req.parseBody()
    const file = body['file']
    if (!(file instanceof File)) throw unprocessable('file field required')
    const text = await file.text()
    const result = svc.importTasks(c.req.param('projectId'), c.get('userId'), text)
    return c.json(result, 201)
  })

  return router
}
