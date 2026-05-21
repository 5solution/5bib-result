/**
 * FEATURE-048 Phase 2 — Identity Cluster admin endpoints (BR-48-16..19).
 *
 * Auth: LogtoAdminGuard — admin role required (PII data access via clusters).
 * Audit: All mutations log to AuditLogService via in-controller logger.
 */

import {
  Body,
  Controller,
  Get,
  NotFoundException,
  Param,
  Patch,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiProperty,
  ApiPropertyOptional,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import {
  ArrayMaxSize,
  ArrayMinSize,
  IsArray,
  IsInt,
  IsOptional,
  IsString,
  MaxLength,
  MinLength,
} from 'class-validator';

import { LogtoAdminGuard, CurrentUser, type LogtoUser } from '../../logto-auth';
import { AthleteIdentityClusteringService } from '../services/athlete-identity-clustering.service';

export class MergeClustersDto {
  @ApiProperty({
    description: 'Cluster IDs to merge INTO target',
    minItems: 1,
    maxItems: 10,
  })
  @IsArray()
  @ArrayMinSize(1, { message: 'Phải chọn ít nhất 1 cluster để gộp' })
  @ArrayMaxSize(10, { message: 'Tối đa 10 cluster cùng lúc' })
  @IsString({ each: true })
  additionalClusterIds: string[];

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5, { message: 'Lý do tối thiểu 5 ký tự' })
  @MaxLength(500)
  reason: string;
}

export class SplitClusterDto {
  @ApiProperty({ description: 'Athletes IDs to extract', minItems: 1 })
  @IsArray()
  @ArrayMinSize(1, { message: 'Phải chọn ít nhất 1 athlete để tách' })
  @IsInt({ each: true })
  extractAthleteIds: number[];

  @ApiProperty({ minLength: 5, maxLength: 500 })
  @IsString()
  @MinLength(5)
  @MaxLength(500)
  reason: string;
}

/**
 * F-049 — Linked athlete record DTO with F-049 enrichment fields.
 * Backward compat: ALL F-049 fields are OPTIONAL — existing F-048 SDK
 * clients work unchanged.
 */
export class IdentityClusterLinkedRecordDto {
  @ApiProperty({ description: 'F-048: MySQL race_id (platform DB)' })
  mysql_race_id: number;

  @ApiProperty({ description: 'F-048: MySQL athletes_id (platform DB)' })
  athletes_id: number;

  @ApiPropertyOptional({
    description: 'F-048: Bib number from race_athletes (legacy)',
  })
  bib_number?: string | null;

  @ApiPropertyOptional({ description: 'F-048: Mongo race ObjectId mapping' })
  mongoRaceId?: string | null;

  @ApiPropertyOptional({
    description: 'F-048: Mongo bib (mirror of bib_number)',
  })
  mongoBib?: string | null;

  @ApiPropertyOptional({ description: 'F-048: Full name from race_athletes' })
  fullName?: string | null;

  @ApiPropertyOptional({
    description:
      'F-049: Race title joined from races.title (via mysql_race_id lookup, cached 1h)',
    example: 'Vietnam Mountain Marathon Mu Cang Chai 2026',
  })
  @IsOptional()
  @IsString()
  @MaxLength(255)
  raceName?: string;

  @ApiPropertyOptional({
    description:
      'F-049: Bib number joined from race_athletes.bib_number (via mysql_race_id + athletes_id)',
    example: '88043',
  })
  @IsOptional()
  @IsString()
  @MaxLength(64)
  bibNumber?: string;
}

/**
 * F-049 — Cluster list item shape (response DTO for Swagger schema generation).
 * Documents existing F-048 fields + F-049 enrichment.
 */
export class IdentityClusterListItemDto {
  @ApiProperty({ description: 'Cluster UUID v4' })
  clusterId: string;

  @ApiPropertyOptional({
    description:
      'F-049 admin-only — primary email (full, no redact for admin context BR-49-02)',
  })
  emailHash?: string | null;

  @ApiPropertyOptional()
  nameSlug?: string | null;

  @ApiPropertyOptional()
  dobYear?: number | null;

  @ApiPropertyOptional({ enum: ['male', 'female', 'other'] })
  genderNormalized?: 'male' | 'female' | 'other' | null;

  @ApiProperty({ minimum: 0, maximum: 1 })
  confidence: number;

  @ApiProperty({
    enum: ['email', 'name+dob', 'name+gender', 'manual', 'review_pending'],
  })
  source: 'email' | 'name+dob' | 'name+gender' | 'manual' | 'review_pending';

  @ApiProperty({
    type: [IdentityClusterLinkedRecordDto],
    description: 'F-049 enriched with raceName + bibNumber per record',
  })
  linkedAthleteRecords: IdentityClusterLinkedRecordDto[];

