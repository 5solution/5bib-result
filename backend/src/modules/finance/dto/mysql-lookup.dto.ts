import { ApiProperty } from '@nestjs/swagger';

/**
 * F-028 — MySQL platform Tenant lookup result.
 * Trả lên admin picker để link Contract TICKET_SALES → tenants.id.
 */
export class TenantSearchResultDto {
  @ApiProperty({ description: 'tenants.id (BIGINT)', example: 12 })
  id: number;

  @ApiProperty({ description: 'tenant.name', example: '5BIB Sport Co.' })
  name: string;

  @ApiProperty({
    description: 'tax code (col `vat`)',
    example: '0123456789',
    nullable: true,
  })
  taxId: string | null;
}

/**
 * F-028 — MySQL platform Race lookup result (per tenant).
 */
export class RaceSearchResultDto {
  @ApiProperty({ description: 'races.race_id (BIGINT)', example: 148 })
  raceId: number;

  @ApiProperty({ description: 'races.title', example: 'Vietnam Trail 2026' })
  title: string;

  @ApiProperty({
    description: 'races.created_on',
    example: '2026-03-15T00:00:00Z',
    nullable: true,
  })
  createdOn: string | null;
}
