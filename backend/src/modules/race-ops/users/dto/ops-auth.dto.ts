import { ApiProperty } from '@nestjs/swagger';
import { IsEmail, IsString, MinLength } from 'class-validator';

export class OpsLoginDto {
  @ApiProperty({ example: 'leader.water@5bib.vn' })
  @IsEmail()
  email: string;

  @ApiProperty({ example: 'changeMe123!', minLength: 8 })
  @IsString()
  @MinLength(8)
  password: string;
}

export class OpsLoginResponseDto {
  @ApiProperty()
  access_token: string;

  @ApiProperty({ example: 'ops_leader' })
  role: string;

  @ApiProperty()
  user_id: string;

  @ApiProperty()
  event_id: string;

  @ApiProperty({ required: false, nullable: true })
  team_id?: string | null;

  @ApiProperty()
  full_name: string;
}

export class OpsMeResponseDto {
  @ApiProperty()
  user_id: string;

  @ApiProperty()
  role: string;

  @ApiProperty()
  event_id: string;

  @ApiProperty({ required: false, nullable: true })
  team_id?: string | null;

  @ApiProperty({ required: false })
  email?: string;

  @ApiProperty()
  phone: string;

  @ApiProperty()
  full_name: string;
}
