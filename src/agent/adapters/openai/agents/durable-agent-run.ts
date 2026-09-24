import { randomUUID } from 'node:crypto';
import { Runner, RunState, type RunToolApprovalItem } from '@openai/agents';
import type { AgentRunStore } from '../../../ports/agent-run-store.js';
import type { VerificationState } from '../../../domain/verification-state.js';
import { createProjectAgent, runProjectAgent } from './project-agent-factory.js';

type ProjectAgent = ReturnType<typeof createProjectAgent>;
type ProjectResult = Awaited<ReturnType<typeof runProjectAgent>>;

export interface PendingApproval {
  callId: string;
  toolName: string;
  arguments: string;
}

export type DurableRunResult =
  | { status: 'waiting_for_approval'; runId: string; pending: PendingApproval[] }
  | { status: 'completed'; runId: string; finalOutput: NonNullable<ProjectResult['finalOutput']> };

export type ApprovalDecision =
  | { type: 'approve' }
  | { type: 'reject'; message?: string };

function describe(item: RunToolApprovalItem): PendingApproval {
  if (item.rawItem.type !== 'function_call') {
    throw new Error('Unsupported approval interruption type.');
  }
  return { callId: item.rawItem.callId, toolName: item.rawItem.name, arguments: item.rawItem.arguments };
}

export class DurableAgentRun {
  constructor(
    private readonly agent: ProjectAgent,
    private readonly store: AgentRunStore,
    private readonly runner = new Runner({ tracingDisabled: true }),
  ) {}

  async start(input: string): Promise<DurableRunResult> {
    const runId = randomUUID();
    return this.persistResult(runId, await runProjectAgent(this.agent, input, this.runner));
  }

  async resume(runId: string, callId: string, decision: ApprovalDecision): Promise<DurableRunResult> {
    const persisted = await this.store.load(runId);
    if (!persisted) throw new Error('Agent run not found.');
    const state = await RunState.fromString<VerificationState, ProjectAgent>(
      this.agent, persisted.serializedState,
    );
    const interruption = state.getInterruptions().find((item) => describe(item).callId === callId);
    if (!interruption) throw new Error('Pending approval not found.');
    if (decision.type === 'approve') {
      state.approve(interruption);
    } else {
      state.reject(interruption, { message: decision.message });
    }
    // Resume the restored context; runProjectAgent would reset verification state.
    return this.persistResult(runId, await this.runner.run(this.agent, state));
  }

  private async persistResult(runId: string, result: ProjectResult): Promise<DurableRunResult> {
    if (result.interruptions.length > 0) {
      const pending = result.interruptions.map(describe);
      await this.store.save(runId, {
        version: 1, runId, status: 'waiting_for_approval',
        serializedState: result.state.toString(),
      });
      return { status: 'waiting_for_approval', runId, pending };
    }
    if (result.finalOutput === undefined) throw new Error('Agent run ended without final output.');
    await this.store.delete(runId);
    return { status: 'completed', runId, finalOutput: result.finalOutput };
  }
}
