import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type {
  PaymentStatus,
  RegistrationStatus,
} from '../entities/vol-registration.entity';

const ADMIN_SETTABLE_STATUS = [
  'approved',
  'rejected',
  'cancelled',
  'pending',
] as const;

export class UpdateRegistrationDto {
  @ApiProperty({ enum: ADMIN_SETTABLE_STATUS, required: false })
  @IsEnum(ADMIN_SETTABLE_STATUS)
  @IsOptional()
  status?: Extract<RegistrationStatus, (typeof ADMIN_SETTABLE_STATUS)[number]>;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  notes?: string;

  @ApiProperty({ enum: ['pending', 'paid'], required: false })
  @IsEnum(['pending', 'paid'])
  @IsOptional()
  payment_status?: PaymentStatus;

  @ApiProperty({ required: false, minimum: 0 })
  @IsInt()
  @Min(0)
  @IsOptional()
  actual_working_days?: number;
}
