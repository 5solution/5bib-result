import { Test, TestingModule } from '@nestjs/testing';
import { RacesController } from './races.controller';
import { RacesService } from './races.service';

describe('RacesController', () => {
  let controller: RacesController;
  let mockRacesService: Partial<RacesService>;

  beforeEach(async () => {
    mockRacesService = {
      searchRaces: jest.fn().mockResolvedValue({ data: { list: [] }, success: true }),
      getRaceById: jest.fn().mockResolvedValue({ data: null, success: false }),
      getRaceBySlug: jest.fn().mockResolvedValue({ data: null, success: false }),
      getRaceByProductId: jest.fn().mockResolvedValue({ data: null, success: false }),
      createRace: jest.fn().mockResolvedValue({ data: {}, success: true }),
      updateRace: jest.fn().mockResolvedValue({ data: {}, success: true }),
      deleteRace: jest.fn().mockResolvedValue({ data: {}, success: true }),
      updateStatus: jest.fn().mockResolvedValue({ data: {}, success: true }),
      addCourse: jest.fn().mockResolvedValue({ data: {}, success: true }),
      updateCourse: jest.fn().mockResolvedValue({ data: {}, success: true }),
      removeCourse: jest.fn().mockResolvedValue({ data: {}, success: true }),
      syncRacesFromSource: jest.fn().mockResolvedValue({ success: true }),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [RacesController],
      providers: [
        { provide: RacesService, useValue: mockRacesService },
      ],
    }).compile();

    controller = module.get<RacesController>(RacesController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  it('should call searchRaces (anonymous — isPrivileged=false)', async () => {
    const mockReq = { user: undefined } as any;
    await controller.searchRaces({ page: 0, pageSize: 10 }, mockReq);
    expect(mockRacesService.searchRaces).toHaveBeenCalledWith({ page: 0, pageSize: 10 }, false);
  });

  it('should call searchRaces (admin — isPrivileged=true)', async () => {
    const mockReq = { user: { userId: 'u1', sub: 'u1', email: 'a@b.c', role: 'admin' } } as any;
    await controller.searchRaces({ page: 0, pageSize: 10 }, mockReq);
    expect(mockRacesService.searchRaces).toHaveBeenCalledWith({ page: 0, pageSize: 10 }, true);
  });

  it('should call getRaceById', async () => {
    const mockReq = { user: undefined } as any;
    await controller.getRaceById('123', mockReq);
    expect(mockRacesService.getRaceById).toHaveBeenCalledWith('123', false);
  });

  it('should call getRaceBySlug', async () => {
    const mockReq = { user: undefined } as any;
    await controller.getRaceBySlug('my-race', mockReq);
    expect(mockRacesService.getRaceBySlug).toHaveBeenCalledWith('my-race', false);
  });

  it('should call createRace', async () => {
    await controller.createRace({ title: 'New Race' });
    expect(mockRacesService.createRace).toHaveBeenCalled();
  });

  it('should call updateRace', async () => {
    await controller.updateRace('123', { title: 'Updated' });
    expect(mockRacesService.updateRace).toHaveBeenCalledWith('123', { title: 'Updated' });
  });

  it('should call deleteRace', async () => {
    await controller.deleteRace('123');
    expect(mockRacesService.deleteRace).toHaveBeenCalledWith('123');
  });

  it('should call updateStatus', async () => {
    await controller.updateStatus('123', { status: 'live' });
    expect(mockRacesService.updateStatus).toHaveBeenCalledWith('123', { status: 'live' });
  });

  it('should call addCourse', async () => {
    await controller.addCourse('123', { courseId: 'c1', name: 'Test' });
    expect(mockRacesService.addCourse).toHaveBeenCalled();
  });

  it('should call removeCourse', async () => {
    await controller.removeCourse('123', 'c1');
    expect(mockRacesService.removeCourse).toHaveBeenCalledWith('123', 'c1');
  });
});
