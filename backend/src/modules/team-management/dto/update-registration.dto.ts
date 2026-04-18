import { ApiProperty } from '@nestjs/swagger';
import {
  IsEnum,
  IsInt,
  IsOptional,
  IsString,
  Min,
} from 'class-validator';
import type { PaymentStatus } from '../entities/vol-registration.entity';

/**
 * v1.4: Admin status transitions moved to dedicated endpoints
 * (`/approve`, `/reject`, `/cancel`, `/confirm-completion`).
 * This DTO now only covers field-level edits that don't change state:
 *   - notes
 *   - payment_status (pending → paid)
 *   - actual_working_days (legacy manual override)
 *
 * The `status` field is intentionally omitted — trying to flip status
 * through the generic PATCH route returns 400 "unknown property".
 */
export class UpdateRegistrationDto {
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
