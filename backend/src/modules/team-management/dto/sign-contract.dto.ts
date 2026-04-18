import { ApiProperty } from '@nestjs/swagger';
import {
  IsBoolean,
  IsOptional,
  IsString,
  Matches,
  MinLength,
} from 'class-validator';

export class SignContractDto {
  @ApiProperty({ description: 'Must match registration.full_name (case/space-insensitive)' })
  @IsString()
  @MinLength(2)
  confirmed_name!: string;

  @ApiProperty({
    description:
      'Handwritten signature as PNG data URL (base64). Max 500KB decoded.',
  })
  @IsString()
  @Matches(/^data:image\/png;base64,[A-Za-z0-9+/=]+$/, {
    message: 'signature_image must be a base64 PNG data URL',
  })
  signature_image!: string;

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

  @ApiProperty({
    description:
      'Full name on the registration. Returned so the crew sign form can do a client-side match check before submit.',
  })
  full_name!: string;
}

export class SignContractResponseDto {
  @ApiProperty() success!: true;
  @ApiProperty() pdf_url!: string;
  @ApiProperty() signed_at!: string;
}

export class SendContractsDto {
  @ApiProperty({ default: false, required: false })
  @IsBoolean()
  @IsOptional()
  dry_run?: boolean;
}

export class SendContractsResponseDto {
  @ApiProperty() queued!: number;
  @ApiProperty() already_sent!: number;
  @ApiProperty() skipped!: number;
}
