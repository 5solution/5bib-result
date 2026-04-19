import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  ArrayMaxSize,
  IsArray,
  IsBoolean,
  IsMongoId,
  IsOptional,
  IsString,
  ValidateNested,
} from 'class-validator';

export class CourseTemplateOverrideDto {
  @ApiProperty({ example: '70K' })
  @IsString()
  course_id: string;

  @ApiPropertyOptional({ example: '65f5e2b1a1b2c3d4e5f6a7b8', nullable: true })
  @IsOptional()
  @IsMongoId()
  template_certificate?: string | null;

  @ApiPropertyOptional({ example: '65f5e2b1a1b2c3d4e5f6a7b9', nullable: true })
  @IsOptional()
  @IsMongoId()
  template_share_card?: string | null;
}

export class UpsertRaceConfigDto {
  @ApiPropertyOptional({ example: '65f5e2b1a1b2c3d4e5f6a7b8', nullable: true })
  @IsOptional()
  @IsMongoId()
  default_template_certificate?: string | null;

  @ApiPropertyOptional({ example: '65f5e2b1a1b2c3d4e5f6a7b9', nullable: true })
  @IsOptional()
  @IsMongoId()
  default_template_share_card?: string | null;

  @ApiPropertyOptional({ type: [CourseTemplateOverrideDto] })
  @IsOptional()
  @IsArray()
  @ArrayMaxSize(50)
  @ValidateNested({ each: true })
  @Type(() => CourseTemplateOverrideDto)
  course_overrides?: CourseTemplateOverrideDto[];

  @ApiPropertyOptional({ example: true })
  @IsOptional()
  @IsBoolean()
  enabled?: boolean;
}
