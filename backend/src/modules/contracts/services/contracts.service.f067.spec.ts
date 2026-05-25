/**
 * F-067 — Contract DOCX Auto-Regenerate + Audit Log Line Items Edits.
 *
 * Test bench mirrors `contracts.update.spec.ts` (positional constructor — no
 * NestJS DI container) and only stubs the surfaces F-067 actually exercises:
 * the audit emit shape, the fire-and-forget regen trigger, the diff payload,
 * and the new GET /:id/history flow.
 *
 * 12+ mandated test cases per Manager Scope Lock:
 *   TC-67-01  Mutation hook emits audit + triggers regen on line items edit
 *   TC-67-02  Mutation response NOT awaited on regen (fire-and-forget)
 *   TC-67-03  Regen failure → audit `contract.docRegenFail`, mutation unaffected
 *   TC-67-04  Diff payload shape — changedFields + totalAmount + vatRate
 *   TC-67-05  Line items added / removed / modified detection by `stt`
 *   TC-67-06  DRAFT contract update → SKIP regen (BR-67-03)
 *   TC-67-07  Idempotency — non-doc-affecting DTO (linkOnly) → NO regen
 *   TC-67-08  PAUSE-67-CODER-02 — > 100 modified items → diff truncated
 *   TC-67-09  History endpoint returns sorted entries (DESC) with metadata
 *   TC-67-10  History endpoint clamps limit > 200 → cap 200 (defense-in-depth)
 *   TC-67-11  History endpoint 404 cho contract gone
 *   TC-67-12  Backward compat — audit entry missing metadata.diff renders ok
 */
import { NotFoundException } from '@nestjs/common';
import { ContractsService } from './contracts.service';
import { ContractNumberService } from './contract-number.service';
import {
  computeContractDiff,
  diffLineItems,
  hasDocAffectingChange,
  DOC_AFFECTING_FIELDS,
  DIFF_LINE_ITEM_CAP,
} from '../utils/contract-diff.util';

type MutableContract = {
  _id: string;
  status: string;
  documentType: string;
  contractType: string;
  vatRate: number;
  subtotal: number;
  totalAmount: number;
  vatAmount: number;
  lineItems: any[];
  paymentTerms: any;
  client: any;
  providerId: string;
  provider: any;
  signDate: Date;
  raceName?: string;
  raceDate?: string;
  raceLocation?: string;
  generatedDocuments: any[];
  acceptanceReport?: any;
  paymentRequest?: any;
  save: jest.Mock;
  toObject: () => any;
  createdAt?: Date;
};

