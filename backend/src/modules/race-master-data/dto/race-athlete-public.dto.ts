import { ApiProperty } from '@nestjs/swagger';

/**
 * PUBLIC view — KHÔNG có PII (email/phone/cccd).
 * Dùng cho chip-verify kiosk, checkpoint OCR match, leaderboard.
 *
 * Type system enforce — RaceAthleteLookupService.lookupByBib() returns this DTO.
 */
export class RaceAthletePublicDto {
  @ApiProperty()
  mysql_race_id!: number;

  @ApiProperty()
  athletes_id!: number;

  @ApiProperty({ type: String, nullable: true })
  bib_number!: string | null;

  /** bib_name fallback full_name. Backward compat alias. */
  @ApiProperty({ type: String, nullable: true })
  display_name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  bib_name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  full_name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  gender!: string | null;

  @ApiProperty({ type: Number, nullable: true })
  course_id!: number | null;

  @ApiProperty({ type: String, nullable: true })
  course_name!: string | null;

  @ApiProperty({ type: String, nullable: true })
  course_distance!: string | null;

  @ApiProperty({ type: String, nullable: true })
  club!: string | null;

  @ApiProperty({
    type: String,
    nullable: true,
    description:
      'Vật phẩm BTC giao kèm racekit (VD: "Mũ"). Free-form, display-only.',
  })
  items!: string | null;

  @ApiProperty({ type: String, nullable: true })
  last_status!: string | null;

  @ApiProperty()
  racekit_received!: boolean;

  @ApiProperty({ type: Date, nullable: true })
  racekit_received_at!: Date | null;
}
