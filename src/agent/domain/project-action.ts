export type ProjectCheckAction = 'test' | 'lint' | 'typecheck' | 'git_status' | 'git_diff';
export type ProjectAction = ProjectCheckAction | 'implement';
