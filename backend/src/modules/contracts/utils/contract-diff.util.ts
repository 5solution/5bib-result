/**
 * F-067 Group Z — Contract diff utilities.
 *
 * Compute structured diff between a `before` and `after` contract snapshot
 * (line items match by `stt`), plus exposed `DOC_AFFECTING_FIELDS` allowlist
 * the post-update hook uses to decide whether to fire-and-forget regen DOCX.
 *
 * Pure functions — no IO. Caller emits via `AuditLogService` (BR-67-13).
 *
 * PAUSE-67-CODER-02 (Manager APPROVE): diff cap 100 line items per bucket
 * (added/removed/modified) to keep audit_logs.metadata payload bounded
 * (~200KB worst case → kept under MongoDB doc 16MB limit + render-friendly).
 */
import type { LineItem } from '../schemas/contract.schema';

/** Field allowlist that, when changed via PATCH /api/contracts/:id, triggers
 *  fire-and-forget DOCX regeneration (BR-67-01). Per Manager Scope Lock §3.2
 *  + BA PRD §4.1.1 — covers line items, totals, party identity, race+event
 *  dates, payment terms, template overrides, revenue share. */
export const DOC_AFFECTING_FIELDS: ReadonlySet<string> = new Set<string>([
  'lineItems',
  'vatRate',
  'paymentTerms',
  'signDate',
  'effectiveDate',
  'endDate',
  'raceDate',
  'raceLocation',
  'raceId',
  'raceName',
  'client',
  'eventStartDate',
  'eventEndDate',
  'setupDate',
  'expoDate',
  'eventLocation',
  'expectedAthleteCount',
  'templateOverrides',
  'revenueShare',
]);

/** Snapshot shape used inside `diff.lineItems.added/removed`. Mirrors the
 *  user-visible line item fields rendered in the DOCX. */
export type LineItemSnapshot = {
  stt: number;
  description: string;
  quantity: number;
  unitPrice: number;
  discount: number;
  amount: number;
  cost?: number;
};

/** Compact diff for one modified line item — `before`/`after` only contain
 *  the keys whose value actually changed (keeps payload small). */
export type LineItemModification = {
  stt: number;
  before: Partial<LineItemSnapshot>;
  after: Partial<LineItemSnapshot>;
};

export type LineItemsDiff = {
  added: LineItemSnapshot[];
  removed: LineItemSnapshot[];
  modified: LineItemModification[];
  /** PAUSE-67-CODER-02 truncate marker — present only when raw counts exceeded
   *  `DIFF_LINE_ITEM_CAP`. Numbers carry the *original* counts so QC can audit. */
  truncated?: true;
  count?: { added: number; removed: number; modified: number };
};

export type ContractUpdateDiff = {
  /** Subset of `Object.keys(dto)` that intersects `DOC_AFFECTING_FIELDS`. */
  changedFields: string[];
  lineItems?: LineItemsDiff;
  totalAmount?: { before: number; after: number; delta: number };
  vatRate?: { before: number; after: number };
  signDate?: { before: string | null; after: string | null };
  status?: { before: string; after: string };
};

/** Snapshot we keep of a contract right before mutate — only the bits we need
 *  to compute the diff. Loose type so callers can pass either a Mongoose
 *  document `.toObject()` or a `lean()` POJO. */
export type ContractSnapshot = {
  lineItems?: Array<Partial<LineItem>> | null;
  totalAmount?: number;
  vatRate?: number;
  signDate?: Date | string | null;
  status?: string;
};

/** PAUSE-67-CODER-02 cap (Manager APPROVE perf protection). */
export const DIFF_LINE_ITEM_CAP = 100;

function toIsoOrNull(v: Date | string | null | undefined): string | null {
  if (!v) return null;
  if (v instanceof Date) return v.toISOString();
  return String(v);
}

function takeSnapshot(li: Partial<LineItem>): LineItemSnapshot {
  return {
    stt: Number(li.stt ?? 0),
    description: String(li.description ?? ''),
    quantity: Number(li.quantity ?? 0),
    unitPrice: Number(li.unitPrice ?? 0),
    discount: Number(li.discount ?? 0),
    amount: Number(li.amount ?? 0),
    ...(li.cost != null ? { cost: Number(li.cost) } : {}),
  };
}

/** Field set we diff per-line. `note`/`selected`/`catalogItemId` are admin-
 *  internal toggles → excluded from audit diff to reduce noise. */
const LINE_ITEM_DIFF_KEYS: ReadonlyArray<
  Exclude<keyof LineItemSnapshot, 'stt'>
> = ['description', 'quantity', 'unitPrice', 'discount', 'amount', 'cost'];

