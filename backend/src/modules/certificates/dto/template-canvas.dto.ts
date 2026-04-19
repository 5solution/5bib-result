import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import {
  IsInt,
  IsOptional,
  IsString,
  Max,
  Min,
  Matches,
} from 'class-validator';

export class TemplateCanvasDto {
  @ApiProperty({ example: 1080, minimum: 100, maximum: 4096 })
  @IsInt()
  @Min(100)
  @Max(4096)
  width: number;

  @ApiProperty({ example: 1350, minimum: 100, maximum: 4096 })
  @IsInt()
  @Min(100)
  @Max(4096)
  height: number;

  @ApiPropertyOptional({ example: '#ffffff' })
  @IsOptional()
  @IsString()
  @Matches(/^#([0-9a-fA-F]{3,8})$/, { message: 'backgroundColor must be hex' })
  backgroundColor?: string;

  @ApiPropertyOptional({
    example: 'https://cdn.5bib.com/templates/bg-1.png',
  })
  @IsOptional()
  @IsString()
  backgroundImageUrl?: string;
}
