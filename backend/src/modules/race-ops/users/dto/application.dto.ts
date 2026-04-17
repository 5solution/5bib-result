import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsDateString,
  IsEmail,
  IsEnum,
  IsIn,
  IsMongoId,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
  ValidateNested,
} from 'class-validator';
import { Type } from 'class-transformer';

/* ───── Sub DTO ───── */

export class EmergencyContactDto {
  @ApiProperty({ example: 'Nguyễn Văn A' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  name: string;

  @ApiProperty({ example: '0912345678' })
  @IsString()
  @MinLength(9)
  @MaxLength(15)
  phone: string;
}

/* ───── Public: TNV apply ───── */

export class PublicApplyDto {
  @ApiProperty({ example: '0987654321' })
  @IsString()
  @MinLength(9)
  @MaxLength(15)
  phone: string;

  @ApiProperty({ example: 'Trần Thị B' })
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  full_name: string;

  @ApiPropertyOptional({ example: 'tnv.b@gmail.com' })
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '2000-05-15' })
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional({
    description: 'Preferred team ID (nếu form cho chọn)',
  })
  @IsOptional()
  @IsMongoId()
  preferred_team_id?: string;

  @ApiPropertyOptional({ type: EmergencyContactDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergency_contact?: EmergencyContactDto;

  @ApiPropertyOptional({ example: 'Đã tham gia HHTT2025, team nước' })
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  experience?: string;

  @ApiPropertyOptional({ example: 'Ca sáng 4h-8h' })
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shift_preferences?: string;
}

/* ───── Admin: create crew/leader trực tiếp ───── */

export class AdminCreateUserDto extends PublicApplyDto {
  @ApiProperty({
    enum: ['ops_leader', 'ops_crew', 'ops_tnv'],
    description: 'ops_admin tự gán role (trừ ops_admin — dùng seed script)',
  })
  @IsEnum(['ops_leader', 'ops_crew', 'ops_tnv'])
  role: 'ops_leader' | 'ops_crew' | 'ops_tnv';

  @ApiPropertyOptional({ description: 'Gán vào team (bắt buộc cho crew/tnv)' })
  @IsOptional()
  @IsMongoId()
  team_id?: string;

  @ApiPropertyOptional({
    description: 'Password cho leader (bắt buộc nếu role = ops_leader)',
    minLength: 8,
  })
  @IsOptional()
  @IsString()
  @MinLength(8)
  password?: string;
}

/* ───── Admin: approve/reject ───── */

export class ApproveApplicationDto {
  @ApiPropertyOptional({
    description: 'Optional — gán team cho user lúc duyệt (nếu chưa có)',
    example: '507f1f77bcf86cd799439011',
  })
  @IsOptional()
  @IsMongoId()
  team_id?: string;
}

export class RejectApplicationDto {
  @ApiProperty({ example: 'Thông tin liên lạc không hợp lệ' })
  @IsString()
  @MinLength(2)
  @MaxLength(500)
  reason: string;
}

export class ApplicationListQueryDto {
  @ApiPropertyOptional({
    enum: ['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE'],
  })
  @IsOptional()
  @IsIn(['PENDING', 'APPROVED', 'REJECTED', 'ACTIVE'])
  status?: string;

  @ApiPropertyOptional({ description: 'Filter theo team' })
  @IsOptional()
  @IsMongoId()
  team_id?: string;

  @ApiPropertyOptional({
    enum: ['ops_tnv', 'ops_crew', 'ops_leader'],
  })
  @IsOptional()
  @IsIn(['ops_tnv', 'ops_crew', 'ops_leader'])
  role?: string;
}

/* ───── Response DTOs ───── */

export class UserResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() phone: string;
  @ApiPropertyOptional() email?: string;
  @ApiProperty() full_name: string;
  @ApiPropertyOptional() dob?: Date;
  @ApiProperty() role: string;
  @ApiProperty() event_id: string;
  @ApiProperty({ nullable: true, type: String }) team_id: string | null;
  @ApiPropertyOptional() emergency_contact?: { name: string; phone: string };
  @ApiPropertyOptional() experience?: string;
  @ApiPropertyOptional() shift_preferences?: string;
  @ApiProperty() status: string;
  @ApiPropertyOptional() rejected_reason?: string;
  @ApiProperty({ nullable: true, type: String }) approved_by: string | null;
  @ApiPropertyOptional() approved_at?: Date;
  @ApiProperty() created_at: Date;
  @ApiProperty() updated_at: Date;
}

export class UserListResponseDto {
  @ApiProperty({ type: [UserResponseDto] })
  items: UserResponseDto[];

  @ApiProperty()
  total: number;
}

export class PublicApplyResponseDto {
  @ApiProperty({ example: 'ok' }) status: 'ok';
  @ApiProperty() user_id: string;
  @ApiProperty({ example: 'PENDING' }) application_status: string;
}

/* ───── Admin: update user (reassign team, edit profile) ───── */

export class AdminUpdateUserDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MinLength(2)
  @MaxLength(100)
  full_name?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsEmail()
  email?: string;

  @ApiPropertyOptional({ example: '0987654321' })
  @IsOptional()
  @IsString()
  @MinLength(9)
  @MaxLength(15)
  phone?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsDateString()
  dob?: string;

  @ApiPropertyOptional({
    description: 'Gán lại team (null = gỡ khỏi team, nhưng chỉ cho crew/tnv).',
    nullable: true,
  })
  @IsOptional()
  team_id?: string | null;

  @ApiPropertyOptional()
  @IsOptional()
  @ValidateNested()
  @Type(() => EmergencyContactDto)
  emergency_contact?: EmergencyContactDto;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(1000)
  experience?: string;

  @ApiPropertyOptional()
  @IsOptional()
  @IsString()
  @MaxLength(500)
  shift_preferences?: string;
}

/* ───── QR badge ───── */

export class UserQrBadgeResponseDto {
  @ApiProperty() user_id: string;
  @ApiProperty() full_name: string;
  @ApiProperty() phone: string;
  @ApiProperty() role: string;
  @ApiProperty({ description: 'QR plain token — render thành QR code phía client' })
  qr_token: string;
  @ApiProperty({ nullable: true, type: String }) team_name: string | null;
}
