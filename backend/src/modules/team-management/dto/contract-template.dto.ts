import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsOptional,
  IsString,
  MinLength,
} from 'class-validator';

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
}

export class ImportDocxResponseDto {
  @ApiProperty({ description: 'HTML converted from uploaded DOCX' })
  content_html!: string;

  @ApiProperty({ type: [String], description: 'Warnings raised during conversion' })
  warnings!: string[];
}
