import {
  Body,
  Controller,
  Get,
  Param,
  Post,
  Query,
  UseGuards,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiParam,
  ApiQuery,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { CurrentUser, LogtoAdminGuard, LogtoUser } from '../logto-auth';
import { IglooRequestService } from './services/igloo-request.service';
import { CreateIglooRequestsDto } from './dto/create-igloo-requests.dto';
import {
  CreateIglooRequestsResultDto,
  EligibleAthleteListDto,
  IglooConfigDto,
  IglooRaceDto,
  IglooRequestDto,
  IglooRequestListDto,
} from './dto/igloo-response.dto';
import { IGLOO_STATUSES } from './igloo-insurance.constants';

/**
 * FEATURE-085 — Igloo Insurance admin API. Tất cả `@UseGuards(LogtoAdminGuard)`
 * (back-office only). Hành động tạo đơn = tốn tiền thật → audit log ở service.
 */
@ApiTags('Igloo Insurance')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('igloo-insurance')
export class IglooInsuranceController {
  constructor(private readonly requestService: IglooRequestService) {}

  @Get('config')
  @ApiOperation({ summary: 'Admin — trạng thái kill-switch (banner)' })
  @ApiResponse({ status: 200, type: IglooConfigDto })
  config(): IglooConfigDto {
    return this.requestService.getConfig();
  }

  @Get('races')
  @ApiOperation({ summary: 'Admin — giải sắp diễn ra (dropdown)' })
  @ApiResponse({ status: 200, type: [IglooRaceDto] })
  races(): Promise<IglooRaceDto[]> {
    return this.requestService.listUpcomingRaces();
  }

  @Get('eligible-athletes')
  @ApiOperation({ summary: 'Admin — VĐV đủ điều kiện theo giải (paginated)' })
  @ApiQuery({ name: 'raceId', required: true, type: Number })
  @ApiQuery({ name: 'q', required: false, type: String })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, type: EligibleAthleteListDto })
  eligibleAthletes(
    @Query('raceId') raceId: string,
    @Query('q') q?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<EligibleAthleteListDto> {
    return this.requestService.listEligibleAthletes(
      Number(raceId),
      q,
      page ? Number(page) : 1,
      Math.min(pageSize ? Number(pageSize) : 20, 100),
    );
  }

  @Post('requests')
  @ApiOperation({ summary: 'Admin — tạo batch đơn (manual)' })
  @ApiResponse({ status: 201, type: CreateIglooRequestsResultDto })
  @ApiResponse({ status: 400, description: 'Validation' })
  createRequests(
    @Body() dto: CreateIglooRequestsDto,
    @CurrentUser() user: LogtoUser,
  ): Promise<CreateIglooRequestsResultDto> {
    return this.requestService.createBatch(dto.raceId, dto.athleteIds, user.sub);
  }

  @Get('requests')
  @ApiOperation({ summary: 'Admin — danh sách đơn đã tạo (paginated)' })
  @ApiQuery({ name: 'status', required: false, enum: IGLOO_STATUSES })
  @ApiQuery({ name: 'raceId', required: false, type: Number })
  @ApiQuery({ name: 'page', required: false, type: Number })
  @ApiQuery({ name: 'pageSize', required: false, type: Number })
  @ApiResponse({ status: 200, type: IglooRequestListDto })
  listRequests(
    @Query('status') status?: string,
    @Query('raceId') raceId?: string,
    @Query('page') page?: string,
    @Query('pageSize') pageSize?: string,
  ): Promise<IglooRequestListDto> {
    return this.requestService.list({
      status,
      raceId: raceId ? Number(raceId) : undefined,
      page: page ? Number(page) : 1,
      pageSize: Math.min(pageSize ? Number(pageSize) : 20, 100),
    });
  }

  @Get('requests/:id')
  @ApiOperation({ summary: 'Admin — chi tiết 1 đơn' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: IglooRequestDto })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  getRequest(@Param('id') id: string): Promise<IglooRequestDto> {
    return this.requestService.getOne(id);
  }

  @Post('requests/:id/retry')
  @ApiOperation({ summary: 'Admin — thử lại đơn FAILED' })
  @ApiParam({ name: 'id', type: String })
  @ApiResponse({ status: 200, type: IglooRequestDto })
  @ApiResponse({ status: 400, description: 'Không phải FAILED / vượt số lần retry' })
  @ApiResponse({ status: 404, description: 'Không tìm thấy' })
  retry(@Param('id') id: string): Promise<IglooRequestDto> {
    return this.requestService.retry(id);
  }
}
