import { randomUUID } from 'node:crypto';
import { mkdir, readFile, rename, rm, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { z } from 'zod';
import type { TaskState } from '../../domain/task-state.js';
import type { TaskStore } from '../../ports/task-store.js';

const revisionSchema = z.number().int().positive().max(Number.MAX_SAFE_INTEGER);
const taskSchema = z.strictObject({
  schemaVersion: z.literal(1),
  taskId: z.string().regex(/^[a-zA-Z0-9_-]+$/),
  revision: revisionSchema,
  createdAt: z.iso.datetime(),
  updatedAt: z.iso.datetime(),
  source: z.discriminatedUnion('type', [
    z.strictObject({ type: z.literal('github_issue'), reference: z.url() }),
    z.strictObject({ type: z.literal('manual'), reference: z.string().nullable() }),
  ]),
  requirements: z.strictObject({
    revision: revisionSchema,
    description: z.string(),
    acceptanceCriteria: z.array(z.string()),
    openQuestions: z.array(z.string()),
  }),
  plan: z.strictObject({
    revision: revisionSchema,
    requirementsRevision: revisionSchema,
    steps: z.array(z.string()),
    verificationSteps: z.array(z.string()),
  }).nullable(),
  approval: z.strictObject({
    planRevision: revisionSchema,
    requirementsRevision: revisionSchema,
    approvedAt: z.iso.datetime(),
  }).nullable(),
}).refine((task) =>
  task.requirements.revision <= task.revision &&
  (!task.plan || (task.plan.revision <= task.revision &&
    task.plan.requirementsRevision <= task.requirements.revision)) &&
  (!task.approval || (task.plan !== null &&
    task.approval.planRevision === task.plan.revision &&
    task.approval.requirementsRevision === task.plan.requirementsRevision &&
    task.approval.requirementsRevision === task.requirements.revision)),
);

function validate(value: unknown, taskId: string): TaskState {
  if (typeof value === 'object' && value !== null &&
    'schemaVersion' in value && value.schemaVersion !== 1) {
    throw new Error('Unsupported task state schemaVersion.');
  }
  const result = taskSchema.safeParse(value);
  if (!result.success || result.data.taskId !== taskId) {
    throw new Error('Invalid persisted task state.');
  }
  return result.data;
}

export class FileTaskStore implements TaskStore {
  constructor(private readonly directory: string) {}

  private path(taskId: string): string {
    if (!/^[a-zA-Z0-9_-]+$/.test(taskId)) throw new Error('Invalid task ID.');
    return join(this.directory, taskId + '.json');
  }

  async save(task: TaskState): Promise<void> {
    const path = this.path(task.taskId);
    const validated = validate(task, task.taskId);
    await mkdir(this.directory, { recursive: true });
    const temporary = path + '.' + randomUUID() + '.tmp';
    try {
      await writeFile(temporary, JSON.stringify(validated), { encoding: 'utf8', mode: 0o600 });
      await rename(temporary, path);
    } finally {
      await rm(temporary, { force: true });
    }
  }

  async load(taskId: string): Promise<TaskState | null> {
    const path = this.path(taskId);
    let text: string;
    try {
      text = await readFile(path, 'utf8');
    } catch (error) {
      if (typeof error === 'object' && error !== null && 'code' in error && error.code === 'ENOENT') {
        return null;
      }
      throw error;
    }
    let value: unknown;
    try {
      value = JSON.parse(text);
    } catch (cause) {
      throw new Error('Invalid persisted task state JSON.', { cause });
    }
    return validate(value, taskId);
  }
}
