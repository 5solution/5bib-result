import 'reflect-metadata';
import { validate } from 'class-validator';
import { plainToInstance } from 'class-transformer';
import { BadRequestException } from '@nestjs/common';
import { CreateShortLinkDto } from './dto/create-short-link.dto';
import { ShortLinksController } from './short-links.controller';
import { ShortLinksService } from './short-links.service';
import { LogtoAdminGuard } from '../logto-auth';
import { isReservedCode } from './short-links.constants';

/**
 * FEATURE-089 — QC adversarial suite.
 * (1) DTO validation = open-redirect/alias defense (TC-03/09).
 * (2) Reserved alias case-insensitive bypass attempt.
 * (3) Guard wiring structural assertion (TC-05 auth — admin guard on mutations,
 *     resolve public). Port F-078 Reflect.getMetadata pattern.
 */

async function dtoErrors(obj: Record<string, unknown>): Promise<string[]> {
  const dto = plainToInstance(CreateShortLinkDto, obj);
  const errs = await validate(dto);
  return errs.map((e) => e.property);
}

describe('FEATURE-089 QC — DTO validation (open-redirect + alias)', () => {
  it('chấp nhận URL http/https hợp lệ + alias hợp lệ', async () => {
    expect(
      await dtoErrors({
        targetUrl: 'https://5bib.com/vi/events/lao-cai-marathon-2026',
        customAlias: 'laocai2026',
      }),
    ).toEqual([]);
  });

  it('CHẶN open-redirect javascript: scheme', async () => {
    expect(await dtoErrors({ targetUrl: 'javascript:alert(1)' })).toContain('targetUrl');
  });

  it('CHẶN data: + ftp: scheme', async () => {
    expect(await dtoErrors({ targetUrl: 'data:text/html,<script>' })).toContain('targetUrl');
    expect(await dtoErrors({ targetUrl: 'ftp://evil.com' })).toContain('targetUrl');
  });

  it('CHẶN targetUrl trống / thiếu', async () => {
    expect(await dtoErrors({})).toContain('targetUrl');
    expect(await dtoErrors({ targetUrl: '' })).toContain('targetUrl');
  });

  it('CHẶN targetUrl vượt 2048 ký tự', async () => {
    const long = 'https://5bib.com/' + 'a'.repeat(2048);
    expect(await dtoErrors({ targetUrl: long })).toContain('targetUrl');
  });

  it('CHẶN alias quá ngắn / quá dài / ký tự lạ', async () => {
    const base = { targetUrl: 'https://5bib.com/x' };
    expect(await dtoErrors({ ...base, customAlias: 'ab' })).toContain('customAlias');
    expect(await dtoErrors({ ...base, customAlias: 'a'.repeat(33) })).toContain('customAlias');
    expect(await dtoErrors({ ...base, customAlias: 'has space' })).toContain('customAlias');
    expect(await dtoErrors({ ...base, customAlias: 'bad/slash' })).toContain('customAlias');
  });

  it('boundary: alias đúng 32 + targetUrl đúng 2048 ký tự → hợp lệ', async () => {
    const url2048 = 'https://' + 'a'.repeat(2048 - 'https://'.length);
    expect(url2048).toHaveLength(2048);
    expect(
      await dtoErrors({ targetUrl: url2048, customAlias: 'a'.repeat(32) }),
    ).toEqual([]);
  });
});

describe('FEATURE-089 QC — reserved alias bypass (case-insensitive)', () => {
  let model: any;
  let service: ShortLinksService;
  beforeEach(() => {
    model = { create: jest.fn() };
    service = new ShortLinksService(model, undefined);
  });

  it('isReservedCode bắt mọi case', () => {
    expect(isReservedCode('admin')).toBe(true);
    expect(isReservedCode('ADMIN')).toBe(true);
    expect(isReservedCode('Api')).toBe(true);
    expect(isReservedCode('laocai2026')).toBe(false);
  });

  it('alias "ADMIN" (uppercase) → BadRequest, KHÔNG insert', async () => {
    await expect(
      service.create({ targetUrl: 'https://5bib.com/x', customAlias: 'ADMIN' }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
    expect(model.create).not.toHaveBeenCalled();
  });

  it('alias "Api" (mixed case) → BadRequest', async () => {
    await expect(
      service.create({ targetUrl: 'https://5bib.com/x', customAlias: 'Api' }, 'u'),
    ).rejects.toBeInstanceOf(BadRequestException);
  });
});

describe('FEATURE-089 QC — guard wiring (auth boundary)', () => {
  const guardsOf = (fn: unknown): unknown[] =>
    Reflect.getMetadata('__guards__', fn as object) ?? [];

  it('resolve (public) KHÔNG có LogtoAdminGuard', () => {
    const guards = guardsOf(ShortLinksController.prototype.resolve);
    expect(guards).not.toContain(LogtoAdminGuard);
  });

  it('mọi mutation + list + qr CÓ LogtoAdminGuard', () => {
    for (const method of [
      ShortLinksController.prototype.create,
      ShortLinksController.prototype.list,
      ShortLinksController.prototype.update,
      ShortLinksController.prototype.remove,
      ShortLinksController.prototype.qr,
    ]) {
      expect(guardsOf(method)).toContain(LogtoAdminGuard);
    }
  });
});
