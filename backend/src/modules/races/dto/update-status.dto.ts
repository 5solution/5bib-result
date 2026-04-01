import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'New lifecycle status',
    enum: ['draft', 'pre_race', 'live', 'ended'],
    example: 'live',
  })
  @IsString()
  @IsIn(['draft', 'pre_race', 'live', 'ended'])
  status: string;
}
