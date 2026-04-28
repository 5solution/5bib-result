import { ApiPropertyOptional } from '@nestjs/swagger';
import { IsOptional, IsString, Matches, MaxLength } from 'class-validator';

export class RestoreArticleDto {
  @ApiPropertyOptional({
    description: 'Override slug khi restore. Mặc định: lấy slug gốc trước khi soft-delete.',
    example: 'huong-dan-dang-ky-giai-chay',
  })
  @IsOptional()
  @IsString()
  @Matches(/^[a-z0-9-]+$/, { message: 'Slug chỉ được chứa chữ thường, số, và dấu gạch ngang' })
  @MaxLength(120)
  slug?: string;
}
