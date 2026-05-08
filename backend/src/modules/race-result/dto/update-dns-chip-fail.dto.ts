import { ApiProperty } from '@nestjs/swagger';
import { IsBoolean } from 'class-validator';

/**
 * F-010 BR-FC-07 — PATCH body cho `/api/race-results/:id/dns-chip-fail`.
 *
 * Admin manual flag để mark 1 athlete là DNS_CHIP_FAIL sub-state. Default false.
 * UI: race-results admin table inline action button trên DNS rows.
 */
export class UpdateDnsChipFailDto {
  @ApiProperty({
    description:
      'F-010 — Mark athlete as DNS_CHIP_FAIL (true) hoặc revert (false). Admin override only.',
  })
  @IsBoolean()
  dnsChipFail!: boolean;
}

export class UpdateDnsChipFailResponseDto {
  @ApiProperty()
  success!: boolean;

  @ApiProperty()
  dnsChipFail!: boolean;
}
