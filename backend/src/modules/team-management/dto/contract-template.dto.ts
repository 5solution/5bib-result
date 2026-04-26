import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

const PARTY_A_PROPS = {
  party_a_company_name: { description: 'Tên công ty Bên A', maxLength: 200 },
  party_a_address:      { description: 'Địa chỉ Bên A',     maxLength: 500 },
  party_a_tax_code:     { description: 'Mã số thuế Bên A',   maxLength: 20  },
  party_a_representative: { description: 'Người đại diện Bên A', maxLength: 100 },
  party_a_position:     { description: 'Chức vụ người đại diện Bên A', maxLength: 100 },
} as const;

export class CreateContractTemplateDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  template_name!: string;

  @ApiProperty({ description: 'HTML with {{placeholders}}' })
  @IsString()
  @MinLength(10)
  content_html!: string;

  @ApiProperty({
    description: 'List of placeholder keys that must be resolved when rendering',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  variables!: string[];

  @ApiProperty({ default: true })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_company_name.description, required: false })
  @IsString() @IsOptional() @MaxLength(200)
  party_a_company_name?: string | null;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_address.description, required: false })
  @IsString() @IsOptional() @MaxLength(500)
  party_a_address?: string | null;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_tax_code.description, required: false })
  @IsString() @IsOptional() @MaxLength(20)
  party_a_tax_code?: string | null;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_representative.description, required: false })
  @IsString() @IsOptional() @MaxLength(100)
  party_a_representative?: string | null;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_position.description, required: false })
  @IsString() @IsOptional() @MaxLength(100)
  party_a_position?: string | null;
}

export class UpdateContractTemplateDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MinLength(1)
  template_name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MinLength(10)
  content_html?: string;

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsString({ each: true })
  @IsOptional()
  variables?: string[];

  @ApiProperty({ required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_company_name.description, required: false })
  @IsString() @IsOptional() @MaxLength(200)
  party_a_company_name?: string | null;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_address.description, required: false })
  @IsString() @IsOptional() @MaxLength(500)
  party_a_address?: string | null;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_tax_code.description, required: false })
  @IsString() @IsOptional() @MaxLength(20)
  party_a_tax_code?: string | null;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_representative.description, required: false })
  @IsString() @IsOptional() @MaxLength(100)
  party_a_representative?: string | null;

  @ApiProperty({ description: PARTY_A_PROPS.party_a_position.description, required: false })
  @IsString() @IsOptional() @MaxLength(100)
  party_a_position?: string | null;
}

export class ImportDocxResponseDto {
  @ApiProperty({ description: 'HTML converted from uploaded DOCX' })
  content_html!: string;

  @ApiProperty({ type: [String], description: 'Warnings raised during conversion' })
  warnings!: string[];
}

export class ValidateTemplateDto {
  @ApiProperty({ description: 'HTML body with {{placeholders}} to validate' })
  @IsString()
  content_html!: string;
}

export class ValidateTemplateResponseDto {
  @ApiProperty({ description: 'True when all {{vars}} are in the canonical list' })
  valid!: boolean;

  @ApiProperty({
    description: 'Variables found in the template that are not in VALID_VARIABLES',
    type: [String],
  })
  unknownVars!: string[];
}
