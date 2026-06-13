import { ApiProperty } from '@nestjs/swagger';
import { IsMongoId } from 'class-validator';

/**
 * FEATURE-083 — BR-83-01/03. Create a landing from an existing race. Server
 * derives raceRef (title/slug/mysqlRaceId/brandColor/bannerUrl) + merchantRef
 * + seeds default sections from race data.
 */
export class CreateLandingDto {
  @ApiProperty({ description: 'MongoDB races._id của giải' })
  @IsMongoId({ message: 'raceId không hợp lệ' })
  raceId!: string;
}
