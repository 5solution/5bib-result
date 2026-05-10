import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { Types } from 'mongoose';
import { DashboardUpcomingRacesService } from '../services/upcoming-races.service';
import { Race } from '../../races/schemas/race.schema';

const REDIS_TOKEN = 'default_IORedisModuleConnectionToken';

describe('DashboardUpcomingRacesService', () => {
  let service: DashboardUpcomingRacesService;
  let mockRaceModel: { find: jest.Mock };
  let mockRedis: { hlen: jest.Mock };

  beforeEach(async () => {
    mockRaceModel = { find: jest.fn() };
    mockRedis = { hlen: jest.fn() };
    const moduleRef: TestingModule = await Test.createTestingModule({
      providers: [
        DashboardUpcomingRacesService,
        { provide: getModelToken(Race.name), useValue: mockRaceModel },
        { provide: REDIS_TOKEN, useValue: mockRedis },
      ],
    }).compile();
    service = moduleRef.get(DashboardUpcomingRacesService);
  });

  function mockChain(docs: unknown[]) {
    mockRaceModel.find.mockReturnValue({
      sort: jest.fn().mockReturnThis(),
      limit: jest.fn().mockReturnThis(),
      select: jest.fn().mockReturnThis(),
      lean: jest.fn().mockResolvedValue(docs),
    });
  }

  it('BR-DASH-10: filter status=pre_race + startDate trong 30d', async () => {
    mockChain([]);
    await service.getUpcomingRaces();
    const filter = mockRaceModel.find.mock.calls[0][0];
    expect(filter.status).toBe('pre_race');
    expect(filter.startDate.$gt).toBeInstanceOf(Date);
    expect(filter.startDate.$lte).toBeInstanceOf(Date);
  });

  it('BR-DASH-11: max 6 race, sort startDate ASC', async () => {
    mockChain([]);
    await service.getUpcomingRaces();
    const chain = mockRaceModel.find.mock.results[0].value;
    expect(chain.sort).toHaveBeenCalledWith({ startDate: 1 });
    expect(chain.limit).toHaveBeenCalledWith(6);
  });

  it('Trả card với daysRemaining + athleteCount', async () => {
    const id = new Types.ObjectId();
    const startDate = new Date(Date.now() + 5 * 86400000);
    mockChain([{ _id: id, title: 'R1', startDate, slug: 'r1' }]);
    mockRedis.hlen.mockResolvedValue(150);
    const res = await service.getUpcomingRaces();
    expect(res.races).toHaveLength(1);
    expect(res.races[0].athleteCount).toBe(150);
    expect(res.races[0].daysRemaining).toBeGreaterThanOrEqual(4);
    expect(res.races[0].daysRemaining).toBeLessThanOrEqual(6);
  });

  it('BR-DASH-12: master data có athletes → readiness 25%', async () => {
    const id = new Types.ObjectId();
    mockChain([{ _id: id, title: 'R1', startDate: new Date(Date.now() + 86400000) }]);
    mockRedis.hlen.mockResolvedValue(50);
    const res = await service.getUpcomingRaces();
    expect(res.races[0].readinessPercent).toBe(25);
  });

  it('BR-DASH-12: chưa cấu hình readiness → NULL ("—")', async () => {
    const id = new Types.ObjectId();
    mockChain([{ _id: id, title: 'R1', startDate: new Date(Date.now() + 86400000) }]);
    mockRedis.hlen.mockResolvedValue(0);
    const res = await service.getUpcomingRaces();
    expect(res.races[0].readinessPercent).toBeNull();
  });
});
