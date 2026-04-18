import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body for PATCH /registrations/:id/reject.
 * The reason is required — users see it in the rejection email.
 */
export class RejectRegistrationDto {
  @ApiProperty({
    description: 'Reason shown to the applicant in the rejection email',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  rejection_reason!: string;
}
