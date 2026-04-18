import { ApiProperty } from '@nestjs/swagger';
import {
  IsArray,
  IsBoolean,
  IsEnum,
  IsOptional,
  IsString,
} from 'class-validator';

export const FORM_FIELD_TYPES = [
  'text',
  'tel',
  'email',
  'select',
  'textarea',
  'date',
  'photo',
  'shirt_size',
] as const;
export type FormFieldType = (typeof FORM_FIELD_TYPES)[number];

export class FormFieldConfigDto {
  @ApiProperty() @IsString() key!: string;

  @ApiProperty() @IsString() label!: string;

  @ApiProperty({ enum: FORM_FIELD_TYPES })
  @IsEnum(FORM_FIELD_TYPES)
  type!: FormFieldType;

  @ApiProperty() @IsBoolean() required!: boolean;

  @ApiProperty({ required: false, type: [String] })
  @IsArray()
  @IsOptional()
  @IsString({ each: true })
  options?: string[];

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  hint?: string;

  @ApiProperty({ required: false })
  @IsString()
  @IsOptional()
  note?: string;
}
