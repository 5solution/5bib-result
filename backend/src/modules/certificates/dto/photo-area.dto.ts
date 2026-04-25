import { ApiProperty, ApiPropertyOptional } from '@nestjs/swagger';
import { IsNumber, IsOptional } from 'class-validator';

export class PhotoAreaDto {
  @ApiProperty({ example: 120 })
  @IsNumber()
  x: number;

  @ApiProperty({ example: 200 })
  @IsNumber()
  y: number;

  @ApiProperty({ example: 300 })
  @IsNumber()
  width: number;

  @ApiProperty({ example: 300 })
  @IsNumber()
  height: number;

  @ApiPropertyOptional({ example: 150 })
  @IsOptional()
  @IsNumber()
  borderRadius?: number;
}
