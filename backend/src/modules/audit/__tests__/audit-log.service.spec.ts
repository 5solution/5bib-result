import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { AuditLogService } from '../services/audit-log.service';
import { AuditLog } from '../schemas/audit-log.schema';

describe('AuditLogService', () => {
  let service: AuditLogService;
  let mockModel: { create: jest.Mock };

  beforeEach(async () => {
    mockModel = {
      create: jest.fn().mockResolvedValue({ _id: 'a1' }),
    };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        AuditLogService,
        { provide: getModelToken(AuditLog.name), useValue: mockModel },
      ],
    }).compile();
    service = moduleRef.get(AuditLogService);
  });

  it('emit() lưu document đúng schema', async () => {
    await service.emit({
      actor: { userId: 'u1', displayName: 'Danny', role: 'admin' },
      action: 'race.publish',
      entity: { type: 'race', id: 'r1', displayName: 'VMM 2026' },
      metadata: { from: 'pre_race', to: 'live' },
    });
    expect(mockModel.create).toHaveBeenCalledWith({
      actor: { userId: 'u1', displayName: 'Danny', role: 'admin' },
      action: 'race.publish',
      entity: { type: 'race', id: 'r1', displayName: 'VMM 2026' },
      metadata: { from: 'pre_race', to: 'live' },
    });
  });

  it('emit() KHÔNG throw khi DB fail (Mongo down)', async () => {
    mockModel.create.mockRejectedValueOnce(new Error('mongo down'));
    await expect(
      service.emit({
        actor: { userId: 'u1' },
        action: 'race.publish',
        entity: { type: 'race', id: 'r1' },
      }),
    ).resolves.toBeUndefined();
  });

  it('emit() chấp nhận metadata không có (optional)', async () => {
    await service.emit({
      actor: { userId: 'u1' },
      action: 'claim.approve',
      entity: { type: 'claim', id: 'c1' },
    });
    expect(mockModel.create).toHaveBeenCalled();
    const arg = mockModel.create.mock.calls[0][0];
    expect(arg.metadata).toBeUndefined();
  });

  it('emit() KHÔNG throw khi schema validation fail', async () => {
    mockModel.create.mockRejectedValueOnce(new Error('ValidationError: actor required'));
    await expect(
      service.emit({
        actor: { userId: '' },
        action: '',
        entity: { type: '', id: '' },
      }),
    ).resolves.toBeUndefined();
  });
});
