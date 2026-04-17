import { ApiProperty } from '@nestjs/swagger';
import { IsOptional, IsString, MinLength } from 'class-validator';

export class SignContractDto {
  @ApiProperty({ description: 'Must match registration.full_name (case/space-insensitive)' })
  @IsString()
  @MinLength(2)
  confirmed_name!: string;

  @ApiProperty({ required: false, description: 'Client IP, logged for audit' })
  @IsString()
  @IsOptional()
  ip?: string;
}

export class ContractViewDto {
  @ApiProperty({ description: 'Rendered HTML with placeholders filled in' })
  html_content!: string;

  @ApiProperty() already_signed!: boolean;

  @ApiProperty({ required: false, nullable: true })
  signed_at!: string | null;

  @ApiProperty({ required: false, nullable: true })
  pdf_url!: string | null;
}

export class SignContractResponseDto {
  @ApiProperty() success!: true;
  @ApiProperty() pdf_url!: string;
  @ApiProperty() signed_at!: string;
}

export class SendContractsDto {
  @ApiProperty({ default: false, required: false })
  dry_run?: boolean;
}

export class SendContractsResponseDto {
  @ApiProperty() queued!: number;
  @ApiProperty() already_sent!: number;
  @ApiProperty() skipped!: number;
}
