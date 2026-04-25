import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class CourseTemplateOverrideResponseDto {
  @ApiProperty({ example: '70K' }) course_id: string;
  @ApiPropertyOptional({ example: '65f5e2b1a1b2c3d4e5f6a7b8', nullable: true })
  template_certificate?: string | null;
  @ApiPropertyOptional({ example: '65f5e2b1a1b2c3d4e5f6a7b9', nullable: true })
  template_share_card?: string | null;
}

export class RaceConfigResponseDto {
  @ApiProperty({ example: '65f5e2b1a1b2c3d4e5f6a7b0' }) id: string;
  @ApiProperty({ example: '65f5e2b1a1b2c3d4e5f6a7b8' }) race_id: string;
  @ApiPropertyOptional({ example: '65f5e2b1a1b2c3d4e5f6a7b8', nullable: true })
  default_template_certificate?: string | null;
  @ApiPropertyOptional({ example: '65f5e2b1a1b2c3d4e5f6a7b9', nullable: true })
  default_template_share_card?: string | null;
  @ApiProperty({ type: [CourseTemplateOverrideResponseDto] })
  course_overrides: CourseTemplateOverrideResponseDto[];
  @ApiProperty({ example: true }) enabled: boolean;
  @ApiProperty({ example: '2026-04-19T01:00:00Z' }) created_at: Date;
  @ApiProperty({ example: '2026-04-19T01:00:00Z' }) updated_at: Date;
}
