import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEnum,
  IsHexColor,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

export class VisibleSectionsDto {
  @ApiProperty() @IsBoolean() rank!: boolean;
  @ApiProperty() @IsBoolean() finishTime!: boolean;
  @ApiProperty() @IsBoolean() splits!: boolean;
  @ApiProperty() @IsBoolean() sponsorBanner!: boolean;
  @ApiProperty() @IsBoolean() customMessage!: boolean;
  @ApiProperty() @IsBoolean() qrShare!: boolean;
  @ApiProperty() @IsBoolean() photo!: boolean;
}

export class DisplayConfigDto {
  @ApiProperty() @IsString() mongoRaceId!: string;

  @ApiProperty({ enum: ['rank', 'finish-time', 'photo'] })
  @IsEnum(['rank', 'finish-time', 'photo'])
  heroChoice!: 'rank' | 'finish-time' | 'photo';

  @ApiProperty({ type: VisibleSectionsDto })
  @ValidateNested()
  @Type(() => VisibleSectionsDto)
  visibleSections!: VisibleSectionsDto;

  @ApiProperty()
  @IsHexColor()
  themeColor!: string;

  @ApiProperty()
  @IsString()
  @MaxLength(500)
  customMessage!: string;

  @ApiProperty({ type: [String] })
  sponsorLogos!: string[];

  @ApiProperty()
  @IsBoolean()
  soundEnabled!: boolean;

  @ApiProperty()
  @IsInt()
  @Min(10)
  idleTimeoutSeconds!: number;

  @ApiProperty({ enum: ['DEFAULT', 'MINIMAL', 'PREMIUM', 'CUSTOM'] })
  @IsEnum(['DEFAULT', 'MINIMAL', 'PREMIUM', 'CUSTOM'])
  preset!: 'DEFAULT' | 'MINIMAL' | 'PREMIUM' | 'CUSTOM';
}

export class UpdateDisplayConfigDto {
  @ApiPropertyOptional({ enum: ['rank', 'finish-time', 'photo'] })
  @IsOptional()
  @IsEnum(['rank', 'finish-time', 'photo'])
  heroChoice?: 'rank' | 'finish-time' | 'photo';

  @ApiPropertyOptional({ type: VisibleSectionsDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => VisibleSectionsDto)
  visibleSections?: VisibleSectionsDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsHexColor()
  themeColor?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  customMessage?: string;

  @ApiPropertyOptional({ type: [String] })
  @IsOptional()
  sponsorLogos?: string[];

  @ApiPropertyOptional()
  @IsOptional()
  @IsBoolean()
  soundEnabled?: boolean;

  @ApiPropertyOptional()
  @IsOptional()
  @IsInt()
  @Min(10)
  idleTimeoutSeconds?: number;

  @ApiPropertyOptional({ enum: ['DEFAULT', 'MINIMAL', 'PREMIUM', 'CUSTOM'] })
  @IsOptional()
  @IsEnum(['DEFAULT', 'MINIMAL', 'PREMIUM', 'CUSTOM'])
  preset?: 'DEFAULT' | 'MINIMAL' | 'PREMIUM' | 'CUSTOM';
}
