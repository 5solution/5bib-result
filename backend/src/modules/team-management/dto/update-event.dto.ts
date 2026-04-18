import { PartialType } from '@nestjs/swagger';
import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional } from 'class-validator';
import { CreateEventDto } from './create-event.dto';
import type { VolEventStatus } from '../entities/vol-event.entity';

export class UpdateEventDto extends PartialType(CreateEventDto) {
  @ApiProperty({
    enum: ['draft', 'open', 'closed', 'completed'],
    required: false,
  })
  @IsEnum(['draft', 'open', 'closed', 'completed'])
  @IsOptional()
  status?: VolEventStatus;
}
