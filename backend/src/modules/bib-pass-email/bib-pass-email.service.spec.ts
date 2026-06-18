import { BadRequestException, NotFoundException } from '@nestjs/common';
import { env } from '../../config';
import {
  CertificateRenderService,
  FONT_OPTIONS,
} from '../certificates/services/certificate-render.service';
import { BibPassConfigService } from './bib-pass-config.service';
import { BibPassSenderService } from './bib-pass-sender.service';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);
const dupErr = () => Object.assign(new Error('dup'), { code: 11000 });

const chainExec = (val: unknown) => ({
  select: () => chainExec(val),
  lean: () => chainExec(val),
  sort: () => chainExec(val),
  exec: jest.fn().mockResolvedValue(val),
});

// ────────────────────────────────────────────────────────────────
// BR-01 — confirmed detection (scanner SQL predicate)
// ────────────────────────────────────────────────────────────────
describe('FEATURE-091 — BibPassScannerService (BR-01 detection)', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { BibPassScannerService } = require('./bib-pass-scanner.service');

  it('findConfirmed: SQL gồm đủ 3 điều kiện xác nhận + parameterized raceId', async () => {
    const query = jest.fn().mockResolvedValue([
      { athletes_id: '1', race_id: '192', name: 'A', bib_number: '5', email: 'a@b.c' },
    ]);
    const svc = new BibPassScannerService({ query });
    const rows = await svc.findConfirmed(192);
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('a.bib_number IS NOT NULL');
    expect(sql).toContain("a.bib_number <> ''");
    expect(sql).toContain('a.rolling_bib_last_time IS NOT NULL');
    expect(sql).toContain('a.bib_image IS NOT NULL');
    expect(sql).toContain("a.bib_image <> ''");
    expect(sql).toContain('a.race_id = ?');
    expect(params[0]).toBe(192);
    // bigint string → number
    expect(rows[0].athletes_id).toBe(1);
    expect(rows[0].race_id).toBe(192);
  });

  it('listConfirmedPaged: q LIKE parameterized (KHÔNG interpolate)', async () => {
    const query = jest
      .fn()
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ n: 0 }]);
    const svc = new BibPassScannerService({ query });
    await svc.listConfirmedPaged(5, { q: 'Nguy', page: 1, pageSize: 20 });
    const [sql, params] = query.mock.calls[0];
    expect(sql).toContain('a.name LIKE ?');
    expect(params).toContain('%Nguy%');
  });
});

