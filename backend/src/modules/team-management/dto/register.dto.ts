import { ApiProperty } from '@nestjs/swagger';
import {
  IsEmail,
  IsInt,
  IsMobilePhone,
  IsObject,
  IsString,
  MinLength,
} from 'class-validator';

export class RegisterDto {
  @ApiProperty() @IsInt() role_id!: number;

  @ApiProperty({ minLength: 2 })
  @IsString()
  @MinLength(2)
  full_name!: string;

  @ApiProperty() @IsEmail() email!: string;

  @ApiProperty({ example: '0901234567' })
  @IsMobilePhone('vi-VN')
  phone!: string;

  @ApiProperty({
    description: 'Dynamic fields matching role.form_fields',
    type: 'object',
    additionalProperties: true,
  })
  @IsObject()
  form_data!: Record<string, unknown>;
}
