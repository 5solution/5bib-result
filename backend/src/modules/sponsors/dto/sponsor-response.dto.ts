import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';

export class SponsorDto {
  @ApiProperty({ example: '6651abc123' }) _id: string;
  @ApiProperty({ example: 'Acme Corp' }) name: string;
  @ApiProperty({ example: 'https://s3.../logo.png' }) logoUrl: string;
  @ApiPropertyOptional({ example: 'https://acme.com' }) website: string;
  @ApiProperty({ example: 'gold', enum: ['silver', 'gold', 'diamond'] }) level: string;
  @ApiProperty({ example: 0 }) order: number;
  @ApiPropertyOptional({ example: '6651abc123' }) raceId: string;
  @ApiProperty({ example: true }) isActive: boolean;
}
