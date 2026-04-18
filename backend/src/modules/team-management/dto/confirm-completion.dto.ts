import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MaxLength } from 'class-validator';

/** Body for PATCH /registrations/:id/confirm-completion (admin override). */
export class ConfirmCompletionDto {
  @ApiProperty({
    required: false,
    maxLength: 1000,
    description: 'Optional admin note appended to registration.notes',
  })
  @IsString()
  @IsOptional()
  @MaxLength(1000)
  note?: string;
}
