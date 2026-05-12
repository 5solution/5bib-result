import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { Type } from 'class-transformer';
import {
  IsArray,
  IsBoolean,
  IsDateString,
  IsEnum,
  IsIn,
  IsMongoId,
  IsNumber,
  IsOptional,
  IsString,
  Max,
  Min,
  ValidateNested,
} from 'class-validator';

const CONTRACT_TYPES = ['TICKET_SALES', 'TIMING', 'RACEKIT', 'OPERATIONS'];
const DOCUMENT_TYPES = ['QUOTATION', 'CONTRACT'];
const PROVIDERS = ['5BIB', '5SOLUTION'];

export class LineItemInputDto {
  @ApiProperty() @IsNumber() stt: number;
  @ApiProperty() @IsString() description: string;
  @ApiPropertyOptional() @IsOptional() @IsString() unit?: string;
  @ApiProperty() @IsNumber() @Min(0) quantity: number;
  @ApiProperty() @IsNumber() @Min(0) unitPrice: number;
  @ApiPropertyOptional({ minimum: 0, maximum: 100 })
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  discount?: number;
  @ApiPropertyOptional() @IsOptional() @IsBoolean() selected?: boolean;
  @ApiPropertyOptional() @IsOptional() @IsString() note?: string;
  /**
   * F-028 Phase 3 — reference `ServiceCatalog._id` khi line item pick
   * từ catalog picker. Optional + Mongo ObjectId format (validate strict).
   * Server lưu thẳng vào snapshot LineItem để cost-suggestions endpoint
   * lookup catalog → tính `referenceCost × quantity` cho P&L.
   */
  @ApiPropertyOptional({ description: 'ServiceCatalog._id reference' })
  @IsOptional()
  @IsMongoId()
  catalogItemId?: string;
}

export class RevenueShareInputDto {
  @ApiProperty({ minimum: 0, maximum: 100 })
  @IsNumber()
  @Min(0)
  @Max(100)
  feePercentage: number;
  @ApiProperty() @IsNumber() @Min(0) feePerAthlete: number;
  @ApiProperty() @IsNumber() @Min(0) estimatedAthletes: number;
  // M-03 QC fix: optional override avg ticket price (admin may set explicit)
  // Server falls back to DEFAULT_AVG_TICKET_PRICE if omitted/zero.
  @ApiPropertyOptional({ description: 'Average ticket price in VND (default 200,000)' })
  @IsOptional()
  @IsNumber()
  @Min(0)
  avgTicketPrice?: number;
}

export class ClientInfoInputDto {
  @ApiProperty() @IsString() entityName: string;
  @ApiPropertyOptional() @IsOptional() @IsString() taxId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() address?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() representative?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() position?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankAccount?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() bankName?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() phone?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() email?: string;
}

export class PaymentTermsInputDto {
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  @Max(100)
  advancePercentage?: number;
  @ApiPropertyOptional() @IsOptional() @IsNumber() @Min(0) latePenaltyRate?: number;
  @ApiPropertyOptional({ enum: ['PER_DAY', 'PER_YEAR'] })
  @IsOptional()
  @IsIn(['PER_DAY', 'PER_YEAR'])
  latePenaltyUnit?: string;
  @ApiPropertyOptional()
  @IsOptional()
  @IsNumber()
  @Min(0)
  paymentDeadlineDays?: number;
}

export class CreateContractDto {
  @ApiProperty({ enum: CONTRACT_TYPES })
  @IsIn(CONTRACT_TYPES)
  contractType: string;

  @ApiPropertyOptional({ enum: DOCUMENT_TYPES, default: 'CONTRACT' })
  @IsOptional()
  @IsIn(DOCUMENT_TYPES)
  documentType?: string;

  @ApiPropertyOptional({ enum: PROVIDERS })
  @IsOptional()
  @IsIn(PROVIDERS)
  providerId?: string;

  @ApiPropertyOptional() @IsOptional() @IsString() partnerId?: string;

  @ApiProperty({ type: ClientInfoInputDto })
  @ValidateNested()
  @Type(() => ClientInfoInputDto)
  client: ClientInfoInputDto;

  @ApiPropertyOptional() @IsOptional() @IsString() raceId?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() raceName?: string;
  /**
   * F-024 race manual input — raceDate là free-format string.
   * Chấp nhận cả ISO date ("2026-06-15") khi pick race từ DB, lẫn free-format
   * ("06:00 ngày 15/06/2026 đến 12:00 ngày 16/06/2026") khi admin nhập thủ công.
   * KHÔNG dùng @IsDateString() — block trường hợp race nhiều ngày (Danny chốt B).
   */
  @ApiPropertyOptional() @IsOptional() @IsString() raceDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsString() raceLocation?: string;

  @ApiPropertyOptional() @IsOptional() @IsDateString() signDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() effectiveDate?: string;
  @ApiPropertyOptional() @IsOptional() @IsDateString() endDate?: string;

  @ApiPropertyOptional({ type: [LineItemInputDto] })
  @IsOptional()
  @IsArray()
  @ValidateNested({ each: true })
  @Type(() => LineItemInputDto)
  lineItems?: LineItemInputDto[];

  @ApiPropertyOptional({ type: RevenueShareInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => RevenueShareInputDto)
  revenueShare?: RevenueShareInputDto;

  @ApiPropertyOptional({ enum: [0, 8, 10] })
  @IsOptional()
  @IsIn([0, 8, 10])
  vatRate?: number;

  @ApiPropertyOptional({ type: PaymentTermsInputDto })
  @IsOptional()
  @ValidateNested()
  @Type(() => PaymentTermsInputDto)
  paymentTerms?: PaymentTermsInputDto;

  @ApiPropertyOptional({ type: Object })
  @IsOptional()
  templateOverrides?: Record<string, string>;
}
