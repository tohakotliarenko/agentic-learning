import { describe, expect, it } from 'vitest';
import { approvePlan, createTask, setPlan, updateRequirements } from '../../src/agent/application/task-state.js';
import { getTaskReadiness } from '../../src/agent/policies/task-readiness-policy.js';
import type { TaskState } from '../../src/agent/domain/task-state.js';

const createdAt = '2026-11-25T10:00:00.000Z';
const updatedAt = '2026-11-25T11:00:00.000Z';
const requirements = {
  description: 'Introduce persistent task state',
  acceptanceCriteria: ['Restore task state without chat history'],
  openQuestions: [],
};
const plan = { steps: ['Add TaskStore'], verificationSteps: ['Run persistence tests'] };

function task(): TaskState {
  return createTask({
    taskId: 'task-1',
    source: { type: 'manual', reference: null },
    requirements,
  }, createdAt);
}

describe('task state operations', () => {
  it('creates a versioned requirements snapshot without a plan or approval', () => {
    expect(task()).toEqual({
      schemaVersion: 1,
      taskId: 'task-1',
      revision: 1,
      createdAt,
      updatedAt: createdAt,
      source: { type: 'manual', reference: null },
      requirements: { ...requirements, revision: 1 },
      plan: null,
      approval: null,
    });
    expect(getTaskReadiness(task())).toEqual({
      ready: false, reasons: ['plan_missing', 'approval_missing'],
    });
  });

  it('requires approval of a current plan before implementation is ready', () => {
    const planned = setPlan(task(), plan, updatedAt);
    expect(planned.revision).toBe(2);
    expect(planned.plan).toEqual({ ...plan, revision: 1, requirementsRevision: 1 });
    expect(getTaskReadiness(planned)).toEqual({ ready: false, reasons: ['approval_missing'] });

    const approved = approvePlan(planned, updatedAt);
    expect(approved.revision).toBe(3);
    expect(approved.approval).toEqual({
      planRevision: 1, requirementsRevision: 1, approvedAt: updatedAt,
    });
    expect(getTaskReadiness(approved)).toEqual({ ready: true, reasons: [] });
  });

  it('retains an outdated plan and clears approval after requirements change', () => {
    const approved = approvePlan(setPlan(task(), plan, createdAt), createdAt);
    const changed = updateRequirements(approved, {
      ...requirements, acceptanceCriteria: ['Also invalidate stale approval'],
    }, updatedAt);

    expect(changed.revision).toBe(4);
    expect(changed.requirements.revision).toBe(2);
    expect(changed.createdAt).toBe(createdAt);
    expect(changed.updatedAt).toBe(updatedAt);
    expect(changed.plan).toEqual(approved.plan);
    expect(changed.approval).toBeNull();
    expect(getTaskReadiness(changed)).toEqual({
      ready: false, reasons: ['plan_outdated', 'approval_missing'],
    });
    expect(() => approvePlan(changed, updatedAt)).toThrow('plan_outdated');

    const replanned = setPlan(changed, plan, updatedAt);
    expect(replanned.plan?.revision).toBe(2);
    expect(replanned.plan?.requirementsRevision).toBe(2);
    expect(getTaskReadiness(approvePlan(replanned, updatedAt)).ready).toBe(true);
  });

  it('requires fresh approval even when a replacement plan has identical steps', () => {
    const approved = approvePlan(setPlan(task(), plan, createdAt), createdAt);
    const replanned = setPlan(approved, plan, updatedAt);
    expect(replanned.revision).toBe(4);
    expect(replanned.plan?.revision).toBe(2);
    expect(replanned.approval).toBeNull();
    expect(getTaskReadiness(replanned)).toEqual({ ready: false, reasons: ['approval_missing'] });
    expect(approvePlan(replanned, updatedAt).approval?.planRevision).toBe(2);
  });

  it.each([
    { field: 'description', value: '   ', reason: 'requirements_missing' },
    { field: 'acceptanceCriteria', value: [], reason: 'acceptance_criteria_missing' },
    { field: 'acceptanceCriteria', value: ['valid', '  '], reason: 'acceptance_criteria_missing' },
    { field: 'openQuestions', value: ['Which format?'], reason: 'open_questions' },
  ])('blocks approval for $reason', ({ field, value, reason }) => {
    const changed = updateRequirements(task(), { ...requirements, [field]: value }, updatedAt);
    const planned = setPlan(changed, plan, updatedAt);
    expect(getTaskReadiness(planned).reasons).toContain(reason);
    expect(() => approvePlan(planned, updatedAt)).toThrow(reason);
  });

  it.each([
    { steps: [], verificationSteps: plan.verificationSteps, reason: 'plan_steps_missing' },
    { steps: [' '], verificationSteps: plan.verificationSteps, reason: 'plan_steps_missing' },
    { steps: plan.steps, verificationSteps: [], reason: 'verification_steps_missing' },
    { steps: plan.steps, verificationSteps: [' '], reason: 'verification_steps_missing' },
  ])('blocks approval for $reason', ({ steps, verificationSteps, reason }) => {
    const planned = setPlan(task(), { steps, verificationSteps }, updatedAt);
    expect(() => approvePlan(planned, updatedAt)).toThrow(reason);
  });

  it('rejects approval without a plan', () => {
    expect(() => approvePlan(task(), updatedAt)).toThrow('plan_missing');
  });

  it('does not mutate previous snapshots or retain mutable input arrays', () => {
    const initial = task();
    const initialSnapshot = structuredClone(initial);
    const planned = setPlan(initial, plan, updatedAt);
    const plannedSnapshot = structuredClone(planned);
    const approved = approvePlan(planned, updatedAt);
    const approvedSnapshot = structuredClone(approved);
    updateRequirements(approved, requirements, updatedAt);
    setPlan(approved, plan, updatedAt);
    expect(initial).toEqual(initialSnapshot);
    expect(planned).toEqual(plannedSnapshot);
    expect(approved).toEqual(approvedSnapshot);

    const input = structuredClone(requirements);
    const source = { type: 'manual' as const, reference: 'original' };
    const created = createTask({ taskId: 'copy', source, requirements: input }, createdAt);
    const updated = updateRequirements(created, input, updatedAt);
    const planInput = structuredClone(plan);
    const withPlan = setPlan(updated, planInput, updatedAt);
    input.acceptanceCriteria.push('later change');
    source.reference = 'changed';
    planInput.steps.push('later step');
    planInput.verificationSteps.push('later check');
    expect(created.requirements.acceptanceCriteria).toEqual(requirements.acceptanceCriteria);
    expect(updated.requirements.acceptanceCriteria).toEqual(requirements.acceptanceCriteria);
    expect(created.source.reference).toBe('original');
    expect(withPlan.plan?.steps).toEqual(plan.steps);
    expect(withPlan.plan?.verificationSteps).toEqual(plan.verificationSteps);
  });
});

