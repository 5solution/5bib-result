import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DashboardLiveRacesService } from '../services/live-races.service';
import { Race } from '../../races/schemas/race.schema';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('DashboardLiveRacesService', () => {
  let service: DashboardLiveRacesService;
  let mockRaceModel: { find: jest.Mock };
  let mockRedis: { pipeline: jest.Mock };
  let pipelineExec: jest.Mock;

  beforeEach(async () => {
    mockRaceModel = { find: jest.fn() };
    pipelineExec = jest.fn();
    const pipelineObj = {
      get: jest.fn().mockReturnThis(),
      exec: pipelineExec,
    };
    mockRedis = { pipeline: jest.fn(() => pipelineObj) };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardLiveRacesService,
        { provide: getModelToken(Race.name), useValue: mockRaceModel },
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    service = moduleRef.get(DashboardLiveRacesService);
  });

  function mockFindChain(returnedDocs: unknown[]) {
    mockRaceModel.find.mockReturnValue({
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(returnedDocs),
    });
  }

  // Pipeline interleaves [snapshot, medical, snapshot, medical, ...] per race.
  function setPipelineResults(values: Array<string | null>) {
    pipelineExec.mockResolvedValue(values.map((v) => [null, v]));
  }

  it('Filter status=live (cross-race scoping rule)', async () => {
    mockFindChain([]);
    await service.getLiveRaces();
    expect(mockRaceModel.find).toHaveBeenCalledWith({ status: 'live' });
  });

  it('Trả card đầy đủ progress + runners + alerts', async () => {
    const id = new Types.ObjectId();
    mockFindChain([
      {
        _id: id,
        title: 'Race A',
        slug: 'race-a',
        province: 'Hà Nội',
        courses: [{ courseId: 'c1', name: '42K' }],
      },
    ]);
    setPipelineResults([
      JSON.stringify({ progressPercent: 60, runnersOnCourse: 120 }),
      '3',
    ]);
    const res = await service.getLiveRaces();
    expect(res.races).toHaveLength(1);
    expect(res.races[0].progressPercent).toBe(60);
    expect(res.races[0].runnersOnCourse).toBe(120);
    expect(res.races[0].alertsCount).toBe(3);
    expect(res.races[0].hasCriticalAlert).toBe(true);
    expect(res.races[0].activeCourseName).toBe('42K');
  });

  it('Edge: không có snapshot Redis → progress=0, runners=0', async () => {
    const id = new Types.ObjectId();
    mockFindChain([{ _id: id, title: 'Race B' }]);
    setPipelineResults([null, null]);
    const res = await service.getLiveRaces();
    expect(res.races[0].progressPercent).toBe(0);
    expect(res.races[0].runnersOnCourse).toBe(0);
    expect(res.races[0].hasCriticalAlert).toBe(false);
  });

  it('Edge: snapshot có started/finished → tự tính runnersOnCourse', async () => {
    const id = new Types.ObjectId();
    mockFindChain([{ _id: id, title: 'Race C' }]);
    setPipelineResults([
      JSON.stringify({ started: 200, finished: 50 }),
      null,
    ]);
    const res = await service.getLiveRaces();
    expect(res.races[0].runnersOnCourse).toBe(150);
  });

  it('Resilient: Redis fail → progress=0 vẫn return', async () => {
    const id = new Types.ObjectId();
    mockFindChain([{ _id: id, title: 'Race D' }]);
    pipelineExec.mockRejectedValue(new Error('redis down'));
    const res = await service.getLiveRaces();
    expect(res.races).toHaveLength(1);
    expect(res.races[0].progressPercent).toBe(0);
  });
});