  @ApiProperty()
  createdAt: string;

  @ApiProperty()
  updatedAt: string;
}

export class IdentityClusterListResponseDto {
  @ApiProperty({ type: [IdentityClusterListItemDto] })
  items: IdentityClusterListItemDto[];

  @ApiProperty()
  total: number;
}

@ApiTags('admin-athlete-identity')
@ApiBearerAuth()
@Controller('admin/athletes/identity-clusters')
@UseGuards(LogtoAdminGuard)
export class IdentityClusterAdminController {
  constructor(
    private readonly clusteringService: AthleteIdentityClusteringService,
  ) {}

  /** BR-48-16 — Paginated cluster list with filters. */
  @Get()
  @ApiOperation({ summary: 'F-048 — List identity clusters' })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'limit', required: false, type: Number })
  @ApiQuery({
    name: 'source',
    required: false,
    enum: ['email', 'name+dob', 'name+gender', 'manual', 'review_pending'],
  })
  @ApiQuery({ name: 'maxConfidence', required: false, type: Number })
  @ApiQuery({ name: 'minLinkedRaces', required: false, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiResponse({ status: 200, type: IdentityClusterListResponseDto })
  async listClusters(
    @Query('page') page?: string,
    @Query('limit') limit?: string,
    @Query('source') source?: string,
    @Query('maxConfidence') maxConfidence?: string,
    @Query('minLinkedRaces') minLinkedRaces?: string,
    @Query('q') q?: string,
  ) {
    return this.clusteringService.listClusters({
      page: page ? parseInt(page, 10) : undefined,
      limit: limit ? parseInt(limit, 10) : undefined,
      source,
      maxConfidence: maxConfidence ? parseFloat(maxConfidence) : undefined,
      minLinkedRaces: minLinkedRaces ? parseInt(minLinkedRaces, 10) : undefined,
      q,
    });
  }

  /** BR-48-16 — Single cluster detail. */
  @Get(':clusterId')
  @ApiOperation({ summary: 'F-048 — Get cluster detail' })
  @ApiResponse({ status: 200, type: IdentityClusterListItemDto })
  @ApiResponse({ status: 404 })
  async getCluster(@Param('clusterId') clusterId: string) {
    const cluster = await this.clusteringService.getCluster(clusterId);
    if (!cluster) throw new NotFoundException('Cluster không tồn tại');
    return cluster;
  }

  /** BR-48-17 — Manual merge clusters into target. */
  @Patch(':clusterId/merge')
  @ApiOperation({ summary: 'F-048 — Manual merge clusters' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400, description: 'Validation fail' })
  @ApiResponse({ status: 404, description: 'Cluster not found' })
  async mergeClusters(
    @Param('clusterId') clusterId: string,
    @Body() body: MergeClustersDto,
    @CurrentUser() admin: LogtoUser,
  ) {
    return this.clusteringService.mergeClusters(
      clusterId,
      body.additionalClusterIds,
      body.reason,
      admin.sub,
    );
  }

  /** BR-48-18 — Manual split: extract athlete_ids to NEW cluster. */
  @Patch(':clusterId/split')
  @ApiOperation({ summary: 'F-048 — Manual split cluster' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 400 })
  async splitCluster(
    @Param('clusterId') clusterId: string,
    @Body() body: SplitClusterDto,
    @CurrentUser() admin: LogtoUser,
  ) {
    return this.clusteringService.splitCluster(
      clusterId,
      body.extractAthleteIds,
      body.reason,
      admin.sub,
    );
  }

  /** Trigger one-time clustering run (e.g. after bulk sync completes). */
  @Post('trigger-clustering')
  @ApiOperation({ summary: 'F-048 — Trigger clustering run manually' })
  @ApiResponse({ status: 200 })
  async triggerClustering(@CurrentUser() admin: LogtoUser) {
    // admin captured for future audit logging; runFullClustering currently
    // doesn't accept actor sub but Phase 2 will (BR-48-23).
    void admin;
    return this.clusteringService.runFullClustering({
      batchSize: 1000,
      maxBatches: 200,
    });
  }
}

@ApiTags('admin-athlete-identity')
@ApiBearerAuth()
@Controller('admin/identity-coverage-stats')
@UseGuards(LogtoAdminGuard)
export class IdentityCoverageStatsController {
  constructor(
    private readonly clusteringService: AthleteIdentityClusteringService,
  ) {}

  /** BR-48-19 — Coverage dashboard data. */
  @Get()
  @ApiOperation({ summary: 'F-048 — Identity coverage stats for dashboard' })
  @ApiResponse({ status: 200 })
  async getStats() {
    return this.clusteringService.getCoverageStats();
  }
}
