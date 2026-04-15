import { IsIn, IsString, MinLength, MaxLength } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class ForceUpdateStatusDto {
  @ApiProperty({
    description: 'Target lifecycle status (admin override — bypasses forward-only rule)',
    enum: ['draft', 'pre_race', 'live', 'ended'],
    example: 'pre_race',
  })
  @IsString()
  @IsIn(['draft', 'pre_race', 'live', 'ended'])
  status: string;

  @ApiProperty({
    description:
      'Reason for override (audit trail, min 10 chars). Required because this bypasses the state machine.',
    example: 'Giải bị sync nhầm status ended, cần mở lại để sửa result bib 1234',
    minLength: 10,
    maxLength: 500,
  })
  @IsString()
  @MinLength(10, { message: 'Lý do phải có ít nhất 10 ký tự' })
  @MaxLength(500)
  reason: string;
}
