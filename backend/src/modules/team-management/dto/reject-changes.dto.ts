import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * v1.4.1 — Admin rejecting a TNV profile-edit request.
 * Reason is required and appended to the registration.notes audit log.
 */
export class RejectChangesDto {
  @ApiProperty({ minLength: 1, maxLength: 1000 })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  reason!: string;
}
