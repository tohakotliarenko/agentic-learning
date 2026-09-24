export type VerificationStatus = 'not_run' | 'passed' | 'failed';

export interface VerificationState {
  testsPassed: VerificationStatus;
  lintPassed: VerificationStatus;
  typecheckPassed: VerificationStatus;
}

export interface VerificationClaims {
  testsPassed: boolean;
  lintPassed: boolean;
  typecheckPassed: boolean;
}

export function createVerificationState(): VerificationState {
  return { testsPassed: 'not_run', lintPassed: 'not_run', typecheckPassed: 'not_run' };
}

