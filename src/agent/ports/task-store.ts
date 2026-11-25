import type { TaskState } from '../domain/task-state.js';

export interface TaskStore {
  load(taskId: string): Promise<TaskState | null>;
  save(task: TaskState): Promise<void>;
}
