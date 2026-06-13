import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/**
 * FEATURE-083 — Response DTOs. Public DTO strips `_id`→`id`, merchantRef.tenantId,
 * internalName, draft (BR-83-20). Admin DTO returns the full draft working copy.
 */

export class RaceRefDto {
  @ApiProperty() raceId!: string;
  @ApiPropertyOptional({ nullable: true }) mysqlRaceId?: number | null;
  @ApiPropertyOptional() slug?: string;
}

export class LandingThemeDto {
  @ApiPropertyOptional() preset?: string;
  @ApiProperty() main!: string;
  @ApiProperty() sec!: string;
  @ApiProperty() fontHeading!: string;
  @ApiProperty() fontBody!: string;
  @ApiProperty() heroOverlay!: number;
}

export class LandingMetaDto {
  @ApiPropertyOptional() title?: string;
  @ApiPropertyOptional() description?: string;
  @ApiProperty() lang!: string;
  @ApiPropertyOptional() ogImage?: string;
  @ApiPropertyOptional() favicon?: string;
  @ApiProperty() robots!: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  analytics!: Record<string, unknown>;
}

export class LandingDomainDto {
  @ApiPropertyOptional() subdomain?: string;
  @ApiProperty() domainStatus!: string;
  @ApiProperty() sslStatus!: string;
}

export class LandingSectionDto {
  @ApiProperty() id!: string;
  @ApiProperty() type!: string;
  @ApiProperty() variant!: string;
  @ApiProperty() enabled!: boolean;
  @ApiProperty() order!: number;
  @ApiPropertyOptional() anchor?: string;
  @ApiProperty({ type: 'object', additionalProperties: true })
  data!: Record<string, unknown>;
}

export class LandingPublishDto {
  @ApiProperty() hasUnpublishedChanges!: boolean;
  @ApiProperty() version!: number;
  @ApiPropertyOptional({ nullable: true }) publishedAt?: Date | null;
}

/** Admin — full draft working copy. */
export class LandingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: RaceRefDto }) raceRef!: RaceRefDto;
  @ApiPropertyOptional() internalName?: string;
  @ApiProperty() status!: string;
  @ApiProperty({ type: LandingMetaDto }) meta!: LandingMetaDto;
  @ApiProperty({ type: LandingThemeDto }) theme!: LandingThemeDto;
  @ApiProperty({ type: LandingDomainDto }) domain!: LandingDomainDto;
  @ApiProperty({ type: [LandingSectionDto] }) sections!: LandingSectionDto[];
  @ApiProperty({ type: LandingPublishDto }) publish!: LandingPublishDto;
  @ApiProperty() createdAt!: Date;
  @ApiProperty() updatedAt!: Date;
}

/** Public — served from liveSnapshot only, private fields stripped. */
export class PublicLandingResponseDto {
  @ApiProperty() id!: string;
  @ApiProperty({ type: RaceRefDto }) raceRef!: RaceRefDto;
  @ApiProperty({ type: LandingMetaDto }) meta!: LandingMetaDto;
  @ApiProperty({ type: LandingThemeDto }) theme!: LandingThemeDto;
  @ApiProperty() subdomain?: string;
  @ApiProperty({ type: [LandingSectionDto] }) sections!: LandingSectionDto[];
}

export class LandingListItemDto {
  @ApiProperty() id!: string;
  @ApiPropertyOptional() raceTitle?: string;
  @ApiPropertyOptional() subdomain?: string;
  @ApiProperty() status!: string;
  @ApiProperty() enabledSectionCount!: number;
  @ApiProperty() updatedAt!: Date;
}

export class LandingListResponseDto {
  @ApiProperty({ type: [LandingListItemDto] }) data!: LandingListItemDto[];
  @ApiProperty() total!: number;
  @ApiProperty() pageNo!: number;
  @ApiProperty() pageSize!: number;
}

export class ResolveHostResponseDto {
  @ApiProperty() slug!: string;
}
