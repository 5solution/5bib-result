import { IsIn, IsString } from 'class-validator';
import { ApiProperty } from '@nestjs/swagger';

export class UpdateStatusDto {
  @ApiProperty({
    description: 'New lifecycle status',
    enum: ['pre_race', 'live', 'ended'],
    example: 'live',
  })
  @IsString()
  @IsIn(['pre_race', 'live', 'ended'])
  status: string;
}
