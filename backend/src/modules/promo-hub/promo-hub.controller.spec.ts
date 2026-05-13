import { Test, TestingModule } from '@nestjs/testing';
import { PromoHubController } from './promo-hub.controller';
import { PromoHubService } from './promo-hub.service';
import type { LogtoUser } from '../logto-auth/types';

describe('PromoHubController', () => {
  let controller: PromoHubController;
  let mockService: jest.Mocked<Partial<PromoHubService>>;

  const fakeUser: LogtoUser = {
    userId: 'u1',
    sub: 'u1',
    email: 'admin@5bib.com',
    role: 'admin',
    roles: ['admin'],
    scopes: ['admin'],
  };

  beforeEach(async () => {
    mockService = {
      create: jest.fn(),
      list: jest.fn(),
      findById: jest.fn(),
      findBySlugPublic: jest.fn(),
      update: jest.fn(),
      reorderSections: jest.fn(),
      softDelete: jest.fn(),
    };

    const moduleRef: TestingModule = await Test.createTestingModule({
      controllers: [PromoHubController],
      providers: [{ provide: PromoHubService, useValue: mockService }],
    }).compile();

    controller = moduleRef.get<PromoHubController>(PromoHubController);
  });

  it('create — delegates to service with user.sub', async () => {
    (mockService.create as jest.Mock).mockResolvedValue({ id: '1' });
    await controller.create(
      { slug: 'h', title: 't' },
      fakeUser,
    );
    expect(mockService.create).toHaveBeenCalledWith(
      { slug: 'h', title: 't' },
      'u1',
    );
  });

  it('findBySlug — public path no auth, delegates correctly', async () => {
    (mockService.findBySlugPublic as jest.Mock).mockResolvedValue({ id: '1' });
    await controller.findBySlug('test-hub');
    expect(mockService.findBySlugPublic).toHaveBeenCalledWith('test-hub');
  });

  it('reorderSections — passes sectionIds array + user.sub', async () => {
    (mockService.reorderSections as jest.Mock).mockResolvedValue({ id: '1' });
    await controller.reorderSections(
      '67451abc1234567890abcdef',
      { sectionIds: ['a', 'b', 'c'] },
      fakeUser,
    );
    expect(mockService.reorderSections).toHaveBeenCalledWith(
      '67451abc1234567890abcdef',
      ['a', 'b', 'c'],
      'u1',
    );
  });

  it('list — parses numeric pageNo/pageSize from query strings', async () => {
    (mockService.list as jest.Mock).mockResolvedValue({
      data: [],
      total: 0,
      pageNo: 2,
      pageSize: 10,
      totalPages: 0,
    });
    await controller.list('published', '2', '10', 'utmb');
    expect(mockService.list).toHaveBeenCalledWith({
      status: 'published',
      pageNo: 2,
      pageSize: 10,
      q: 'utmb',
    });
  });
});