describe('getTaskReadiness', () => {
  it.each([
    { planRevision: 2, requirementsRevision: 1 },
    { planRevision: 1, requirementsRevision: 2 },
  ])('rejects approval for other revisions: %j', (revisions) => {
    const approved = approvePlan(setPlan(task(), plan, createdAt), createdAt);
    approved.approval = { ...revisions, approvedAt: createdAt };
    expect(getTaskReadiness(approved)).toEqual({ ready: false, reasons: ['approval_outdated'] });
  });

  it('does not let matching approval hide an outdated plan or unresolved question', () => {
    const approved = approvePlan(setPlan(task(), plan, createdAt), createdAt);
    const inconsistent: TaskState = {
      ...approved,
      requirements: { ...approved.requirements, revision: 2, openQuestions: ['Clarify scope'] },
      approval: { planRevision: 1, requirementsRevision: 2, approvedAt: createdAt },
    };
    expect(getTaskReadiness(inconsistent)).toEqual({
      ready: false, reasons: ['open_questions', 'plan_outdated'],
    });
  });

  it('returns deterministic results without mutating the snapshot', () => {
    const state = task();
    const before = structuredClone(state);
    const first = getTaskReadiness(state);
    first.reasons.push('approval_outdated');
    expect(getTaskReadiness(state)).toEqual({ ready: false, reasons: ['plan_missing', 'approval_missing'] });
    expect(state).toEqual(before);
  });
});
