import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

/** FEATURE-089 — response 1 short link (admin). KHÔNG leak _id/__v/createdBy. */
export class ShortLinkResponseDto {
  @ApiProperty({ description: 'Id (alias từ _id)' })
  id!: string;

  @ApiProperty({ example: 'aZ3kP9' })
  code!: string;

  @ApiProperty({ example: 'https://s.5bib.com/aZ3kP9' })
  shortUrl!: string;

  @ApiProperty()
  targetUrl!: string;

  @ApiPropertyOptional()
  title?: string;

  @ApiProperty()
  clickCount!: number;

  @ApiProperty()
  active!: boolean;

  @ApiProperty()
  createdAt!: string;

  @ApiProperty()
  updatedAt!: string;
}

/** FEATURE-089 — response list (admin). */
export class ShortLinkListResponseDto {
  @ApiProperty({ type: [ShortLinkResponseDto] })
  items!: ShortLinkResponseDto[];

  @ApiProperty()
  total!: number;

  @ApiProperty()
  page!: number;

  @ApiProperty()
  pageSize!: number;
}

/** FEATURE-089 — response resolve (public, dùng bởi frontend redirect handler). */
export class ResolveShortLinkDto {
  @ApiProperty({ description: 'URL đích để redirect 302' })
  targetUrl!: string;
}