/** Build a structured diff between two line item arrays, matching by `stt`.
 *
 *  BR-67-12 algorithm:
 *  - `before.stt` ∉ `after.stt[]` → push to `removed`
 *  - `after.stt`  ∉ `before.stt[]` → push to `added`
 *  - both sides have same `stt` + at least one of `LINE_ITEM_DIFF_KEYS`
 *    differs → push to `modified` with ONLY the changed keys.
 *
 *  PAUSE-67-CODER-02 — bucket capped at `DIFF_LINE_ITEM_CAP`. When exceeded,
 *  the bucket is sliced + `truncated`/`count` markers are attached.
 */
export function diffLineItems(
  beforeArr: ReadonlyArray<Partial<LineItem>> | null | undefined,
  afterArr: ReadonlyArray<Partial<LineItem>> | null | undefined,
): LineItemsDiff {
  const before = beforeArr ?? [];
  const after = afterArr ?? [];
  const beforeMap = new Map<number, Partial<LineItem>>();
  for (const li of before) {
    if (li && typeof li.stt === 'number') beforeMap.set(li.stt, li);
  }
  const afterMap = new Map<number, Partial<LineItem>>();
  for (const li of after) {
    if (li && typeof li.stt === 'number') afterMap.set(li.stt, li);
  }

  const added: LineItemSnapshot[] = [];
  const removed: LineItemSnapshot[] = [];
  const modified: LineItemModification[] = [];

  for (const [stt, afterLi] of afterMap) {
    const beforeLi = beforeMap.get(stt);
    if (!beforeLi) {
      added.push(takeSnapshot(afterLi));
      continue;
    }
    const beforeKV: Partial<LineItemSnapshot> = {};
    const afterKV: Partial<LineItemSnapshot> = {};
    let changed = false;
    for (const k of LINE_ITEM_DIFF_KEYS) {
      const bv = (beforeLi as any)[k];
      const av = (afterLi as any)[k];
      if (bv !== av) {
        (beforeKV as any)[k] = bv ?? null;
        (afterKV as any)[k] = av ?? null;
        changed = true;
      }
    }
    if (changed) modified.push({ stt, before: beforeKV, after: afterKV });
  }
  for (const [stt, beforeLi] of beforeMap) {
    if (!afterMap.has(stt)) removed.push(takeSnapshot(beforeLi));
  }

  const rawCounts = {
    added: added.length,
    removed: removed.length,
    modified: modified.length,
  };
  const overflow =
    rawCounts.added > DIFF_LINE_ITEM_CAP ||
    rawCounts.removed > DIFF_LINE_ITEM_CAP ||
    rawCounts.modified > DIFF_LINE_ITEM_CAP;

  if (overflow) {
    return {
      added: added.slice(0, DIFF_LINE_ITEM_CAP),
      removed: removed.slice(0, DIFF_LINE_ITEM_CAP),
      modified: modified.slice(0, DIFF_LINE_ITEM_CAP),
      truncated: true,
      count: rawCounts,
    };
  }
  return { added, removed, modified };
}

/** Compose the full `ContractUpdateDiff` payload. Caller passes the DTO
 *  (`Object.keys(dto)` decides `changedFields`) plus the before/after
 *  contract snapshots already mutated by `update()`. */
export function computeContractDiff(
  before: ContractSnapshot,
  after: ContractSnapshot,
  dto: Record<string, unknown>,
): ContractUpdateDiff {
  const changedFields = Object.keys(dto).filter((k) =>
    DOC_AFFECTING_FIELDS.has(k),
  );
  const diff: ContractUpdateDiff = { changedFields };

  if ('lineItems' in dto) {
    diff.lineItems = diffLineItems(
      before.lineItems ?? [],
      after.lineItems ?? [],
    );
  }
  if (
    typeof before.totalAmount === 'number' &&
    typeof after.totalAmount === 'number' &&
    before.totalAmount !== after.totalAmount
  ) {
    diff.totalAmount = {
      before: before.totalAmount,
      after: after.totalAmount,
      delta: after.totalAmount - before.totalAmount,
    };
  }
  if (
    typeof before.vatRate === 'number' &&
    typeof after.vatRate === 'number' &&
    before.vatRate !== after.vatRate
  ) {
    diff.vatRate = { before: before.vatRate, after: after.vatRate };
  }
  if ('signDate' in dto) {
    diff.signDate = {
      before: toIsoOrNull(before.signDate ?? null),
      after: toIsoOrNull(after.signDate ?? null),
    };
  }
  if (
    typeof before.status === 'string' &&
    typeof after.status === 'string' &&
    before.status !== after.status
  ) {
    diff.status = { before: before.status, after: after.status };
  }
  return diff;
}

/** True iff DTO mutates at least one allowlisted field. Pure key intersection
 *  — caller is responsible for additional guards (DRAFT skip, cancel-only,
 *  link-only) per BR-67-04. */
export function hasDocAffectingChange(dto: Record<string, unknown>): boolean {
  for (const k of Object.keys(dto)) {
    if (DOC_AFFECTING_FIELDS.has(k)) return true;
  }
  return false;
}
