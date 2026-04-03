import { ApiProperty } from '@nestjs/swagger';

export class PaginationMeta {
  @ApiProperty({ example: 1 }) pageNo: number;
  @ApiProperty({ example: 10 }) pageSize: number;
  @ApiProperty({ example: 100 }) total: number;
  @ApiProperty({ example: 10 }) totalPages: number;
}

export class PaginationMetaAlt {
  @ApiProperty({ example: 1 }) page: number;
  @ApiProperty({ example: 20 }) pageSize: number;
  @ApiProperty({ example: 100 }) total: number;
  @ApiProperty({ example: 5 }) totalPages: number;
}
