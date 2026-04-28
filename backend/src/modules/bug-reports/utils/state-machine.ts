import { BugStatus } from '../schemas/bug-report.schema';

/**
 * Bug report status state machine. Forward-only with explicit reopen path.
 *
 * Why: prevents admins from accidentally regressing bug status (e.g.
 * resolved → new), which would corrupt the audit trail and confuse
 * reporters subscribed to status updates.
 */
const ALLOWED_TRANSITIONS: Record<BugStatus, ReadonlySet<BugStatus>> = {
  new: new Set(['triaged', 'duplicate', 'wont_fix']),
  triaged: new Set(['in_progress', 'duplicate', 'wont_fix']),
  in_progress: new Set(['resolved', 'wont_fix', 'duplicate']),
  resolved: new Set(['reopened']),
  reopened: new Set(['in_progress', 'wont_fix']),
  wont_fix: new Set(['reopened']),
  duplicate: new Set([]), // terminal — cannot transition out
};

export function isValidTransition(from: BugStatus, to: BugStatus): boolean {
  return ALLOWED_TRANSITIONS[from].has(to);
}

export function getAllowedNextStatuses(from: BugStatus): BugStatus[] {
  return [...ALLOWED_TRANSITIONS[from]];
}

/**
 * SLA response time mapped from severity, used in the public submit response
 * so the reporter immediately sees when to expect a reply.
 */
export const SEVERITY_SLA: Record<string, string> = {
  critical: '≤ 30 phút',
  high: '≤ 4 giờ',
  medium: '≤ 1 ngày',
  low: '≤ 7 ngày',
  unknown: '≤ 4 giờ',
};
