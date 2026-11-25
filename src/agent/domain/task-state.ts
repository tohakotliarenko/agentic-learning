export interface TaskSource {
  type: 'github_issue' | 'manual';
  reference: string | null;
}

export interface TaskRequirements {
  revision: number;
  description: string;
  acceptanceCriteria: string[];
  openQuestions: string[];
}

export interface TaskPlan {
  revision: number;
  requirementsRevision: number;
  steps: string[];
  verificationSteps: string[];
}

export interface TaskApproval {
  planRevision: number;
  requirementsRevision: number;
  approvedAt: string;
}

export interface TaskState {
  schemaVersion: 1;
  taskId: string;
  revision: number;
  createdAt: string;
  updatedAt: string;
  source: TaskSource;
  requirements: TaskRequirements;
  plan: TaskPlan | null;
  approval: TaskApproval | null;
}
