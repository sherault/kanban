import type { Column } from '../enums/columns.js'
import type { UserDto } from './identity.js'

export interface TaskDto {
  id: string
  projectId: string
  column: Column
  title: string
  description: string | null
  objective: string | null
  startDate: string
  endDate: string
  backgroundColor: string | null
  globalSubject: string | null
  position: number
  reporter: Pick<UserDto, 'id' | 'displayName'>
  doer: Pick<UserDto, 'id' | 'displayName'> | null
  validator: Pick<UserDto, 'id' | 'displayName'> | null
  watchers: Array<Pick<UserDto, 'id' | 'displayName'>>
  advisors: Array<Pick<UserDto, 'id' | 'displayName'>>
  tags: string[]
  linkedTaskIds: string[]
  createdAt: string
  updatedAt: string
}

export interface TaskHistoryDto {
  id: string
  taskId: string
  actor: Pick<UserDto, 'id' | 'displayName'>
  field: string
  oldValue: string | null
  newValue: string | null
  changedAt: string
  batchId: string | null
}

export interface TaskLinkDto {
  taskId: string
  linkedTaskId: string
}
