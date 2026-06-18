import 'reflect-metadata';
import { CrewCertificatesController } from './crew-certificates.controller';
import { CrewCertificatesService } from './crew-certificates.service';
import { CertificateRenderService } from '../certificates/services/certificate-render.service';
import { LogtoAdminGuard } from '../logto-auth';

const PNG_SIG = Buffer.from([0x89, 0x50, 0x4e, 0x47, 0x0d, 0x0a, 0x1a, 0x0a]);

describe('FEATURE-090 QC — guard wiring (auth boundary)', () => {
  const guardsOf = (fn: unknown): unknown[] =>
    Reflect.getMetadata('__guards__', fn as object) ?? [];

  it('public search + render KHÔNG có LogtoAdminGuard', () => {
    expect(guardsOf(CrewCertificatesController.prototype.search)).not.toContain(LogtoAdminGuard);
    expect(guardsOf(CrewCertificatesController.prototype.renderPublic)).not.toContain(LogtoAdminGuard);
  });

  it('mọi admin endpoint CÓ LogtoAdminGuard', () => {
    for (const m of [
      CrewCertificatesController.prototype.create,
      CrewCertificatesController.prototype.list,
      CrewCertificatesController.prototype.getOne,
      CrewCertificatesController.prototype.update,
      CrewCertificatesController.prototype.remove,
      CrewCertificatesController.prototype.rosterPreview,
      CrewCertificatesController.prototype.rosterConfirm,
      CrewCertificatesController.prototype.recipients,
      CrewCertificatesController.prototype.preview,
    ]) {
      expect(guardsOf(m)).toContain(LogtoAdminGuard);
    }
  });
});

describe('FEATURE-090 QC — engine token escape (regex injection safe)', () => {
  const svc = new CertificateRenderService();

  it('variable key chứa ký tự regex (a.b) resolve đúng, KHÔNG crash', async () => {
    const buf = await svc.render(
      {
        canvas: { width: 200, height: 100, backgroundColor: '#fff' },
        layers: [{ type: 'text' as const, x: 5, y: 10, text: '{a.b}', fontSize: 16 }],
      },
      { variables: { 'a.b': 'OK' } },
    );
    expect(buf.subarray(0, 8)).toEqual(PNG_SIG);
  });

  it('value chứa { } KHÔNG gây recursive interpolation lỗi', async () => {
    const buf = await svc.render(
      {
        canvas: { width: 200, height: 100, backgroundColor: '#fff' },
        layers: [{ type: 'text' as const, x: 5, y: 10, text: '{position}', fontSize: 16 }],
      },
      { variables: { position: '{full_name}' } },
    );
    expect(buf.subarray(0, 8)).toEqual(PNG_SIG);
  });
});

describe('FEATURE-090 QC — search regex-injection safe', () => {
  let batchModel: any;
  let recipientModel: any;
  let service: CrewCertificatesService;

  beforeEach(() => {
    batchModel = {
      findOne: jest.fn().mockReturnValue({
        select: () => ({ exec: jest.fn().mockResolvedValue({ _id: 'b1' }) }),
      }),
    };
    recipientModel = {
      find: jest.fn().mockReturnValue({ limit: () => ({ exec: jest.fn().mockResolvedValue([]) }) }),
    };
    service = new CrewCertificatesService(batchModel, recipientModel, {} as any, undefined);
  });

  it('name chứa ký tự regex → không throw, query escaped', async () => {
    await expect(service.searchPublic('crew-x', 'a.*b(c)')).resolves.toEqual([]);
    expect(recipientModel.find).toHaveBeenCalled();
    const arg = recipientModel.find.mock.calls[0][0];
    // normalizedName là RegExp đã escape — không phải '.*' match-all
    expect(arg.normalizedName).toBeInstanceOf(RegExp);
    expect(arg.normalizedName.source).not.toBe('.*');
  });
});
