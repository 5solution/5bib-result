/** S3 key prefix cho mọi upload của race-ops. */
export const RACE_OPS_S3_PREFIX = 'race-ops';

/** Redis key prefixes (xem PRD §4.3). */
export const REDIS_KEYS = {
  eventKpi: (eventId: string) => `ops:event:${eventId}:kpi`,
  teamCheckInCount: (eventId: string, teamId: string) =>
    `ops:event:${eventId}:team:${teamId}:checkin_count`,
  supplyAggregate: (eventId: string) => `ops:event:${eventId}:supply_aggregate`,
  userQrHash: (userId: string) => `ops:user:${userId}:qr_hash`,
} as const;

export const REDIS_TTL = {
  eventKpi: 30,
  teamCheckInCount: 30,
  supplyAggregate: 60,
  userQrHash: 24 * 60 * 60,
} as const;

/** Audit action codes — enum string dùng nhất quán trong AuditService. */
export const AUDIT_ACTIONS = {
  APPROVE_APPLICATION: 'APPROVE_APPLICATION',
  REJECT_APPLICATION: 'REJECT_APPLICATION',
  SUBMIT_SUPPLY_ORDER: 'SUBMIT_SUPPLY_ORDER',
  APPROVE_SUPPLY_ORDER: 'APPROVE_SUPPLY_ORDER',
  REJECT_SUPPLY_ORDER: 'REJECT_SUPPLY_ORDER',
  DISPATCH_SUPPLY_ORDER: 'DISPATCH_SUPPLY_ORDER',
  RECEIVE_SUPPLY_ORDER: 'RECEIVE_SUPPLY_ORDER',
  CREATE_CHECK_IN: 'CREATE_CHECK_IN',
  UPDATE_TASK_STATUS: 'UPDATE_TASK_STATUS',
  CREATE_INCIDENT: 'CREATE_INCIDENT',
  ACKNOWLEDGE_INCIDENT: 'ACKNOWLEDGE_INCIDENT',
  RESOLVE_INCIDENT: 'RESOLVE_INCIDENT',
  CREATE_EVENT: 'CREATE_EVENT',
  UPDATE_EVENT: 'UPDATE_EVENT',
  CREATE_TEAM: 'CREATE_TEAM',
  UPDATE_TEAM: 'UPDATE_TEAM',
  ASSIGN_LEADER: 'ASSIGN_LEADER',
} as const;

export type AuditAction = (typeof AUDIT_ACTIONS)[keyof typeof AUDIT_ACTIONS];
