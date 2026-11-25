import type { TaskState } from '../domain/task-state.js';

export type TaskReadinessReason =
  | 'requirements_missing'
  | 'acceptance_criteria_missing'
  | 'open_questions'
  | 'plan_missing'
  | 'plan_outdated'
  | 'plan_steps_missing'
  | 'verification_steps_missing'
  | 'approval_missing'
  | 'approval_outdated';

export interface TaskReadiness {
  ready: boolean;
  reasons: TaskReadinessReason[];
}

function hasContent(items: string[]): boolean {
  return items.length > 0 && items.every((item) => item.trim().length > 0);
}

export function getPlanApprovalReadiness(task: TaskState): TaskReadiness {
  const reasons: TaskReadinessReason[] = [];
  if (!task.requirements.description.trim()) reasons.push('requirements_missing');
  if (!hasContent(task.requirements.acceptanceCriteria)) reasons.push('acceptance_criteria_missing');
  if (task.requirements.openQuestions.length > 0) reasons.push('open_questions');

  if (!task.plan) {
    reasons.push('plan_missing');
  } else {
    if (task.plan.requirementsRevision !== task.requirements.revision) reasons.push('plan_outdated');
    if (!hasContent(task.plan.steps)) reasons.push('plan_steps_missing');
    if (!hasContent(task.plan.verificationSteps)) reasons.push('verification_steps_missing');
  }

  return { ready: reasons.length === 0, reasons };
}

export function getTaskReadiness(task: TaskState): TaskReadiness {
  const { reasons } = getPlanApprovalReadiness(task);
  if (!task.approval) {
    reasons.push('approval_missing');
  } else if (!task.plan ||
    task.approval.planRevision !== task.plan.revision ||
    task.approval.requirementsRevision !== task.requirements.revision) {
    reasons.push('approval_outdated');
  }
  return { ready: reasons.length === 0, reasons };
}
