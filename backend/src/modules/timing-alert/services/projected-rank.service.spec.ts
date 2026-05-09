import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { ProjectedRankService } from './projected-rank.service';
import { RaceResult } from '../../race-result/schemas/race-result.schema';

describe('ProjectedRankService', () => {
  let service: ProjectedRankService;
  let mockModel: any;

  beforeEach(async () => {
    mockModel = {
      find: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockReturnThis(),
      exec: jest.fn(),
    };

    const mod: TestingModule = await Test.createTestingModule({
      providers: [
        ProjectedRankService,
        { provide: getModelToken(RaceResult.name), useValue: mockModel },
      ],
    }).compile();
    service = mod.get(ProjectedRankService);
  });

  it('returns rank=1 + confidence=0 when no finishers (race chưa có ai về)', async () => {
    mockModel.exec.mockResolvedValue([]);
    const result = await service.calculate('race1', 'c42', 'Nam 40-49', 16200); // 4.5h
    expect(result.overallRank).toBe(1);
    expect(result.ageGroupRank).toBe(1);
    expect(result.confidence).toBe(0);
    expect(result.totalFinishers).toBe(0);
  });

  it('overall rank counts finishers faster than projected', async () => {
    // Projected 4.5h. Finishers: 4h, 4.2h, 5h. Overall rank should be 3 (2 faster).
    mockModel.exec.mockResolvedValue([
      { chipTime: '04:00:00', category: 'Nam 40-49' },
      { chipTime: '04:12:00', category: 'Nam 40-49' },
      { chipTime: '05:00:00', category: 'Nam 30-39' },
    ]);
    const result = await service.calculate('race1', 'c42', 'Nam 40-49', 16200);
    expect(result.overallRank).toBe(3); // 2 faster + 1
    expect(result.ageGroupRank).toBe(3); // both faster ARE Nam 40-49 → rank 3
    expect(result.totalFinishers).toBe(3);
  });

  it('TA-7 Top Athlete: projected rank 2 in age group → service returns rank=2', async () => {
    // Synthetic Top AG case for BIB 98898
    mockModel.exec.mockResolvedValue([
      { chipTime: '03:30:00', category: 'Nam 40-49' }, // faster than projected 4.5h
      { chipTime: '05:00:00', category: 'Nam 40-49' }, // slower
      { chipTime: '04:00:00', category: 'Nam 30-39' }, // different AG
    ]);
    const result = await service.calculate('race1', 'c42', 'Nam 40-49', 16200);
    // Overall: 2 faster (3:30 + 4:00) → rank 3
    expect(result.overallRank).toBe(3);
    // Age group: 1 faster (3:30 only — 4:00 is different AG) → rank 2
    expect(result.ageGroupRank).toBe(2);
  });

  it('confidence scales linearly to threshold 50', async () => {
    const finishers = Array(25).fill({ chipTime: '04:00:00', category: 'X' });
    mockModel.exec.mockResolvedValue(finishers);
    const result = await service.calculate('race1', 'c42', 'X', 18000);
    expect(result.confidence).toBe(0.5); // 25/50
  });

  it('confidence caps at 1.0 when finishers ≥ 50', async () => {
    const finishers = Array(100).fill({ chipTime: '04:00:00', category: 'X' });
    mockModel.exec.mockResolvedValue(finishers);
    const result = await service.calculate('race1', 'c42', 'X', 18000);
    expect(result.confidence).toBe(1);
  });

  it('returns null ageGroupRank when athlete has no age group', async () => {
    mockModel.exec.mockResolvedValue([
      { chipTime: '04:00:00', category: 'X' },
    ]);
    const result = await service.calculate('race1', 'c42', null, 18000);
    expect(result.ageGroupRank).toBeNull();
    expect(result.overallRank).not.toBeNull();
  });

  it('returns all-null when projectedFinishSeconds invalid', async () => {
    const result = await service.calculate('race1', 'c42', 'Nam', 0);
    expect(result.overallRank).toBeNull();
    expect(result.ageGroupRank).toBeNull();
    expect(result.confidence).toBe(0);
  });

  it('skips finishers with invalid chipTime parsing', async () => {
    mockModel.exec.mockResolvedValue([
      { chipTime: '04:00:00', category: 'X' },
      { chipTime: 'invalid', category: 'X' }, // skipped
      { chipTime: '', category: 'X' }, // skipped
    ]);
    const result = await service.calculate('race1', 'c42', 'X', 18000);
    expect(result.totalFinishers).toBe(3); // count includes invalid
    expect(result.overallRank).toBe(2); // 1 valid faster
  });

  // ─── F-010 BR-FC-15/16/17 — Confidence formula percentage-based ───

  it('F-010 confidence percentage-based: 50 finished / 500 registered with multiplier 0.20 → 0.5', async () => {
    const finishers = Array(50).fill({ chipTime: '04:00:00', category: 'X' });
    mockModel.exec.mockResolvedValue(finishers);
    const result = await service.calculate('race1', 'c42', 'X', 18000, 500, 0.2);
    // threshold = 500 × 0.20 = 100. confidence = 50 / 100 = 0.5
    expect(result.confidence).toBe(0.5);
  });

  it('F-010 confidence with multiplier 0.10 → easier to reach 1.0', async () => {
    const finishers = Array(50).fill({ chipTime: '04:00:00', category: 'X' });
    mockModel.exec.mockResolvedValue(finishers);
    const result = await service.calculate('race1', 'c42', 'X', 18000, 500, 0.1);
    // threshold = 500 × 0.10 = 50. confidence = 50 / 50 = 1.0
    expect(result.confidence).toBe(1);
  });

  it('F-010 confidence with multiplier 0.50 → harder to reach 1.0', async () => {
    const finishers = Array(50).fill({ chipTime: '04:00:00', category: 'X' });
    mockModel.exec.mockResolvedValue(finishers);
    const result = await service.calculate('race1', 'c42', 'X', 18000, 500, 0.5);
    // threshold = 500 × 0.50 = 250. confidence = 50 / 250 = 0.2
    expect(result.confidence).toBe(0.2);
  });

  it('F-010 totalRegistered=0 falls back to absolute threshold 50 (pre-F-010 behavior)', async () => {
    const finishers = Array(25).fill({ chipTime: '04:00:00', category: 'X' });
    mockModel.exec.mockResolvedValue(finishers);
    const result = await service.calculate('race1', 'c42', 'X', 18000, 0, 0.2);
    // totalRegistered=0 → fallback threshold 50. confidence = 25/50 = 0.5
    expect(result.confidence).toBe(0.5);
  });

  it('F-010 backward compat: omitting totalRegistered/multiplier → absolute threshold 50', async () => {
    const finishers = Array(50).fill({ chipTime: '04:00:00', category: 'X' });
    mockModel.exec.mockResolvedValue(finishers);
    const result = await service.calculate('race1', 'c42', 'X', 18000);
    // No new params → threshold 50. confidence = 50/50 = 1.0
    expect(result.confidence).toBe(1);
  });

  it('F-010 confidence caps at 1.0 even when totalFinishers exceeds threshold', async () => {
    const finishers = Array(200).fill({ chipTime: '04:00:00', category: 'X' });
    mockModel.exec.mockResolvedValue(finishers);
    const result = await service.calculate('race1', 'c42', 'X', 18000, 500, 0.2);
    // threshold = 100. confidence = MIN(1, 200/100) = 1.0
    expect(result.confidence).toBe(1);
  });
});
