import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body for PATCH /registrations/:id/cancel. Reason is optional. */
export class CancelRegistrationDto {
  @ApiProperty({ required: false, maxLength: 1000 })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  reason?: string;
}
