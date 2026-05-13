import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  PROMO_HUB_LAYOUTS,
  PROMO_HUB_STATUSES,
  PromoHubLayout,
  PromoHubStatus,
} from '../schemas/promo-hub.schema';
import { SectionResponseDto } from './section.dto';

export class PromoHubSeoResponseDto {
  @ApiPropertyOptional() metaTitle?: string;
  @ApiPropertyOptional() metaDescription?: string;
  @ApiPropertyOptional() ogImage?: string;
  @ApiPropertyOptional() canonicalUrl?: string;
  @ApiPropertyOptional({ type: 'object', additionalProperties: true })
  structuredData?: Record<string, unknown>;
}

export class PromoHubThemeResponseDto {
  @ApiProperty() primaryColor!: string;
  @ApiProperty() secondaryColor!: string;
  @ApiProperty() fontFamily!: string;
  @ApiProperty({ enum: PROMO_HUB_LAYOUTS })
  layout!: PromoHubLayout;
  @ApiPropertyOptional() customCss?: string;
}

export class PromoHubResponseDto {
  @ApiProperty()
  id!: string;

  @ApiProperty()
  slug!: string;

  @ApiProperty()
  title!: string;

  @ApiPropertyOptional()
  description?: string;

  @ApiProperty({ enum: PROMO_HUB_STATUSES })
  status!: PromoHubStatus;

  @ApiProperty({ type: [SectionResponseDto] })
  sections!: SectionResponseDto[];

  @ApiProperty({ type: PromoHubSeoResponseDto })
  seo!: PromoHubSeoResponseDto;

  @ApiProperty({ type: PromoHubThemeResponseDto })
  theme!: PromoHubThemeResponseDto;

  @ApiProperty()
  createdBy!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  createdAt!: string;

  @ApiProperty({ type: String, format: 'date-time' })
  updatedAt!: string;
}

export class PromoHubListItemDto {
  @ApiProperty() id!: string;
  @ApiProperty() slug!: string;
  @ApiProperty() title!: string;
  @ApiProperty({ enum: PROMO_HUB_STATUSES }) status!: PromoHubStatus;
  @ApiProperty({ description: 'Section count (computed)' }) sectionCount!: number;
  @ApiProperty({
    description: 'View count in last 7 days (aggregated)',
    default: 0,
  })
  views7d!: number;
  @ApiProperty({ type: String, format: 'date-time' }) createdAt!: string;
  @ApiProperty({ type: String, format: 'date-time' }) updatedAt!: string;
}

export class PromoHubListResponseDto {
  @ApiProperty({ type: [PromoHubListItemDto] })
  data!: PromoHubListItemDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  pageNo!: number;

  @ApiProperty()
  pageSize!: number;

  @ApiProperty()
  totalPages!: number;
}

export class PromoHubListQueryDto {
  @ApiPropertyOptional({ enum: [...PROMO_HUB_STATUSES, 'all'], default: 'all' })
  status?: PromoHubStatus | 'all';

  @ApiPropertyOptional({ default: 1, minimum: 1 })
  pageNo?: number;

  @ApiPropertyOptional({ default: 20, minimum: 1, maximum: 100 })
  pageSize?: number;

  @ApiPropertyOptional({ description: 'Search by title (case-insensitive substring)' })
  q?: string;
}
