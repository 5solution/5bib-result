import { IsString, IsEmail, IsOptional, IsArray } from 'class-validator';
import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SubmitClaimDto {
  @ApiProperty({ description: 'Race ID', example: '6651a...' })
  @IsString()
  raceId: string;

  @ApiProperty({ description: 'Course ID', example: '708' })
  @IsString()
  courseId: string;

  @ApiProperty({ description: 'Bib number', example: '1234' })
  @IsString()
  bib: string;

  @ApiProperty({ description: 'Claimant name', example: 'Nguyen Van A' })
  @IsString()
  name: string;

  @ApiPropertyOptional({ description: 'Claimant email', example: 'runner@example.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiProperty({ description: 'Phone number for contact', example: '0912345678' })
  @IsString()
  phone: string;

  @ApiProperty({
    description: 'Claim description / reason',
    example: 'My chip time is incorrect, it should be 3:45:00',
  })
  @IsString()
  description: string;

  @ApiPropertyOptional({
    description: 'Attachment URLs (tracklog, screenshots)',
    example: ['https://s3.../tracklog.gpx'],
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  attachments?: string[];
}
