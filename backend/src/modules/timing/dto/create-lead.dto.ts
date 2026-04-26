import { ApiProperty } from '@nestjs/swagger';
import {
  ArrayMaxSize,
  IsArray,
  IsEmail,
  IsEnum,
  IsNotEmpty,
  IsOptional,
  IsString,
  Matches,
  MaxLength,
} from 'class-validator';

const PACKAGES = ['basic', 'advanced', 'professional', 'unspecified'] as const;
type Package = (typeof PACKAGES)[number];

const SPORT_TYPES = ['pickleball', 'badminton', 'both'] as const;
const TOURNAMENT_SCALES = ['lt50', '50-200', 'gt200'] as const;
const TOURNAMENT_TIMINGS = ['1-3m', '3-6m', 'tbd'] as const;
const LEAD_TRACKS = ['5sport-btc', '5sport-athlete'] as const;
type LeadTrack = (typeof LEAD_TRACKS)[number];

/** 5Solution umbrella enums (kept here so DTO sees the same values as schema). */
const SOL_EVENT_TYPES = ['race', 'concert', 'tournament', 'other'] as const;
const SOL_SCALES = ['lt500', '500-2000', '2000-10000', 'gt10000'] as const;
const SOL_MODULES = ['5bib', '5ticket', '5pix', '5sport', '5tech'] as const;

export class CreateLeadDto {
  @ApiProperty({ example: 'Nguyễn Văn A', maxLength: 100 })
  @IsString()
  @IsNotEmpty({ message: 'Vui lòng nhập họ tên' })
  @MaxLength(100)
  full_name: string;

  @ApiProperty({ required: false, example: '0909000000', maxLength: 20 })
  @IsOptional()
  @IsString()
  @Matches(/^(0|\+84)[0-9]{8,10}$/, {
    message: 'Số điện thoại không hợp lệ',
  })
  phone?: string;

  @ApiProperty({ required: false, example: 'CLB Chạy Bộ Hà Nội', maxLength: 200 })
  @IsOptional()
  @IsString()
  @MaxLength(200)
  organization?: string;

  @ApiProperty({ required: false, example: '500 – 1,000 VĐV' })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  athlete_count_range?: string;

  @ApiProperty({ required: false, enum: PACKAGES, default: 'unspecified' })
  @IsOptional()
  @IsEnum(PACKAGES)
  package_interest?: Package;

  @ApiProperty({ required: false, maxLength: 2000 })
  @IsOptional()
  @IsString()
  @MaxLength(2000)
  notes?: string;

  /** 5Sport — VĐV track uses email, BTC track uses phone. Either is acceptable but at least one must exist at controller layer. */
  @ApiProperty({ required: false, example: 'nguyenvana@gmail.com' })
  @IsOptional()
  @IsEmail({}, { message: 'Email không hợp lệ' })
  @MaxLength(100)
  email?: string;

  @ApiProperty({ required: false, enum: SPORT_TYPES })
  @IsOptional()
  @IsEnum(SPORT_TYPES)
  sport_type?: (typeof SPORT_TYPES)[number];

  @ApiProperty({ required: false, enum: TOURNAMENT_SCALES })
  @IsOptional()
  @IsEnum(TOURNAMENT_SCALES)
  tournament_scale?: (typeof TOURNAMENT_SCALES)[number];

  @ApiProperty({ required: false, enum: TOURNAMENT_TIMINGS })
  @IsOptional()
  @IsEnum(TOURNAMENT_TIMINGS)
  tournament_timing?: (typeof TOURNAMENT_TIMINGS)[number];

  @ApiProperty({ required: false, example: 'TP.HCM', maxLength: 100 })
  @IsOptional()
  @IsString()
  @MaxLength(100)
  city?: string;

  /** 5Sport — which track this lead belongs to ('5sport-btc' | '5sport-athlete'). Controller sets source accordingly. */
  @ApiProperty({ required: false, enum: LEAD_TRACKS })
  @IsOptional()
  @IsEnum(LEAD_TRACKS)
  track?: LeadTrack;

  /** Honeypot — bots fill this; real users leave it empty. */
  @ApiProperty({ required: false, description: 'Honeypot — leave empty' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  website?: string;

  // ─── 5Solution umbrella landing extras ──────────────────────────────────
  @ApiProperty({ required: false, enum: SOL_EVENT_TYPES })
  @IsOptional()
  @IsEnum(SOL_EVENT_TYPES)
  event_type?: (typeof SOL_EVENT_TYPES)[number];

  @ApiProperty({ required: false, enum: SOL_SCALES })
  @IsOptional()
  @IsEnum(SOL_SCALES)
  event_scale?: (typeof SOL_SCALES)[number];

  @ApiProperty({
    required: false,
    isArray: true,
    enum: SOL_MODULES,
    example: ['5bib', '5pix'],
  })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(5)
  @IsEnum(SOL_MODULES, { each: true })
  modules?: (typeof SOL_MODULES)[number][];
}
