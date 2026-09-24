import type { VerificationClaims, VerificationState } from '../domain/verification-state.js';

export function unsupportedVerificationClaims(
  claims: VerificationClaims,
  actual: VerificationState,
): (keyof VerificationClaims)[] {
  const checks: (keyof VerificationClaims)[] = ['testsPassed', 'lintPassed', 'typecheckPassed'];
  return checks.filter((check) => claims[check] && actual[check] !== 'passed');
}
