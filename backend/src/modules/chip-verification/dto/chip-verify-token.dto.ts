import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean, IsEnum, IsInt, Min } from 'class-validator';
import { Type } from 'class-transformer';

export type TokenAction = 'GENERATE' | 'ROTATE' | 'DISABLE';

export class TokenActionRequestDto {
  @ApiProperty({ enum: ['GENERATE', 'ROTATE', 'DISABLE'] })
  @IsEnum(['GENERATE', 'ROTATE', 'DISABLE'])
  action: TokenAction;
}

export class TokenActionResponseDto {
  @ApiProperty({
    description:
      'New token (32-char base64url) — null if action=DISABLE. Token TTL ∞, rotate manually.',
    nullable: true,
  })
  token: string | null;

  @ApiProperty()
  chip_verify_enabled: boolean;

  @ApiProperty({ description: 'Total active mappings (for preload progress).' })
  total_chip_mappings: number;

  @ApiProperty({ nullable: true })
  preload_completed_at: Date | null;
}

export class ChipConfigResponseDto {
  @ApiProperty()
  chip_verify_enabled: boolean;

  @ApiProperty({
    nullable: true,
    description:
      'Token chỉ trả về cho admin sau GENERATE/ROTATE — endpoint GET /config sẽ trả null vì admin đã copy URL.',
  })
  chip_verify_token: string | null;

  @ApiProperty()
  total_chip_mappings: number;

  @ApiProperty({ nullable: true })
  preload_completed_at: Date | null;

  @ApiProperty({ description: 'Whether cache:ready sentinel exists in Redis.' })
  cache_ready: boolean;

  @ApiProperty({
    description:
      'Per-race toggle cho cron delta sync auto-update cache mỗi 30s.',
  })
  delta_sync_enabled: boolean;
}

export class LinkMongoRaceRequestDto {
  @ApiProperty({
    description:
      'MySQL platform race_id (numeric, từ 5bib_platform_live.races.race_id). BTC nhập tay khi link race admin sang race platform.',
    example: 123,
    minimum: 1,
  })
  @Type(() => Number)
  @IsInt()
  @Min(1)
  mysql_race_id: number;
}

export class ChipConfigLinkResponseDto {
  @ApiProperty()
  mongo_race_id: string;

  @ApiProperty()
  mysql_race_id: number;

  @ApiProperty()
  chip_verify_enabled: boolean;

  @ApiProperty()
  total_chip_mappings: number;
}

export class DeltaSyncToggleRequestDto {
  @ApiProperty({
    description:
      'Bật/tắt auto cron delta sync mỗi 30s. Tắt khi muốn freeze cache hoặc giảm load MySQL.',
  })
  @IsBoolean()
  enabled: boolean;
}

export class CacheActionRequestDto {
  @ApiProperty({ enum: ['REFRESH', 'CLEAR'] })
  @IsEnum(['REFRESH', 'CLEAR'])
  action: 'REFRESH' | 'CLEAR';
}

export class CacheActionResponseDto {
  @ApiProperty()
  success: boolean;

  @ApiProperty({ description: 'Number of athlete-bib pairs cached.' })
  cached_count: number;

  @ApiProperty({ nullable: true })
  preload_completed_at: Date | null;
}
