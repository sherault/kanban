import type { Column, TaskDto, TaskHistoryDto } from "@kanban/shared";
import type { AppDb, Broadcaster } from "../../types.js";
import { noopBroadcaster } from "../../types.js";
import {
  type ArchivedTaskListOptions,
  TaskArchiveListOperations,
} from "./task-service/archive-list.js";
import { TaskArchiveOperations } from "./task-service/archive.js";
import {
  type CreateTaskInput,
  TaskCreateListOperations,
} from "./task-service/create-list.js";
import { TaskImportSearchOperations } from "./task-service/import-search.js";
import { TaskMoveOperations } from "./task-service/move.js";
import { TaskParticipantOperations } from "./task-service/participants.js";
import { TaskRelationOperations } from "./task-service/relations.js";
import {
  type UpdateTaskInput,
  TaskUpdateHistoryOperations,
} from "./task-service/update-delete-history.js";

export class TaskService {
  private readonly archive: TaskArchiveOperations;
  private readonly archiveList: TaskArchiveListOperations;
  private readonly createList: TaskCreateListOperations;
  private readonly importSearch: TaskImportSearchOperations;
  private readonly move: TaskMoveOperations;
  private readonly participants: TaskParticipantOperations;
  private readonly relations: TaskRelationOperations;
  private readonly updateHistory: TaskUpdateHistoryOperations;

  constructor(db: AppDb, broadcast: Broadcaster = noopBroadcaster) {
    this.archive = new TaskArchiveOperations(db, broadcast);
    this.archiveList = new TaskArchiveListOperations(db, broadcast);
    this.createList = new TaskCreateListOperations(db, broadcast);
    this.importSearch = new TaskImportSearchOperations(db, broadcast);
    this.move = new TaskMoveOperations(db, broadcast);
    this.participants = new TaskParticipantOperations(db, broadcast);
    this.relations = new TaskRelationOperations(db, broadcast);
    this.updateHistory = new TaskUpdateHistoryOperations(db, broadcast);
  }

  createTask(
    projectId: string,
    reporterId: string,
    input: CreateTaskInput,
    isMcp?: boolean,
  ): TaskDto {
    return this.createList.createTask(projectId, reporterId, input, isMcp);
  }

  getTask(taskId: string): TaskDto | undefined {
    return this.createList.getTask(taskId);
  }

  listTasks(
    projectId: string,
    options: { search?: string | undefined } = {},
  ): TaskDto[] {
    return this.createList.listTasks(projectId, options);
  }

  updateTask(
    taskId: string,
    actorId: string,
    input: UpdateTaskInput,
    isMcp?: boolean,
  ): TaskDto {
    return this.updateHistory.updateTask(taskId, actorId, input, isMcp);
  }

  deleteTask(taskId: string, actorId?: string, isMcp?: boolean): void {
    this.updateHistory.deleteTask(taskId, actorId, isMcp);
  }

  getTaskHistory(taskId: string): TaskHistoryDto[] {
    return this.updateHistory.getTaskHistory(taskId);
  }

  addTag(taskId: string, tag: string, actorId: string): TaskDto {
    return this.relations.addTag(taskId, tag, actorId);
  }

  removeTag(taskId: string, tag: string, actorId: string): TaskDto {
    return this.relations.removeTag(taskId, tag, actorId);
  }

  addLink(taskId: string, linkedTaskId: string, actorId?: string): TaskDto {
    return this.relations.addLink(taskId, linkedTaskId, actorId);
  }

  removeLink(taskId: string, linkedTaskId: string, actorId?: string): TaskDto {
    return this.relations.removeLink(taskId, linkedTaskId, actorId);
  }

  addWatcher(taskId: string, userId: string, actorId: string): TaskDto {
    return this.participants.addWatcher(taskId, userId, actorId);
  }

  removeWatcher(taskId: string, userId: string, actorId: string): TaskDto {
    return this.participants.removeWatcher(taskId, userId, actorId);
  }

  addAdvisor(taskId: string, userId: string, actorId: string): TaskDto {
    return this.participants.addAdvisor(taskId, userId, actorId);
  }

  removeAdvisor(taskId: string, userId: string, actorId: string): TaskDto {
    return this.participants.removeAdvisor(taskId, userId, actorId);
  }

  moveTask(
    taskId: string,
    actorId: string,
    input: { column: Column },
    isMcp?: boolean,
  ): TaskDto {
    return this.move.moveTask(taskId, actorId, input, isMcp);
  }

  archiveTasks(
    projectId: string,
    taskIds: string[],
    actorId: string,
    isMcp?: boolean,
  ): void {
    this.archive.archiveTasks(projectId, taskIds, actorId, isMcp);
  }

  restoreTask(taskId: string, actorId: string, isMcp?: boolean): TaskDto {
    return this.archive.restoreTask(taskId, actorId, isMcp);
  }

  listArchivedTasks(
    projectId: string,
    opts: ArchivedTaskListOptions = {},
  ): { tasks: TaskDto[]; total: number } {
    return this.archiveList.listArchivedTasks(projectId, opts);
  }

  importTasks(
    projectId: string,
    reporterId: string,
    csvText: string,
  ): { imported: number; skipped: number } {
    return this.importSearch.importTasks(projectId, reporterId, csvText);
  }

  searchTasksInOrg(
    orgId: string,
    query: string,
    limit: number = 20,
  ): Array<TaskDto & { projectName: string }> {
    return this.importSearch.searchTasksInOrg(orgId, query, limit);
  }

  getTaskGlobal(taskId: string): TaskDto | undefined {
    return this.importSearch.getTaskGlobal(taskId);
  }
}
