import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  Min,
  MinLength,
} from 'class-validator';

export class CreateAcceptanceTemplateDto {
  @ApiProperty()
  @IsString()
  @MinLength(1)
  @MaxLength(255)
  template_name!: string;

  @ApiProperty({ description: 'HTML body with {{placeholders}}' })
  @IsString()
  @MinLength(10)
  @MaxLength(500_000)
  content_html!: string;

  @ApiProperty({
    description: 'Whitelist of placeholder keys used in content_html',
    type: [String],
  })
  @IsArray()
  @IsString({ each: true })
  variables!: string[];

  @ApiProperty({
    required: false,
    description:
      'Event ID this template is scoped to. Omit/null for a global default template.',
  })
  @IsInt()
  @Min(1)
  @IsOptional()
  event_id?: number | null;

  @ApiProperty({ default: true, required: false })
  @IsBoolean()
  @IsOptional()
  is_active?: boolean = true;
}

export class UpdateAcceptanceTemplateDto {
  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MinLength(1)
  @MaxLength(255)
  template_name?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  @MinLength(10)
  @MaxLength(500_000)
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

export class AcceptanceTemplateDto {
  @ApiProperty() id!: number;
  @ApiProperty({ nullable: true }) event_id!: number | null;
  @ApiProperty() template_name!: string;
  @ApiProperty() content_html!: string;
  @ApiProperty({ type: [String] }) variables!: string[];
  @ApiProperty() is_default!: boolean;
  @ApiProperty() is_active!: boolean;
  @ApiProperty() created_by!: string;
  @ApiProperty() created_at!: string;
  @ApiProperty() updated_at!: string;
}
