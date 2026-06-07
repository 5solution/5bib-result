import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

/**
 * F-069 M2a BR-MP-36b — Admin Logto user lookup endpoint DTOs.
 *
 * Endpoint: GET /api/admin/merchant-portal/logto-lookup?q=<email|userId>
 * Reuses M1 `LogtoService.lookupByIdWithCache` / `lookupByEmail` based on
 * query format (contains `@` → email lookup; otherwise → userId lookup).
 *
 * Status codes:
 *  - 200 found      → { found: true, user, source }
 *  - 200 not found  → { found: false, user: null, source: 'api' }
 *  - 400 too short  → MinLength validator fails (`q.length < 3`)
 *  - 401 unauth     → LogtoAuthGuard
 *  - 403 not admin  → LogtoAdminGuard
 *  - 503 Logto unreachable → controller maps null + service degraded → 503 JSON
 */

export class LogtoLookupQueryDto {
  @ApiProperty({
    description: 'Logto userId hoặc email. Min 3 ký tự.',
    minLength: 3,
    maxLength: 254,
    example: 'a@btc.vn',
  })
  @IsString()
  @MinLength(3, { message: 'Từ khóa tìm kiếm phải ít nhất 3 ký tự' })
  @MaxLength(254)
  q!: string;
}

export class LogtoLookupUserDto {
  @ApiProperty({ example: 'logto_4a9f2b71c0' })
  userId!: string;

  @ApiProperty({ example: 'a@btc.vn' })
  email!: string;

  @ApiProperty({ nullable: true, example: 'Nguyễn Văn A' })
  name!: string | null;

  @ApiProperty({ nullable: true, example: 'a.nguyen' })
  username!: string | null;
}

export class LogtoLookupResponseDto {
  @ApiProperty({
    description: 'true nếu Logto trả về 1 user match exact email/userId',
  })
  found!: boolean;

  @ApiProperty({
    type: LogtoLookupUserDto,
    nullable: true,
    description: 'null khi found=false',
  })
  user!: LogtoLookupUserDto | null;

  @ApiProperty({
    enum: ['cache', 'api'],
    description: 'Lookup source — cache hit hoặc Logto API hit',
  })
  source!: 'cache' | 'api';
}