// ────────────────────────────────────────────────────────────────
// Config service: upsert validation (BR-09) + render variables (BR-06)
// ────────────────────────────────────────────────────────────────
describe('FEATURE-091 — BibPassConfigService', () => {
  function makeDoc(init: Record<string, unknown>) {
    const doc: Record<string, unknown> = {
      _id: 'cfg1',
      raceId: init.raceId,
      raceName: '',
      enabled: false,
      template: null,
      staticFields: { location: '', raceDay: '', distance: '', passportPrefix: '' },
      email: { subject: '', bodyHtml: '', fromName: '5BIB' },
      attachmentFilename: 'border-pass-{bib}.png',
      createdAt: new Date('2026-06-18'),
      updatedAt: new Date('2026-06-18'),
      createdBy: init.createdBy,
      save: jest.fn().mockResolvedValue(undefined),
      toObject() {
        return this;
      },
    };
    return doc;
  }

  function build(existing: Record<string, unknown> | null) {
    const ctor: any = jest.fn().mockImplementation((init: Record<string, unknown>) => makeDoc(init));
    ctor.findOne = jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(existing) });
    ctor.find = jest.fn().mockReturnValue(chainExec([]));
    const sendModel: any = {
      countDocuments: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue(0) }),
    };
    const render = { render: jest.fn().mockResolvedValue(Buffer.from('PNG')) };
    const scanner = { countConfirmed: jest.fn().mockResolvedValue(0) };
    const svc = new BibPassConfigService(ctor, sendModel, render as any, scanner as any);
    return { svc, ctor, render };
  }

  it('BR-09: bật enabled nhưng CHƯA có phôi → 400', async () => {
    const { svc } = build(null);
    await expect(
      svc.upsertConfig(192, { enabled: true }, 'u1'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('BR-09: bật enabled có phôi nhưng THIẾU subject → 400', async () => {
    const { svc } = build(null);
    await expect(
      svc.upsertConfig(
        192,
        {
          enabled: true,
          template: { canvas: { width: 100, height: 100 }, layers: [] } as any,
          email: { subject: '   ' },
        },
        'u1',
      ),
    ).rejects.toBeInstanceOf(BadRequestException);
  });

  it('happy upsert (enabled, phôi, subject) → response KHÔNG leak createdBy/_id', async () => {
    const { svc } = build(null);
    const res = await svc.upsertConfig(
      192,
      {
        enabled: true,
        raceName: 'VMM 2026',
        template: { canvas: { width: 100, height: 100 }, layers: [] } as any,
        email: { subject: 'Pass {event_name}' },
        staticFields: { passportPrefix: 'VM-' },
      },
      'u1',
    );
    expect(res.raceId).toBe(192);
    expect(res.enabled).toBe(true);
    expect(res).not.toHaveProperty('_id');
    expect(res).not.toHaveProperty('createdBy');
    expect(res.staticFields.passportPrefix).toBe('VM-');
  });

  it('getConfig: raceId không có config → NotFound', async () => {
    const { svc } = build(null);
    await expect(svc.getConfig(999)).rejects.toBeInstanceOf(NotFoundException);
  });

  it('BR-06: buildRenderData — {name}/{bib} auto + passport_no = prefix+bib', () => {
    const { svc } = build(null);
    const data = svc.buildRenderData(
      { athletes_id: 1, race_id: 192, name: 'Nguyễn Văn A', bib_number: '777', email: null },
      { raceName: 'VMM 2026', staticFields: { location: 'Sa Pa', raceDay: '21/06', distance: '42K', passportPrefix: 'VM-' } } as any,
    );
    expect(data.variables?.name).toBe('Nguyễn Văn A');
    expect(data.variables?.bib).toBe('777');
    expect(data.variables?.event_name).toBe('VMM 2026');
    expect(data.variables?.passport_no).toBe('VM-777');
    expect(data.variables?.location).toBe('Sa Pa');
    expect(data.runner_name).toBe('Nguyễn Văn A');
  });
});

// ────────────────────────────────────────────────────────────────
// Sender service: kill-switch (BR-10), idempotency (BR-04),
// no-email (BR-13), throttle (BR-11)
// ────────────────────────────────────────────────────────────────
describe('FEATURE-091 — BibPassSenderService', () => {
  const origSendEnabled = env.bibPass.sendEnabled;
  const origLimit = env.bibPass.batchLimit;
  afterEach(() => {
    env.bibPass.sendEnabled = origSendEnabled;
    env.bibPass.batchLimit = origLimit;
  });

  function build(opts: {
    confirmed: any[];
    ledger?: any[];
    config?: Record<string, unknown>;
    createImpl?: () => Promise<unknown>;
  }) {
    const config = opts.config ?? {
      enabled: true,
      template: { canvas: { width: 10, height: 10 }, layers: [] },
      email: { subject: 'S {name}', bodyHtml: 'Hi {name} #{bib}', fromName: '5BIB' },
      attachmentFilename: 'pass-{bib}.png',
      staticFields: { passportPrefix: 'VM-' },
      raceName: 'VMM',
    };
    const sendModel: any = {
      find: jest.fn().mockReturnValue(chainExec(opts.ledger ?? [])),
      create: jest.fn(
        (opts.createImpl ?? (async (d: any) => ({ _id: 'led-' + d.athletesId }))) as any,
      ),
      updateOne: jest.fn().mockReturnValue({ exec: jest.fn().mockResolvedValue({}) }),
    };
    const configService: any = {
      getConfigDoc: jest.fn().mockResolvedValue(config),
      renderForRow: jest.fn().mockResolvedValue(Buffer.from('PNGDATA')),
      buildRenderData: (row: any, cfg: any) => ({
        runner_name: row.name,
        variables: {
          name: row.name ?? '',
          bib: row.bib_number ?? '',
          event_name: cfg.raceName ?? '',
          passport_no: `${cfg.staticFields?.passportPrefix ?? ''}${row.bib_number ?? ''}`,
        },
      }),
    };
    const scanner: any = {
      findConfirmed: jest.fn().mockResolvedValue(opts.confirmed),
      findConfirmedOne: jest.fn(),
    };
    const mail: any = { sendBibPass: jest.fn().mockResolvedValue(true) };
    const svc = new BibPassSenderService(sendModel, configService, scanner, mail);
    return { svc, sendModel, configService, scanner, mail };
  }

  const ath = (id: number, email: string | null = `a${id}@x.com`) => ({
    athletes_id: id,
    race_id: 192,
    name: `Name ${id}`,
    bib_number: `${id}`,
    email,
  });

  it('BR-10 kill-switch OFF → dryRun, KHÔNG gửi, KHÔNG ghi ledger', async () => {
    env.bibPass.sendEnabled = false;
    const { svc, mail, sendModel } = build({ confirmed: [ath(1), ath(2)] });
    const res = await svc.sendBatch(192);
    expect(res.dryRun).toBe(true);
    expect(res.attempted).toBe(2);
    expect(res.sent).toBe(0);
    expect(mail.sendBibPass).not.toHaveBeenCalled();
    expect(sendModel.create).not.toHaveBeenCalled();
  });

  it('BR-04 idempotency: ledger đã có athletesId → anti-join bỏ qua', async () => {
    env.bibPass.sendEnabled = true;
    const { svc, mail } = build({
      confirmed: [ath(1), ath(2)],
      ledger: [{ athletesId: 1 }],
    });
    const res = await svc.sendBatch(192);
    expect(res.attempted).toBe(1); // chỉ ath(2)
    expect(res.sent).toBe(1);
    expect(mail.sendBibPass).toHaveBeenCalledTimes(1);
  });

  it('BR-04 idempotency: claim E11000 → skipped (KHÔNG gửi)', async () => {
    env.bibPass.sendEnabled = true;
    const { svc, mail } = build({
      confirmed: [ath(1)],
      createImpl: async () => {
        throw dupErr();
      },
    });
    const res = await svc.sendBatch(192);
    expect(res.skipped).toBe(1);
    expect(res.sent).toBe(0);
    expect(mail.sendBibPass).not.toHaveBeenCalled();
  });

  it('BR-13 no-email: email null → failed "no_email", KHÔNG gửi', async () => {
    env.bibPass.sendEnabled = true;
    const { svc, mail, sendModel } = build({ confirmed: [ath(1, null)] });
    const res = await svc.sendBatch(192);
    expect(res.failed).toBe(1);
    expect(mail.sendBibPass).not.toHaveBeenCalled();
    expect(sendModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'failed', failReason: 'no_email' }),
    );
  });

  it('BR-11 throttle: pending > limit → cắt theo limit + hasMore', async () => {
    env.bibPass.sendEnabled = true;
    env.bibPass.batchLimit = 2;
    const { svc, mail } = build({ confirmed: [ath(1), ath(2), ath(3)] });
    const res = await svc.sendBatch(192);
    expect(res.attempted).toBe(2);
    expect(res.hasMore).toBe(true);
    expect(mail.sendBibPass).toHaveBeenCalledTimes(2);
  });

  it('happy: gửi thành công → sent, attachment filename interpolate {bib}', async () => {
    env.bibPass.sendEnabled = true;
    const { svc, mail } = build({ confirmed: [ath(9)] });
    const res = await svc.sendBatch(192);
    expect(res.sent).toBe(1);
    const arg = mail.sendBibPass.mock.calls[0][0];
    expect(arg.toEmail).toBe('a9@x.com');
    expect(arg.filename).toBe('pass-9.png');
    expect(arg.subject).toContain('Name 9');
    expect(arg.png).toBeInstanceOf(Buffer);
  });

  it('mail trả false → failed "mail_error"', async () => {
    env.bibPass.sendEnabled = true;
    const { svc, sendModel, mail } = build({ confirmed: [ath(1)] });
    mail.sendBibPass.mockResolvedValue(false);
    const res = await svc.sendBatch(192);
    expect(res.failed).toBe(1);
    expect(sendModel.updateOne).toHaveBeenCalledWith(
      expect.anything(),
      expect.objectContaining({ status: 'failed', failReason: 'mail_error' }),
    );
  });

  it('test-send athletesId chưa xác nhận → 400', async () => {
    const { svc, scanner } = build({ confirmed: [] });
    scanner.findConfirmedOne.mockResolvedValue(null);
    await expect(
      svc.testSend(192, { toEmail: 'me@x.com', athletesId: 5 }),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

// ────────────────────────────────────────────────────────────────
// Font VN render smoke — mỗi FONT_OPTIONS render được tiếng Việt
// ────────────────────────────────────────────────────────────────
describe('FEATURE-091 — font VN render smoke', () => {
  const svc = new CertificateRenderService();
  const SAMPLE = 'Nguyễn Thị Hậu — ƯỢ Ầ Ễ Ọ';

  it('có đủ phông đa dạng (≥8) gồm serif/display/script', () => {
    expect(FONT_OPTIONS.length).toBeGreaterThanOrEqual(8);
    const cats = new Set(FONT_OPTIONS.map((f) => f.category));
    expect(cats.has('serif')).toBe(true);
    expect(cats.has('display')).toBe(true);
    expect(cats.has('script')).toBe(true);
  });

  it.each(FONT_OPTIONS.map((f) => f.family))(
    'render tiếng Việt với phông "%s" → PNG hợp lệ',
    async (family) => {
      const buf = await svc.render(
        {
          canvas: { width: 480, height: 120, backgroundColor: '#ffffff' },
          layers: [
            {
              type: 'text' as const,
              x: 10,
              y: 20,
              text: SAMPLE,
              fontSize: 28,
              fontFamily: family,
              fontWeight: '700',
            },
          ],
        },
        { variables: {} },
      );
      expect(buf.subarray(0, 8)).toEqual(PNG_SIG);
      expect(buf.length).toBeGreaterThan(200);
    },
  );
});

// ────────────────────────────────────────────────────────────────
// MailService.sendBibPass — attachment type image/png base64
// ────────────────────────────────────────────────────────────────
describe('FEATURE-091 — MailService.sendBibPass', () => {
  // eslint-disable-next-line @typescript-eslint/no-var-requires
  const { MailService } = require('../notification/mail.service');

  it('client null → false (dev, KHÔNG throw)', async () => {
    const svc = new MailService();
    (svc as any).client = undefined;
    const ok = await svc.sendBibPass({
      toEmail: 'a@b.c',
      subject: 'S',
      html: '<p>x</p>',
      png: Buffer.from('PNG'),
      filename: 'p.png',
    });
    expect(ok).toBe(false);
  });

  it('client có → gửi attachment image/png base64', async () => {
    const send = jest.fn().mockResolvedValue([{ status: 'sent' }]);
    const svc = new MailService();
    (svc as any).client = { messages: { send } };
    const png = Buffer.from('HELLO-PNG');
    const ok = await svc.sendBibPass({
      toEmail: 'a@b.c',
      subject: 'Subject',
      html: '<p>x</p>',
      png,
      filename: 'pass-1.png',
      fromName: 'BTC',
    });
    expect(ok).toBe(true);
    const msg = send.mock.calls[0][0].message;
    expect(msg.from_name).toBe('BTC');
    expect(msg.attachments[0].type).toBe('image/png');
    expect(msg.attachments[0].name).toBe('pass-1.png');
    expect(msg.attachments[0].content).toBe(png.toString('base64'));
  });
});
