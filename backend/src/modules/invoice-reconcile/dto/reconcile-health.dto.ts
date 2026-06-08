import { ApiProperty } from '@nestjs/swagger';
import { Layer2Status } from './reconcile-report.dto';

/**
 * F-076 PRD 3.3 — health endpoint response. MUST mask sensitive fields per
 * TC-30 (token, password, full chat_id, full email addresses).
 */
export class ReconcileHealthDto {
  @ApiProperty({
    description: 'Lần cron tick scan cuối (ISO 8601 UTC)',
    example: '2026-06-09T07:00:00.000Z',
    required: false,
    nullable: true,
  })
  lastScanTickAt!: string | null;

  @ApiProperty({
    description: 'Race IDs enabled (từ env INVOICE_RECONCILE_ENABLED_RACES)',
    example: [140, 220],
  })
  enabledRaceIds!: number[];

  @ApiProperty({
    description: 'MISA token expires at (ISO 8601 UTC)',
    example: '2026-06-23T07:00:00.000Z',
    required: false,
    nullable: true,
  })
  misaTokenExpiresAt!: string | null;

  @ApiProperty({
    description: 'Last MISA API call status',
    enum: ['OK', 'DEGRADED', 'UNAVAILABLE'],
    example: 'OK',
    required: false,
    nullable: true,
  })
  lastMisaStatus!: Layer2Status | null;

  @ApiProperty({
    description: 'MISA credentials configured (username/password set)',
    example: true,
  })
  misaConfigured!: boolean;

  @ApiProperty({
    description: 'Telegram bot RIÊNG F-076 configured (BR-14a)',
    example: true,
  })
  telegramConfigured!: boolean;

  @ApiProperty({
    description: 'Telegram chat_id masked (last 4 chars visible)',
    example: '-100***7167',
    required: false,
    nullable: true,
  })
  telegramChatIdMasked?: string | null;

  @ApiProperty({
    description: 'Email alert recipients (masked: 2 chars + ***)',
    example: ['da***@5bib.com', 'ke***@5bib.com'],
  })
  emailRecipientsMasked!: string[];

  @ApiProperty({
    description: 'Thresholds (BR-08)',
    example: { warnHours: 12, criticalHours: 20, breachedHours: 24 },
  })
  thresholds!: {
    warnHours: number;
    criticalHours: number;
    breachedHours: number;
  };
}
