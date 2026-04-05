import { Hono } from 'hono'
import { zValidator } from '@hono/zod-validator'
import { z } from 'zod'
import type { AppDb, Broadcaster, HonoEnv } from '../../types.js'
import { noopBroadcaster } from '../../types.js'
import { authnMiddleware } from '../../middleware/authn.js'
import { makeProjectAuthz } from '../../middleware/project-member.js'
import { TaskService } from './task.service.js'
import { notFound } from '../../lib/errors.js'

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
  router.use('/:projectId/tasks', projectAuthz.requireProjectMember())
  router.use('/:projectId/tasks/*', projectAuthz.requireProjectMember())

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

  return router
}
