import { ApiProperty } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MaxLength } from 'class-validator';

export type AlertAction = 'RESOLVE' | 'FALSE_ALARM' | 'REOPEN';

export class AlertActionDto {
  @ApiProperty({ enum: ['RESOLVE', 'FALSE_ALARM', 'REOPEN'] })
  @IsEnum(['RESOLVE', 'FALSE_ALARM', 'REOPEN'])
  action: AlertAction;

  @ApiProperty({ description: 'Resolution note (audit log)', maxLength: 1000 })
  @IsString()
  @MaxLength(1000)
  note: string;
}

export class ListAlertsQueryDto {
  @ApiProperty({ required: false, enum: ['CRITICAL', 'HIGH', 'WARNING', 'INFO'] })
  @IsOptional()
  @IsEnum(['CRITICAL', 'HIGH', 'WARNING', 'INFO'])
  severity?: 'CRITICAL' | 'HIGH' | 'WARNING' | 'INFO';

  @ApiProperty({ required: false, enum: ['OPEN', 'RESOLVED', 'FALSE_ALARM'] })
  @IsOptional()
  @IsEnum(['OPEN', 'RESOLVED', 'FALSE_ALARM'])
  status?: 'OPEN' | 'RESOLVED' | 'FALSE_ALARM';

  @ApiProperty({ required: false, description: 'Filter by contest (course name)' })
  @IsOptional()
  @IsString()
  course?: string;

  @ApiProperty({ required: false, default: 1 })
  @IsOptional()
  page?: number;

  @ApiProperty({ required: false, default: 50, maximum: 100 })
  @IsOptional()
  pageSize?: number;
}