describe('F-067 — Contract DOCX Auto-Regenerate + Audit Diff', () => {
  let svc: ContractsService;
  let mockModel: any;
  let mockPartnerModel: any;
  let mockRaceModel: any;
  let mockTemplateService: any;
  let mockDocGenerator: any;
  let mockAuditLogModel: any;
  let numberService: ContractNumberService;

  const buildContract = (
    overrides: Partial<MutableContract> = {},
  ): MutableContract => {
    const base: MutableContract = {
      _id: 'contract-067',
      status: 'ACTIVE',
      documentType: 'CONTRACT',
      contractType: 'TIMING',
      vatRate: 8,
      // Subtotal/totals match the fixture's 2 line items exactly so F-067
      // diff math is consistent: 1*100*5500 + 1850*5500 = 10,725,000
      // → vat 8% = 858,000 → total = 11,583,000 (before edit).
      subtotal: 10_725_000,
      vatAmount: 858_000,
      totalAmount: 11_583_000,
      lineItems: [
        { stt: 1, description: 'Áo S', unit: 'cái', quantity: 100, unitPrice: 5500, discount: 0, amount: 550_000, cost: 0 },
        { stt: 4, description: 'Áo XL', unit: 'cái', quantity: 1850, unitPrice: 5500, discount: 0, amount: 10_175_000, cost: 0 },
      ],
      paymentTerms: {
        advancePercentage: 50,
        advanceAmount: 5_791_500,
        remainderPercentage: 50,
        remainderAmount: 5_791_500,
        latePenaltyRate: 0.02,
        latePenaltyUnit: 'PER_DAY',
        paymentDeadlineDays: 15,
      },
      client: { entityName: 'VCB KID RUN 2026' },
      providerId: '5BIB',
      provider: { entityName: '5BIB', taxId: '0100000000' },
      signDate: new Date('2026-05-25T08:00:00Z'),
      generatedDocuments: [
        {
          docType: 'CONTRACT',
          generatedAt: new Date('2026-05-25T15:14:01Z'),
          s3Key: 'contracts/contract-067/CONTRACT_t1.docx',
          format: 'DOCX',
          version: 1,
        },
      ],
      save: jest.fn().mockResolvedValue(undefined),
      toObject: function () {
        const { save: _s, toObject: _t, ...rest } = this as any;
        return rest;
      },
      createdAt: new Date('2026-05-25T07:00:00Z'),
      ...overrides,
    };
    return base;
  };

  beforeEach(() => {
    mockModel = {
      findOne: jest.fn(),
      exists: jest.fn().mockResolvedValue({ _id: 'contract-067' }),
      create: jest.fn(),
      countDocuments: jest.fn(),
      updateOne: jest.fn(),
    };
    mockPartnerModel = { findOne: jest.fn() };
    mockRaceModel = { findById: jest.fn() };
    mockTemplateService = {
      getArticles: jest.fn().mockResolvedValue([]),
      getLineItems: jest.fn().mockResolvedValue([]),
    };
    mockDocGenerator = {
      renderAndUpload: jest.fn().mockResolvedValue({
        docxKey: 'contracts/contract-067/CONTRACT_v2.docx',
        pdfKey: undefined,
      }),
      getSignedDownloadUrl: jest.fn(),
      getFileBody: jest.fn(),
    };
    const redisStub: any = {
      incr: jest.fn().mockResolvedValue(1),
      ttl: jest.fn().mockResolvedValue(-1),
      expire: jest.fn().mockResolvedValue(1),
      get: jest.fn().mockResolvedValue(null),
      set: jest.fn().mockResolvedValue('OK'),
      del: jest.fn().mockResolvedValue(1),
    };
    mockAuditLogModel = {
      find: jest.fn().mockReturnValue({
        sort: () => ({ limit: () => ({ lean: () => Promise.resolve([]) }) }),
      }),
    };
    numberService = new ContractNumberService(redisStub);
    svc = new ContractsService(
      mockModel,
      mockPartnerModel,
      mockRaceModel,
      numberService,
      mockTemplateService,
      mockDocGenerator,
      undefined,
      undefined,
      undefined,
      mockAuditLogModel,
    );
  });

  // ──────────────────────────────────────────────────────────────
  // Group X — Auto-regenerate DOCX
  // ──────────────────────────────────────────────────────────────

  it('TC-67-01: line items edit → audit emit (diff) + fire-and-forget regen', async () => {
    const c = buildContract({ status: 'ACTIVE' });
    mockModel.findOne.mockResolvedValue(c);
    const auditEmit = jest.fn().mockResolvedValue(undefined);
    (svc as any).auditLog = { emit: auditEmit };

    await svc.update('contract-067', {
      lineItems: [
        { stt: 1, description: 'Áo S', unit: 'cái', quantity: 100, unitPrice: 5500, discount: 0 },
        { stt: 4, description: 'Áo XL', unit: 'cái', quantity: 1900, unitPrice: 5500, discount: 0 },
      ] as any,
    } as any);

    expect(c.save).toHaveBeenCalled();
    const forceEmit = auditEmit.mock.calls.find(
      (call) => call[0].action === 'contract.update.force',
    );
    expect(forceEmit).toBeDefined();
    expect(forceEmit[0].metadata.diff.changedFields).toContain('lineItems');
    expect(forceEmit[0].metadata.diff.lineItems.modified[0].stt).toBe(4);
    expect(forceEmit[0].metadata.diff.lineItems.modified[0].before.quantity).toBe(1850);
    expect(forceEmit[0].metadata.diff.lineItems.modified[0].after.quantity).toBe(1900);
    expect(forceEmit[0].metadata.diff.totalAmount.delta).toBe(297_000);

    // Fire-and-forget regen: allow microtasks to drain, then assert
    // renderAndUpload was actually invoked (proxy for: regen pipeline ran).
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    expect(mockDocGenerator.renderAndUpload).toHaveBeenCalled();
  });

  it('TC-67-02: mutation response NOT blocked by regen (fire-and-forget)', async () => {
    const c = buildContract({ status: 'ACTIVE' });
    mockModel.findOne.mockResolvedValue(c);
    // Simulate slow regen (would block if awaited)
    mockDocGenerator.renderAndUpload.mockImplementation(
      () =>
        new Promise((r) =>
          setTimeout(
            () =>
              r({
                docxKey: 'contracts/contract-067/CONTRACT_slow.docx',
              }),
            500,
          ),
        ),
    );
    const t0 = Date.now();
    await svc.update('contract-067', {
      lineItems: [
        { stt: 1, description: 'Áo S', unit: 'cái', quantity: 100, unitPrice: 5500, discount: 0 },
      ] as any,
    } as any);
    const elapsed = Date.now() - t0;
    // Mutation should return well below 500ms — the slow render runs after.
    expect(elapsed).toBeLessThan(200);
  });

  it('TC-67-03: regen failure → audit contract.docRegenFail, mutation unaffected', async () => {
    const c = buildContract({ status: 'ACTIVE' });
    mockModel.findOne.mockResolvedValue(c);
    mockDocGenerator.renderAndUpload.mockRejectedValueOnce(
      new Error('S3 putObject timeout'),
    );
    const auditEmit = jest.fn().mockResolvedValue(undefined);
    (svc as any).auditLog = { emit: auditEmit };

    const result = await svc.update('contract-067', {
      lineItems: [
        { stt: 1, description: 'Áo S', unit: 'cái', quantity: 200, unitPrice: 5500, discount: 0 },
      ] as any,
    } as any);

    expect(result).toBeDefined();
    // Allow fire-and-forget chain to complete + emit failure audit.
    await new Promise((r) => setImmediate(r));
    await new Promise((r) => setImmediate(r));
    const failEmit = auditEmit.mock.calls.find(
      (call) => call[0].action === 'contract.docRegenFail',
    );
    expect(failEmit).toBeDefined();
    expect(failEmit[0].metadata.trigger).toBe('auto');
    expect(failEmit[0].metadata.error).toContain('S3 putObject timeout');
  });

  // ──────────────────────────────────────────────────────────────
  // Group Z — Diff payload
  // ──────────────────────────────────────────────────────────────

  it('TC-67-04: diff shape includes changedFields + totalAmount + vatRate', () => {
    const before = {
      lineItems: [
        { stt: 1, description: 'Áo', quantity: 10, unitPrice: 100, discount: 0, amount: 1000, cost: 0 },
      ],
      totalAmount: 1080,
      vatRate: 8,
      signDate: new Date('2026-05-01'),
      status: 'ACTIVE',
    };
    const after = {
      lineItems: [
        { stt: 1, description: 'Áo', quantity: 12, unitPrice: 100, discount: 0, amount: 1200, cost: 0 },
      ],
      totalAmount: 1320,
      vatRate: 10,
      signDate: new Date('2026-05-01'),
      status: 'ACTIVE',
    };
    const diff = computeContractDiff(before as any, after as any, {
      lineItems: after.lineItems,
      vatRate: 10,
    });
    expect(diff.changedFields.sort()).toEqual(['lineItems', 'vatRate']);
    expect(diff.vatRate).toEqual({ before: 8, after: 10 });
    expect(diff.totalAmount).toEqual({ before: 1080, after: 1320, delta: 240 });
    expect(diff.lineItems!.modified[0].before.quantity).toBe(10);
    expect(diff.lineItems!.modified[0].after.quantity).toBe(12);
  });

  it('TC-67-05: line items diff — added/removed/modified detection by stt', () => {
    const before = [
      { stt: 1, description: 'A', quantity: 1, unitPrice: 100, discount: 0, amount: 100, cost: 0 },
      { stt: 2, description: 'B', quantity: 1, unitPrice: 200, discount: 0, amount: 200, cost: 0 },
      { stt: 3, description: 'C', quantity: 1, unitPrice: 300, discount: 0, amount: 300, cost: 0 },
      { stt: 5, description: 'E', quantity: 1, unitPrice: 500, discount: 0, amount: 500, cost: 0 },
    ];
    const after = [
      { stt: 1, description: 'A', quantity: 1, unitPrice: 100, discount: 0, amount: 100, cost: 0 },
      // stt:2 modified (quantity 1 → 5)
      { stt: 2, description: 'B', quantity: 5, unitPrice: 200, discount: 0, amount: 1000, cost: 0 },
      { stt: 4, description: 'D', quantity: 1, unitPrice: 400, discount: 0, amount: 400, cost: 0 },
      { stt: 6, description: 'F', quantity: 1, unitPrice: 600, discount: 0, amount: 600, cost: 0 },
      // stt 3, 5 removed
    ];
    const d = diffLineItems(before as any, after as any);
    expect(d.added.map((x) => x.stt).sort()).toEqual([4, 6]);
    expect(d.removed.map((x) => x.stt).sort()).toEqual([3, 5]);
    expect(d.modified).toHaveLength(1);
    expect(d.modified[0].stt).toBe(2);
    expect(d.modified[0].before.quantity).toBe(1);
    expect(d.modified[0].after.quantity).toBe(5);
  });

  // ──────────────────────────────────────────────────────────────
  // BR-67-03/04 — Skip conditions
  // ──────────────────────────────────────────────────────────────

  it('TC-67-06: DRAFT contract update → skip regen (BR-67-03)', async () => {
    const c = buildContract({ status: 'DRAFT' });
    mockModel.findOne.mockResolvedValue(c);
    await svc.update('contract-067', {
      lineItems: [
        { stt: 1, description: 'Áo S', unit: 'cái', quantity: 100, unitPrice: 5500, discount: 0 },
      ] as any,
    } as any);
    await new Promise((r) => setImmediate(r));
    expect(mockDocGenerator.renderAndUpload).not.toHaveBeenCalled();
  });

  it('TC-67-07: idempotency — link-only DTO (no doc-affecting field) → no regen', async () => {
    const c = buildContract({ status: 'ACTIVE', contractType: 'TICKET_SALES' });
    mockModel.findOne.mockResolvedValue(c);
    expect(hasDocAffectingChange({ linkedTenantId: 12 })).toBe(false);
    await svc.update('contract-067', {
      linkedTenantId: 12,
      linkedMysqlRaceId: 148,
    } as any);
    await new Promise((r) => setImmediate(r));
    expect(mockDocGenerator.renderAndUpload).not.toHaveBeenCalled();
  });

  // ──────────────────────────────────────────────────────────────
  // PAUSE-67-CODER-02 — Diff size cap
  // ──────────────────────────────────────────────────────────────

  it('TC-67-08: > 100 modified line items → diff truncated with count marker', () => {
    const before: any[] = [];
    const after: any[] = [];
    for (let i = 1; i <= 150; i++) {
      before.push({
        stt: i,
        description: `X${i}`,
        quantity: 1,
        unitPrice: 100,
        discount: 0,
        amount: 100,
        cost: 0,
      });
      after.push({
        stt: i,
        description: `X${i}`,
        quantity: 2,
        unitPrice: 100,
        discount: 0,
        amount: 200,
        cost: 0,
      });
    }
    const d = diffLineItems(before, after);
    expect(d.modified.length).toBe(DIFF_LINE_ITEM_CAP);
    expect(d.truncated).toBe(true);
    expect(d.count).toEqual({ added: 0, removed: 0, modified: 150 });
  });

  // ──────────────────────────────────────────────────────────────
  // Group Z — History endpoint
  // ──────────────────────────────────────────────────────────────

  it('TC-67-09: getHistory returns sorted entries with metadata', async () => {
    const fakeRows = [
      {
        _id: 'al-3',
        action: 'contract.update.force',
        actor: { userId: 'admin' },
        createdAt: new Date('2026-05-25T15:33:07Z'),
        metadata: {
          editedFields: ['lineItems'],
          diff: { changedFields: ['lineItems'] },
        },
      },
      {
        _id: 'al-2',
        action: 'contract.generateDocument',
        actor: { userId: 'system:auto-regen' },
        createdAt: new Date('2026-05-25T15:33:05Z'),
        metadata: { docType: 'CONTRACT' },
      },
      {
        _id: 'al-1',
        action: 'contract.create',
        actor: { userId: 'admin' },
        createdAt: new Date('2026-05-25T07:00:00Z'),
        metadata: undefined,
      },
    ];
    mockAuditLogModel.find = jest.fn().mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve(fakeRows) }) }),
    });

    const res = await svc.getHistory('contract-067', 50);
    expect(res.total).toBe(3);
    expect(res.entries).toHaveLength(3);
    expect(res.entries[0].id).toBe('al-3');
    expect(res.entries[0].action).toBe('contract.update.force');
    expect((res.entries[0].metadata as any).diff.changedFields).toContain('lineItems');
  });

  it('TC-67-10: getHistory clamps limit > 200 → max 200 (defense-in-depth)', async () => {
    let receivedLimit = -1;
    mockAuditLogModel.find = jest.fn().mockReturnValue({
      sort: () => ({
        limit: (n: number) => {
          receivedLimit = n;
          return { lean: () => Promise.resolve([]) };
        },
      }),
    });
    await svc.getHistory('contract-067', 9999);
    expect(receivedLimit).toBe(200);
  });

  it('TC-67-11: getHistory 404 cho contract gone', async () => {
    mockModel.exists.mockResolvedValueOnce(null);
    await expect(svc.getHistory('does-not-exist', 50)).rejects.toBeInstanceOf(
      NotFoundException,
    );
  });

  it('TC-67-12: backward compat — entry missing metadata still renders', async () => {
    const rows = [
      {
        _id: 'al-legacy',
        action: 'contract.update',
        actor: { userId: 'admin' },
        createdAt: '2026-04-01T00:00:00.000Z', // string instead of Date
        // no metadata field
      },
    ];
    mockAuditLogModel.find = jest.fn().mockReturnValue({
      sort: () => ({ limit: () => ({ lean: () => Promise.resolve(rows) }) }),
    });
    const res = await svc.getHistory('contract-067', 10);
    expect(res.entries[0].metadata).toBeUndefined();
    expect(res.entries[0].createdAt).toBe('2026-04-01T00:00:00.000Z');
  });

  // ──────────────────────────────────────────────────────────────
  // DOC_AFFECTING_FIELDS allowlist sanity
  // ──────────────────────────────────────────────────────────────

  it('allowlist sanity: lineItems + vatRate + signDate ∈ DOC_AFFECTING_FIELDS', () => {
    expect(DOC_AFFECTING_FIELDS.has('lineItems')).toBe(true);
    expect(DOC_AFFECTING_FIELDS.has('vatRate')).toBe(true);
    expect(DOC_AFFECTING_FIELDS.has('signDate')).toBe(true);
    expect(DOC_AFFECTING_FIELDS.has('linkedTenantId')).toBe(false);
    expect(DOC_AFFECTING_FIELDS.has('linkedMysqlRaceId')).toBe(false);
  });
});
