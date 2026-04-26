import { ApiProperty } from '@nestjs/swagger';
import { IsString, MaxLength, MinLength } from 'class-validator';

export class MarkPaidResponseDto {
  @ApiProperty() success!: boolean;
  @ApiProperty() registration_id!: number;
  @ApiProperty() payment_status!: 'pending' | 'paid';
  @ApiProperty({ description: 'ISO 8601 timestamp when status flipped to paid' })
  paid_at!: string;
  @ApiProperty({ description: 'True if the force-paid path was taken' })
  was_forced!: boolean;
}

export class ForcePaidDto {
  @ApiProperty({
    description:
      'Required justification for bypassing the signed-acceptance gate. Persisted to vol_registration.payment_forced_reason and emitted to the app log as a structured audit line.',
  })
  @IsString()
  @MinLength(10, {
    message: 'force_reason phải có ít nhất 10 ký tự — lý do phải rõ ràng để audit',
  })
  @MaxLength(2000)
  force_reason!: string;
}
