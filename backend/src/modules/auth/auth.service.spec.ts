import { Test, TestingModule } from '@nestjs/testing';
import { getModelToken } from '@nestjs/mongoose';
import { JwtService } from '@nestjs/jwt';
import { UnauthorizedException } from '@nestjs/common';
import * as bcrypt from 'bcrypt';
import { AuthService } from './auth.service';
import { AdminUser } from './schemas/admin-user.schema';

const mockAdminUser = {
  _id: '64f0000000000000000000001',
  email: 'admin@5bib.vn',
  password: '', // filled in beforeAll
  role: 'admin',
  displayName: '5Bib Admin',
};

const mockAdminUserModel = {
  findOne: jest.fn(),
  findById: jest.fn(),
  create: jest.fn(),
};

const mockJwtService = {
  sign: jest.fn().mockReturnValue('mock.jwt.token'),
};

describe('AuthService', () => {
  let service: AuthService;

  beforeAll(async () => {
    mockAdminUser.password = await bcrypt.hash('Admin@5bib2026', 10);
  });

  beforeEach(async () => {
    const module: TestingModule = await Test.createTestingModule({
      providers: [
        AuthService,
        { provide: getModelToken(AdminUser.name), useValue: mockAdminUserModel },
        { provide: JwtService, useValue: mockJwtService },
      ],
    }).compile();

    service = module.get<AuthService>(AuthService);
    jest.clearAllMocks();
  });

  describe('login — success', () => {
    it('returns token and user info when credentials are valid', async () => {
      mockAdminUserModel.findOne.mockResolvedValueOnce(mockAdminUser);
      mockJwtService.sign.mockReturnValueOnce('signed.jwt.token');

      const result = await service.login('admin@5bib.vn', 'Admin@5bib2026');

      expect(result).toHaveProperty('token', 'signed.jwt.token');
      expect(result.user).toMatchObject({
        email: 'admin@5bib.vn',
        role: 'admin',
      });
      expect(result.user).not.toHaveProperty('password');
    });
  });

  describe('login — wrong password', () => {
    it('throws UnauthorizedException when password does not match', async () => {
      mockAdminUserModel.findOne.mockResolvedValueOnce(mockAdminUser);

      await expect(
        service.login('admin@5bib.vn', 'WrongPassword!'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('login — user not found', () => {
    it('throws UnauthorizedException when email is unknown', async () => {
      mockAdminUserModel.findOne.mockResolvedValueOnce(null);

      await expect(
        service.login('unknown@5bib.vn', 'Admin@5bib2026'),
      ).rejects.toThrow(UnauthorizedException);
    });
  });

  describe('seedAdmin', () => {
    it('creates default admin when none exists', async () => {
      mockAdminUserModel.findOne.mockResolvedValueOnce(null);
      mockAdminUserModel.create.mockResolvedValueOnce(mockAdminUser);

      await service.seedAdmin();

      expect(mockAdminUserModel.create).toHaveBeenCalledTimes(1);
      const createArg = mockAdminUserModel.create.mock.calls[0][0];
      expect(createArg.email).toBe('admin@5bib.vn');
      expect(createArg.role).toBe('admin');
      // password must be a bcrypt hash, not plaintext
      expect(createArg.password).toMatch(/^\$2[aby]\$/);
    });

    it('skips creation when default admin already exists', async () => {
      mockAdminUserModel.findOne.mockResolvedValueOnce(mockAdminUser);

      await service.seedAdmin();

      expect(mockAdminUserModel.create).not.toHaveBeenCalled();
    });
  });
});
