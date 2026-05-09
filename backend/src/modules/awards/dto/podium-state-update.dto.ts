import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsEnum, IsOptional, IsString, MinLength } from 'class-validator';
import { PODIUM_STATES, PodiumState } from '../schemas/podium.schema';

export class PodiumStateUpdateDto {
  @ApiProperty({ enum: PODIUM_STATES })
  @IsEnum(PODIUM_STATES)
  toState: PodiumState;

  @ApiPropertyOptional({
    description:
      'Note bắt buộc cho transitions: PODIUM_DRAFT → PODIUM_LOCKED, PUBLISHED → DISPUTE_OPEN.',
  })
  @IsOptional()
  @IsString()
  @MinLength(5)
  note?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  evidenceUrl?: string;
}

export class PodiumStateTransitionResponseDto {
  @ApiProperty() fromState: string;
  @ApiProperty({ enum: PODIUM_STATES }) toState: PodiumState;
  @ApiProperty() actorId: string;
  @ApiProperty() at: string;
  @ApiPropertyOptional() note?: string;
  @ApiPropertyOptional() evidenceUrl?: string;
}
