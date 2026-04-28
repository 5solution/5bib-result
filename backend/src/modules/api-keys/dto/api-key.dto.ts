import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Max,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateApiKeyDto {
  @ApiProperty({ example: '5bib.com homepage widget' })
  @IsString()
  @MinLength(2)
  @MaxLength(120)
  name: string;

  @ApiPropertyOptional({
    description: 'CORS-style origin allowlist. Empty = allow any origin.',
    example: ['https://5bib.com', 'https://www.5bib.com'],
    type: [String],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(20)
  @IsString({ each: true })
  allowedOrigins?: string[];

  @ApiPropertyOptional({ description: 'Per-minute cap; 0 = unlimited', default: 1000 })
  @IsOptional()
  @IsInt()
  @Min(0)
  @Max(100_000)
  rateLimitPerMinute?: number;

  @ApiPropertyOptional() @IsOptional() @IsBoolean() isActive?: boolean;

  @ApiPropertyOptional({ maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  notes?: string;
}

export class UpdateApiKeyDto extends PartialType(CreateApiKeyDto) {}

export class ApiKeyResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() name: string;
  @ApiProperty({ description: 'Public prefix; full key never returned after creation.' })
  keyPrefix: string;
  @ApiProperty({ type: [String] }) allowedOrigins: string[];
  @ApiProperty() rateLimitPerMinute: number;
  @ApiProperty() isActive: boolean;
  @ApiProperty({ nullable: true, type: String, format: 'date-time' })
  lastUsedAt: Date | null;
  @ApiProperty() usageCount: number;
  @ApiProperty() notes: string;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt: Date;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt: Date;
}

/** Returned ONLY on create — frontend must show full key once then never again. */
export class CreatedApiKeyDto extends ApiKeyResponseDto {
  @ApiProperty({
    description:
      'Full key in cleartext — stored client-side, NEVER displayed again after page leave.',
    example: 'ak_aB3xY9pQ2rT4mN5kL8vW1zX6yZ7gH3jD5fS9...',
  })
  fullKey: string;
}
