import { ApiProperty } from '@nestjs/swagger';
import { RaceAthletePublicDto } from './race-athlete-public.dto';

/**
 * ADMIN view — bao gồm PII. Chỉ trả qua admin endpoint với LogtoAdminGuard
 * hoặc DI service `lookupByBibAdmin()` (chip-verify v1.3 KHÔNG dùng method này).
 */
export class RaceAthleteAdminDto extends RaceAthletePublicDto {
  @ApiProperty({ type: String, nullable: true })
  email!: string | null;

  @ApiProperty({ type: String, nullable: true })
  contact_phone!: string | null;

  @ApiProperty({ type: String, nullable: true })
  id_number!: string | null;

  @ApiProperty()
  source!: string;

  @ApiProperty({ type: Date, nullable: true })
  legacy_modified_on!: Date | null;

  @ApiProperty()
  synced_at!: Date;

  @ApiProperty()
  sync_version!: number;
}
