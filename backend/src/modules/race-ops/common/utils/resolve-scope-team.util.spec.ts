import { ForbiddenException } from '@nestjs/common';
import { resolveScopeTeamId } from './resolve-scope-team.util';
import { OpsUserContext } from '../types/ops-jwt-payload.type';

describe('resolveScopeTeamId — BR-02 helper', () => {
  const base: Omit<OpsUserContext, 'role' | 'team_id'> = {
    userId: 'u1',
    sub: 'u1',
    token_type: 'ops',
    tenant_id: 't1',
    event_id: 'e1',
    phone: '090',
    full_name: 'Test',
  };

  it('ops_admin → undefined (no scope, sees all teams)', () => {
    const ctx: OpsUserContext = { ...base, role: 'ops_admin' };
    expect(resolveScopeTeamId(ctx)).toBeUndefined();
  });

  it('ops_admin w/o team_id → still undefined (admin not scoped)', () => {
    const ctx: OpsUserContext = {
      ...base,
      role: 'ops_admin',
      team_id: undefined,
    };
    expect(resolveScopeTeamId(ctx)).toBeUndefined();
  });

  it('ops_leader w/ team_id → returns team_id', () => {
    const ctx: OpsUserContext = {
      ...base,
      role: 'ops_leader',
      team_id: 'team-water',
    };
    expect(resolveScopeTeamId(ctx)).toBe('team-water');
  });

  it('ops_leader w/o team_id → ForbiddenException 403', () => {
    const ctx: OpsUserContext = { ...base, role: 'ops_leader' };
    expect(() => resolveScopeTeamId(ctx)).toThrow(ForbiddenException);
    expect(() => resolveScopeTeamId(ctx)).toThrow(/assigned to a team/i);
  });

  it('ops_crew (edge: role-guard should block at controller, but defensive) → 403', () => {
    const ctx: OpsUserContext = {
      ...base,
      role: 'ops_crew',
    };
    expect(() => resolveScopeTeamId(ctx)).toThrow(ForbiddenException);
  });

  it('ops_crew with team_id → returns team_id (defensive pass-through)', () => {
    const ctx: OpsUserContext = {
      ...base,
      role: 'ops_crew',
      team_id: 'team-x',
    };
    // Same branch as leader — util coi crew cũng cần team. Role-guard ở
    // controller mới là rào chặn chính. Util chỉ enforce "must have team_id".
    expect(resolveScopeTeamId(ctx)).toBe('team-x');
  });
});
