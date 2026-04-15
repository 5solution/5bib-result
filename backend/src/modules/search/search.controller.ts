import { Controller, Get, Query } from '@nestjs/common';
import { ApiOkResponse, ApiOperation, ApiTags } from '@nestjs/swagger';
import { SearchService } from './search.service';
import { SearchQueryDto, SearchResponseDto } from './dto/search.dto';

@ApiTags('search')
@Controller('search')
export class SearchController {
  constructor(private readonly searchService: SearchService) {}

  @Get()
  @ApiOperation({
    summary: 'Global search — race name (fuzzy) or bib (exact)',
    description:
      'Public endpoint. Activates at ≥2 chars (client-side). Auto-detects ' +
      'bib if query is digits only; otherwise searches race names. Bib lookups ' +
      'are cached for 60 seconds.',
  })
  @ApiOkResponse({ type: SearchResponseDto })
  async search(@Query() query: SearchQueryDto): Promise<SearchResponseDto> {
    const data = await this.searchService.search(query.q, query.type);
    return { data, success: true };
  }
}
