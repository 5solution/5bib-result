import {
  Controller,
  Get,
  Post,
  Patch,
  Delete,
  Param,
  Body,
  HttpCode,
  HttpStatus,
  UseGuards,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiParam,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { LogtoAdminGuard } from '../logto-auth';
import { SponsoredService } from './sponsored.service';
import { CreateSponsoredSlotDto } from './dto/create-sponsored-slot.dto';
import { UpdateSponsoredSlotDto } from './dto/update-sponsored-slot.dto';
import { CreateSponsoredItemDto } from './dto/create-sponsored-item.dto';
import { UpdateSponsoredItemDto } from './dto/update-sponsored-item.dto';
import { ReorderSlotsDto, ReorderItemsDto } from './dto/reorder.dto';

@ApiTags('Sponsored (Admin)')
@Controller('admin/sponsored')
export class SponsoredController {
  constructor(private readonly sponsoredService: SponsoredService) {}

  // ── Admin Slot CRUD ───────────────────────────────────────────────────────

  @Get()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @ApiOperation({ summary: 'List all sponsored slots (admin)' })
  @ApiResponse({ status: 200, description: 'All slots including inactive' })
  findAll() {
    return this.sponsoredService.findAllSlots();
  }

  @Get(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOperation({ summary: 'Get single sponsored slot (admin)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404, description: 'Slot not found' })
  findOne(@Param('id') id: string) {
    return this.sponsoredService.findSlotById(id);
  }

  @Post()
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @ApiOperation({ summary: 'Create sponsored slot (admin)' })
  @ApiResponse({ status: 201, description: 'Slot created. diamond_conflict=true if another diamond slot is already active.' })
  @ApiResponse({ status: 400, description: 'Validation error' })
  create(@Body() dto: CreateSponsoredSlotDto) {
    return this.sponsoredService.createSlot(dto);
  }

  @Patch('reorder')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiOperation({ summary: 'Reorder slot display positions (admin)' })
  @ApiResponse({ status: 204 })
  reorderSlots(@Body() dto: ReorderSlotsDto) {
    return this.sponsoredService.reorderSlots(dto);
  }

  @Patch(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOperation({ summary: 'Update sponsored slot config (admin)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  update(@Param('id') id: string, @Body() dto: UpdateSponsoredSlotDto) {
    return this.sponsoredService.updateSlot(id, dto);
  }

  @Delete(':id')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'id', type: 'string' })
  @ApiOperation({ summary: 'Delete slot and all its items (admin)' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 404 })
  remove(@Param('id') id: string) {
    return this.sponsoredService.deleteSlot(id);
  }

  // ── Admin Item CRUD ───────────────────────────────────────────────────────

  @Post(':slotId/items')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @ApiParam({ name: 'slotId', type: 'string' })
  @ApiOperation({ summary: 'Add item to slot (admin)' })
  @ApiResponse({ status: 201 })
  @ApiResponse({ status: 404, description: 'Slot not found' })
  addItem(
    @Param('slotId') slotId: string,
    @Body() dto: CreateSponsoredItemDto,
  ) {
    return this.sponsoredService.addItem(slotId, dto);
  }

  @Patch(':slotId/items/reorder')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'slotId', type: 'string' })
  @ApiOperation({ summary: 'Reorder items within a slot (admin)' })
  @ApiResponse({ status: 204 })
  reorderItems(
    @Param('slotId') slotId: string,
    @Body() dto: ReorderItemsDto,
  ) {
    return this.sponsoredService.reorderItems(slotId, dto);
  }

  @Patch(':slotId/items/:itemId')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @ApiParam({ name: 'slotId', type: 'string' })
  @ApiParam({ name: 'itemId', type: 'string' })
  @ApiOperation({ summary: 'Update item in slot (admin)' })
  @ApiResponse({ status: 200 })
  @ApiResponse({ status: 404 })
  updateItem(
    @Param('slotId') slotId: string,
    @Param('itemId') itemId: string,
    @Body() dto: UpdateSponsoredItemDto,
  ) {
    return this.sponsoredService.updateItem(slotId, itemId, dto);
  }

  @Delete(':slotId/items/:itemId')
  @ApiBearerAuth('JWT-auth')
  @UseGuards(LogtoAdminGuard)
  @HttpCode(HttpStatus.NO_CONTENT)
  @ApiParam({ name: 'slotId', type: 'string' })
  @ApiParam({ name: 'itemId', type: 'string' })
  @ApiOperation({ summary: 'Delete item from slot (admin). Fails if slot only has 1 item.' })
  @ApiResponse({ status: 204 })
  @ApiResponse({ status: 400, description: 'Cannot delete last item in slot' })
  @ApiResponse({ status: 404 })
  deleteItem(
    @Param('slotId') slotId: string,
    @Param('itemId') itemId: string,
  ) {
    return this.sponsoredService.deleteItem(slotId, itemId);
  }
}
