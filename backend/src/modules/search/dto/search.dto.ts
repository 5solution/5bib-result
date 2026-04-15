import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsIn, IsOptional, IsString, Length } from 'class-validator';

export type SearchType = 'race' | 'bib';

export class SearchQueryDto {
  @ApiProperty({
    example: 'cao bang',
    description:
      'Query string — minimum 2 chars. For type=bib, must be digits only.',
  })
  @IsString()
  @Length(1, 64)
  q!: string;

  @ApiPropertyOptional({
    enum: ['race', 'bib'],
    description:
      'Explicit search type. If omitted, the server auto-detects (digits → bib, else race).',
  })
  @IsOptional()
  @IsIn(['race', 'bib'])
  type?: SearchType;
}

export class RaceSearchItemDto {
  @ApiProperty({ example: 'cao-bang-ultra-trail-2025' }) slug!: string;
  @ApiProperty({ example: 'Cao Bang Ultra Trail 2025' }) name!: string;
  @ApiProperty({ example: '2025-11-15T00:00:00.000Z' }) eventDate!: string;
  @ApiProperty({ enum: ['live', 'upcoming', 'ended'] })
  status!: 'live' | 'upcoming' | 'ended';
}

export class BibSearchItemDto {
  @ApiProperty({ example: 'cao-bang-ultra-trail-2025' }) raceSlug!: string;
  @ApiProperty({ example: 'Cao Bang Ultra Trail 2025' }) raceName!: string;
  @ApiProperty({ example: '2025-11-15T00:00:00.000Z' }) raceDate!: string;
  @ApiProperty({ example: '42KM' }) course!: string;
  @ApiProperty({ example: '1234' }) bib!: string;
  @ApiProperty({ example: 'Nguyễn Văn A' }) athleteName!: string;
}

export class SearchResultDto {
  @ApiProperty({ type: [RaceSearchItemDto] }) races!: RaceSearchItemDto[];
  @ApiProperty({ type: [BibSearchItemDto] }) bibs!: BibSearchItemDto[];
}

export class SearchResponseDto {
  @ApiProperty({ type: SearchResultDto }) data!: SearchResultDto;
  @ApiProperty({ example: true }) success!: boolean;
}
