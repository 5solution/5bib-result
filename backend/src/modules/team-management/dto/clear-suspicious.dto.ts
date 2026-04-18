import { ApiProperty } from '@nestjs/swagger';
import { IsNotEmpty, IsString, MaxLength } from 'class-validator';

/**
 * Body for PATCH /registrations/:id/clear-suspicious.
 * admin_note is REQUIRED — clearing a suspicious flag is an audit-logged
 * action and the reviewer must state why it was cleared.
 */
export class ClearSuspiciousDto {
  @ApiProperty({
    description:
      'Admin rationale for clearing the suspicious flag. Appended to registration.notes for audit trail.',
    minLength: 1,
    maxLength: 1000,
  })
  @IsString()
  @IsNotEmpty()
  @MaxLength(1000)
  admin_note!: string;
}
