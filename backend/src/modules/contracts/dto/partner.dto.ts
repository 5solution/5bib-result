import { ApiProperty, ApiPropertyOptional, PartialType } from '@nestjs/swagger';
import { IsOptional, IsString } from 'class-validator';

export class CreatePartnerDto {
  @ApiProperty() @IsString() entityName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() shortName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() representative?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() position?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankAccount?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class UpdatePartnerDto extends PartialType(CreatePartnerDto) {}

export class PartnerResponseDto {
  @ApiProperty() id: string;
  @ApiProperty() entityName: string;
  @ApiPropertyOptional() shortName?: string;
  @ApiPropertyOptional() taxId?: string;
  @ApiPropertyOptional() address?: string;
  @ApiPropertyOptional() representative?: string;
  @ApiPropertyOptional() position?: string;
  @ApiPropertyOptional() bankAccount?: string;
  @ApiPropertyOptional() bankName?: string;
  @ApiPropertyOptional() phone?: string;
  @ApiPropertyOptional() email?: string;
  @ApiPropertyOptional() notes?: string;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}
