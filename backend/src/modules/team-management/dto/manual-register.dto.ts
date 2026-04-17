import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsEmail,
  IsInt,
  IsObject,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

/**
 * Admin manually adds a person they already know about (phone call, prior
 * conversation, walk-in). Bypasses the public register throttle + picks
 * the status directly. Same data shape as public register plus a status
 * override.
 */
export class AdminManualRegisterDto {
  @ApiProperty() @IsInt() role_id!: number;

  @ApiProperty({ minLength: 2 })
  @IsString()
  @MinLength(2)
  full_name!: string;

  @ApiProperty() @IsEmail() email!: string;

  @ApiProperty({ example: '0901234567' })
  @IsString()
  phone!: string;

  @ApiProperty({
    description: 'Dynamic fields matching role.form_fields',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  form_data!: Record<string, unknown>;

  @ApiProperty({
    default: true,
    description:
      'TRUE (default): admin is entering someone they have already vetted → status=approved + QR emailed. FALSE: register as pending so admin reviews later like a regular registration.',
  })
  @IsBoolean()
  @IsOptional()
  auto_approve?: boolean = true;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;
}
