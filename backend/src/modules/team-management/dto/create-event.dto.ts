import { ApiProperty } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsInt,
  IsISO8601,
  IsNumber,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';

export class CreateEventDto {
  @ApiProperty() @IsString() event_name!: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() race_id?: string;

  @ApiProperty() @IsString() location!: string;

  @ApiProperty({ required: false }) @IsNumber() @IsOptional() location_lat?: number;

  @ApiProperty({ required: false }) @IsNumber() @IsOptional() location_lng?: number;

  @ApiProperty({ default: 500 }) @IsInt() @Min(50) checkin_radius_m: number = 500;

  @ApiProperty({ example: '2026-05-02' }) @IsDateString() event_start_date!: string;

  @ApiProperty({ example: '2026-05-03' }) @IsDateString() event_end_date!: string;

  @ApiProperty({ example: '2026-04-17T00:00:00Z' }) @IsISO8601() registration_open!: string;

  @ApiProperty({ example: '2026-04-30T23:59:59Z' }) @IsISO8601() registration_close!: string;

  @ApiProperty({ required: false }) @IsEmail() @IsOptional() contact_email?: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() contact_phone?: string;

  @ApiProperty({
    required: false,
    description:
      'Public S3 URL of the benefits banner. Upload separately via /team-upload-photo, then pass the URL here.',
  })
  @IsString()
  @IsOptional()
  benefits_image_url?: string;

  @ApiProperty({
    required: false,
    description:
      'Plain-text terms & conditions shown on the crew register page. TNV must agree before submitting.',
  })
  @IsString()
  @IsOptional()
  terms_conditions?: string;
}
