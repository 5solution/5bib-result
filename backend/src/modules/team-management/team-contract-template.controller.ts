import {
  BadRequestException,
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseIntPipe,
  Post,
  Put,
  Req,
  UploadedFile,
  UseGuards,
  UseInterceptors,
} from '@nestjs/common';
import { FileInterceptor } from '@nestjs/platform-express';
import {
  ApiBearerAuth,
  ApiBody,
  ApiConsumes,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import type { Request } from 'express';
import { JwtAuthGuard } from 'src/modules/auth/guards/jwt-auth.guard';
import { VolContractTemplate } from './entities/vol-contract-template.entity';
import {
  CreateContractTemplateDto,
  ImportDocxResponseDto,
  UpdateContractTemplateDto,
} from './dto/contract-template.dto';
import { TeamContractService } from './services/team-contract.service';

interface JwtRequest extends Request {
  user?: { username?: string; email?: string; sub?: string };
}

@ApiTags('Team Management — Contract Templates (admin)')
@ApiBearerAuth()
@UseGuards(JwtAuthGuard)
@Controller('team-management/contract-templates')
export class TeamContractTemplateController {
  constructor(private readonly contracts: TeamContractService) {}

  @Get()
  @ApiOperation({ summary: 'List contract templates' })
  @ApiResponse({ status: 200, type: [VolContractTemplate] })
  list(): Promise<VolContractTemplate[]> {
    return this.contracts.listTemplates();
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get template detail' })
  @ApiResponse({ status: 200, type: VolContractTemplate })
  get(@Param('id', ParseIntPipe) id: number): Promise<VolContractTemplate> {
    return this.contracts.getTemplate(id);
  }

  @Post()
  @ApiOperation({ summary: 'Create template from HTML' })
  @ApiResponse({ status: 201, type: VolContractTemplate })
  create(
    @Body() dto: CreateContractTemplateDto,
    @Req() req: JwtRequest,
  ): Promise<VolContractTemplate> {
    const createdBy =
      req.user?.username ?? req.user?.email ?? req.user?.sub ?? 'admin';
    return this.contracts.createTemplate(dto, createdBy);
  }

  @Put(':id')
  @ApiOperation({ summary: 'Update template' })
  @ApiResponse({ status: 200, type: VolContractTemplate })
  update(
    @Param('id', ParseIntPipe) id: number,
    @Body() dto: UpdateContractTemplateDto,
  ): Promise<VolContractTemplate> {
    return this.contracts.updateTemplate(id, dto);
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete template (must not be assigned to any role)' })
  async remove(
    @Param('id', ParseIntPipe) id: number,
  ): Promise<{ success: true }> {
    await this.contracts.deleteTemplate(id);
    return { success: true };
  }

  @Post('import-docx')
  @UseInterceptors(FileInterceptor('file', { limits: { fileSize: 5 * 1024 * 1024 } }))
  @ApiOperation({ summary: 'Convert a .docx upload to HTML (returns without saving)' })
  @ApiConsumes('multipart/form-data')
  @ApiBody({
    schema: {
      type: 'object',
      required: ['file'],
      properties: { file: { type: 'string', format: 'binary' } },
    },
  })
  @ApiResponse({ status: 201, type: ImportDocxResponseDto })
  async importDocx(
    @UploadedFile() file: Express.Multer.File,
  ): Promise<ImportDocxResponseDto> {
    if (!file) {
      throw new BadRequestException(
        'file is required (multipart field name: "file")',
      );
    }
    try {
      const { content_html, warnings } = await this.contracts.importDocx(
        file.buffer,
      );
      return { content_html, warnings };
    } catch (err) {
      throw new BadRequestException(
        (err as Error).message || 'Could not parse DOCX',
      );
    }
  }
}
