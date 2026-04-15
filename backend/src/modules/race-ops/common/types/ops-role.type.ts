export type OpsRole = 'ops_admin' | 'ops_leader' | 'ops_crew' | 'ops_tnv';

export const OPS_ROLES: ReadonlyArray<OpsRole> = [
  'ops_admin',
  'ops_leader',
  'ops_crew',
  'ops_tnv',
] as const;

export function isOpsRole(value: unknown): value is OpsRole {
  return typeof value === 'string' && (OPS_ROLES as ReadonlyArray<string>).includes(value);
}
