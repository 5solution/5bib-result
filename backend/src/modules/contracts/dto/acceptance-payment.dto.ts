import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsDateString,
  IsIn,
  IsNumber,
  IsOptional,
  IsString,
  Min,
  ValidateNested,
} from 'class-validator';

export class ActualLineItemInputDto {
  @ApiProperty() @IsNumber() stt: number;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiProperty() @IsNumber() @Min(0) quantity: number;
  @ApiProperty() @IsNumber() @Min(0) unitPrice: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) amount?: number;
}

export class CreateAcceptanceReportDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() reportDate?: string;

  @ApiProperty({ type: [ActualLineItemInputDto] })
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => ActualLineItemInputDto)
  actualValues: ActualLineItemInputDto[];

  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) advancePaid?: number;

  @ApiPropertyOptional({
    enum: ['ACCEPTED', 'ACCEPTED_WITH_NOTES', 'REJECTED'],
  })
  @IsOptional()
  @IsIn(['ACCEPTED', 'ACCEPTED_WITH_NOTES', 'REJECTED'])
  verdict?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class CreatePaymentRequestDto {
  @ApiPropertyOptional() @IsOptional() @IsDateString() requestDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() notes?: string;
}

export class GenerateDocumentDto {
  @ApiProperty({
    enum: ['CONTRACT', 'QUOTATION', 'ACCEPTANCE_REPORT', 'PAYMENT_REQUEST'],
  })
  @IsIn(['CONTRACT', 'QUOTATION', 'ACCEPTANCE_REPORT', 'PAYMENT_REQUEST'])
  docType: string;

  @ApiPropertyOptional({ enum: ['DOCX', 'PDF', 'BOTH'], default: 'BOTH' })
  @IsOptional()
  @IsIn(['DOCX', 'PDF', 'BOTH'])
  format?: string;
}
