import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

export class HelpfulVoteDto {
  @ApiProperty({ description: 'true = useful, false = not useful' })
  @IsBoolean()
  helpful: boolean;
}
