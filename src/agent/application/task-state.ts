import type { TaskPlan, TaskRequirements, TaskSource, TaskState } from '../domain/task-state.js';
import { getPlanApprovalReadiness } from '../policies/task-readiness-policy.js';

type RequirementsInput = Omit<TaskRequirements, 'revision'>;
type PlanInput = Omit<TaskPlan, 'revision' | 'requirementsRevision'>;

export function createTask(
  input: { taskId: string; source: TaskSource; requirements: RequirementsInput },
  timestamp: string,
): TaskState {
  return {
    schemaVersion: 1,
    taskId: input.taskId,
    revision: 1,
    createdAt: timestamp,
    updatedAt: timestamp,
    source: { ...input.source },
    requirements: {
      revision: 1,
      description: input.requirements.description,
      acceptanceCriteria: [...input.requirements.acceptanceCriteria],
      openQuestions: [...input.requirements.openQuestions],
    },
    plan: null,
    approval: null,
  };
}

export function updateRequirements(
  task: TaskState,
  requirements: RequirementsInput,
  timestamp: string,
): TaskState {
  return {
    ...task,
    revision: task.revision + 1,
    updatedAt: timestamp,
    requirements: {
      revision: task.requirements.revision + 1,
      description: requirements.description,
      acceptanceCriteria: [...requirements.acceptanceCriteria],
      openQuestions: [...requirements.openQuestions],
    },
    approval: null,
  };
}

export function setPlan(task: TaskState, plan: PlanInput, timestamp: string): TaskState {
  return {
    ...task,
    revision: task.revision + 1,
    updatedAt: timestamp,
    plan: {
      revision: (task.plan?.revision ?? 0) + 1,
      requirementsRevision: task.requirements.revision,
      steps: [...plan.steps],
      verificationSteps: [...plan.verificationSteps],
    },
    approval: null,
  };
}

// Call only at the application boundary after the user approves the current plan.
export function approvePlan(task: TaskState, timestamp: string): TaskState {
  const readiness = getPlanApprovalReadiness(task);
  if (!readiness.ready || !task.plan) {
    throw new Error(`Cannot approve task plan: ${readiness.reasons.join(', ')}.`);
  }
  return {
    ...task,
    revision: task.revision + 1,
    updatedAt: timestamp,
    approval: {
      planRevision: task.plan.revision,
      requirementsRevision: task.requirements.revision,
      approvedAt: timestamp,
    },
  };
}
