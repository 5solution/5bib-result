import { ApiProperty } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsInt,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';
import { FormFieldConfigDto } from './form-field-config.dto';

export class CreateRoleDto {
  @ApiProperty() @IsString() role_name!: string;

  @ApiProperty({ required: false }) @IsString() @IsOptional() description?: string;

  @ApiProperty({ minimum: 1 }) @IsInt() @Min(1) max_slots!: number;

  @ApiProperty({ default: true }) @IsBoolean() waitlist_enabled: boolean = true;

  @ApiProperty({ default: 0, description: 'VND per day' })
  @IsInt()
  @Min(0)
  daily_rate: number = 0;

  @ApiProperty({ default: 1 }) @IsInt() @Min(1) working_days: number = 1;

  @ApiProperty({ type: [FormFieldConfigDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => FormFieldConfigDto)
  form_fields!: FormFieldConfigDto[];

  @ApiProperty({ required: false })
  @IsInt()
  @IsOptional()
  contract_template_id?: number;

  @ApiProperty({ default: 0 }) @IsInt() sort_order: number = 0;
}
