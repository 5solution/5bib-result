import { ApiProperty } from '@nestjs/swagger';

/**
 * F-010 BR-FC-05/06/07 — DNS sub-state breakdown for dashboard summary cards.
 *
 * Derivation logic (computed at query time, NOT persisted):
 * - DNS_CHIP_FAIL  → race_results.dnsChipFail === true
 * - DNS_NOT_PICKED → racekitPickedUp === false AND no Start time AND !dnsChipFail
 * - DNS_NO_START   → has racekit OR racekitPickedUp unset, no Start time, !dnsChipFail
 *
 * Total = sum of three sub-states. May not equal `summary.dns` if dnsChipFail
 * applied to athletes with Start time (admin override edge case BR-FC-07 / UP-11).
 */
export class DnsBreakdownDto {
  @ApiProperty({
    description: 'Tổng DNS = notPicked + noStart + chipFail (sum of sub-states)',
  })
  total!: number;

  @ApiProperty({
    description:
      'F-010 BR-FC-05 — Athletes có racekitPickedUp=false AND no Start time. Indicator: chưa nhận racekit / no-show.',
  })
  notPicked!: number;

  @ApiProperty({
    description:
      'F-010 BR-FC-05 — Athletes có racekit (or unflagged) AND no Start time AND !dnsChipFail. Indicator: đã nhận BIB nhưng không xuất phát.',
  })
  noStart!: number;

  @ApiProperty({
    description:
      'F-010 BR-FC-05/07 — Athletes có dnsChipFail=true admin flag. Indicator: vendor chip fail/timing equipment issue.',
  })
  chipFail!: number;
}
