import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ApiKeysService } from './api-keys.service';
import {
  ApiKeyResponseDto,
  CreateApiKeyDto,
  CreatedApiKeyDto,
  UpdateApiKeyDto,
} from './dto/api-key.dto';
import { LogtoAdminGuard } from '../logto-auth';

@ApiTags('API Keys · Admin')
@ApiBearerAuth('JWT-auth')
@UseGuards(LogtoAdminGuard)
@Controller('admin/api-keys')
export class ApiKeysAdminController {
  constructor(private readonly service: ApiKeysService) {}

  @Get()
  @ApiOperation({ summary: 'List all API keys (admin)' })
  @ApiResponse({ status: 200, type: [ApiKeyResponseDto] })
  list() {
    return this.service.list();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get single API key by ID' })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto })
  findOne(@Param('id') id: string) {
    return this.service.findById(id);
  }

  @Post()
  @ApiOperation({
    summary: 'Generate new API key — full key returned ONCE',
    description:
      'Response includes `fullKey` cleartext. Frontend MUST display once + warn user to save securely. Subsequent reads only return prefix.',
  })
  @ApiResponse({ status: 201, type: CreatedApiKeyDto })
  create(@Body() dto: CreateApiKeyDto) {
    return this.service.create(dto);
  }

  @Patch(':id')
  @ApiOperation({
    summary: 'Update key metadata (name, origins, rate limit, isActive, notes)',
  })
  @ApiResponse({ status: 200, type: ApiKeyResponseDto })
  update(@Param('id') id: string, @Body() dto: UpdateApiKeyDto) {
    return this.service.update(id, dto);
  }

  @Delete(':id')
  @ApiOperation({
    summary: 'Permanently delete API key — instant revoke',
  })
  @ApiResponse({
    status: 200,
    schema: { type: 'object', properties: { ok: { type: 'boolean' } } },
  })
  remove(@Param('id') id: string) {
    return this.service.remove(id);
  }
}
