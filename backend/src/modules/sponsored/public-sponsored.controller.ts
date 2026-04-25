import { Controller, Get } from '@nestjs/common';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { SponsoredService, PublicSponsoredResponse } from './sponsored.service';

@ApiTags('Sponsored (Public)')
@Controller('public/homepage/sponsored')
export class PublicSponsoredController {
  constructor(private readonly sponsoredService: SponsoredService) {}

  @Get()
  @ApiOperation({
    summary:
      'Public homepage sponsored banner zone — called by 5bib.com (Redis-cached 300s)',
  })
  @ApiResponse({ status: 200, description: 'Active sponsored slots with items' })
  getHomepage(): Promise<PublicSponsoredResponse> {
    return this.sponsoredService.getPublicSlots();
  }
}
