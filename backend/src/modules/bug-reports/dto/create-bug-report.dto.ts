import { ApiProperty } from '@nestjs/swagger';
import {
  Equals,
  IsBoolean,
  IsEmail,
  IsEnum,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
  MinLength,
} from 'class-validator';
import { BUG_CATEGORIES, BUG_SEVERITIES, BugCategory, BugSeverity } from '../schemas/bug-report.schema';

export class CreateBugReportDto {
  @ApiProperty({ minLength: 5, maxLength: 200, example: 'Không tải được kết quả giải VMM 2026' })
  @IsString()
  @MinLength(5)
  @MaxLength(200)
  title!: string;

  @ApiProperty({ enum: BUG_CATEGORIES })
  @IsEnum(BUG_CATEGORIES)
  category!: BugCategory;

  @ApiProperty({ enum: BUG_SEVERITIES, required: false, default: 'unknown' })
  @IsOptional()
  @IsEnum(BUG_SEVERITIES)
  severity?: BugSeverity;

  @ApiProperty({ minLength: 20, maxLength: 2000 })
  @IsString()
  @MinLength(20)
  @MaxLength(2000)
  description!: string;

  @ApiProperty({ required: false, maxLength: 1000 })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  stepsToReproduce?: string;

  // Reject non-http(s) URIs at validation — prevents javascript:/data: URIs
  // ever reaching DB or admin UI, where they'd otherwise enable XSS.
  @ApiProperty({ required: false, maxLength: 500, example: 'https://5bib.com/...' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  @Matches(/^https?:\/\//i, { message: 'URL phải bắt đầu bằng http:// hoặc https://' })
  urlAffected?: string;

  @ApiProperty({ format: 'email' })
  @IsEmail()
  @MaxLength(200)
  email!: string;

  @ApiProperty({ required: false, maxLength: 30 })
  @IsOptional()
  @IsString()
  @MaxLength(30)
  phoneNumber?: string;

  @ApiProperty({ default: true })
  @IsBoolean()
  wantsUpdates!: boolean;

  @ApiProperty({ description: 'User must explicitly consent to data storage' })
  @IsBoolean()
  @Equals(true, { message: 'Bạn phải đồng ý điều khoản để gửi báo cáo' })
  consent!: boolean;

  // Honeypot — hidden field; if filled, request is silently dropped (anti-bot).
  @ApiProperty({ required: false, description: 'Honeypot — leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  // Client-provided metadata (untrusted, used only for debug context)
  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  userAgent?: string;

  @ApiProperty({ required: false, maxLength: 20 })
  @IsOptional()
  @IsString()
  @MaxLength(20)
  viewport?: string;

  @ApiProperty({ required: false, maxLength: 500 })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  referrer?: string;
}
