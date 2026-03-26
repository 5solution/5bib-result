import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class LoginDto {
  @ApiProperty({ example: 'admin@5bib.vn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'Admin@5bib2026' })
  @IsString()
  @MinLength(6)
  password: string;
}
