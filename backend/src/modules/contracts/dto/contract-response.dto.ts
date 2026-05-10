import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class ContractResponseDto {
  @ApiProperty() id: string;
  @ApiPropertyOptional() contractNumber?: string;
  @ApiProperty() contractType: string;
  @ApiProperty() documentType: string;
  @ApiProperty() status: string;
  @ApiProperty() providerId: string;
  @ApiProperty({ type: Object }) provider: any;
  @ApiPropertyOptional() partnerId?: string;
  @ApiProperty({ type: Object }) client: any;
  @ApiPropertyOptional() raceId?: string;
  @ApiPropertyOptional() raceName?: string;
  @ApiPropertyOptional() raceDate?: Date;
  @ApiPropertyOptional() raceLocation?: string;
  @ApiPropertyOptional() signDate?: Date;
  @ApiPropertyOptional() effectiveDate?: Date;
  @ApiPropertyOptional() endDate?: Date;
  @ApiProperty({ type: [Object] }) lineItems: any[];
  @ApiPropertyOptional({ type: Object }) revenueShare?: any;
  @ApiProperty() subtotal: number;
  @ApiProperty() vatRate: number;
  @ApiProperty() vatAmount: number;
  @ApiProperty() totalAmount: number;
  @ApiProperty({ type: Object }) paymentTerms: any;
  @ApiPropertyOptional({ type: Object }) templateOverrides?: any;
  @ApiPropertyOptional({ type: [Object] }) generatedDocuments?: any[];
  @ApiPropertyOptional({ type: Object }) acceptanceReport?: any;
  @ApiPropertyOptional({ type: Object }) paymentRequest?: any;
  @ApiProperty() createdAt: Date;
  @ApiProperty() updatedAt: Date;
}

export class PaginatedContractsDto {
  @ApiProperty({ type: [ContractResponseDto] }) items: ContractResponseDto[];
  @ApiProperty() total: number;
  @ApiProperty() page: number;
  @ApiProperty() limit: number;
  @ApiProperty() totalPages: number;
}
