import {
  Body,
  Controller,
  Delete,
  Get,
  HttpCode,
  Param,
  Patch,
  Post,
  Req,
  UseGuards,
} from '@nestjs/common';
import type { Request } from 'express';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { LogtoAdminGuard } from '../../logto-auth/logto-admin.guard';
import type { AuthenticatedRequest } from '../../logto-auth/types';
import { SimulatorService } from '../services/simulator.service';
import {
  CreateSimulationDto,
  SimulationResponseDto,
  UpdateSimulationDto,
  SeekSimulationDto,
  CreateScenarioDto,
  UpdateScenarioDto,
} from '../dto/simulator.dto';
import {
  TimingAlertSimulation,
  SimulationCourse,
  TimingAlertSimulationDocument,
} from '../schemas/timing-alert-simulation.schema';

/**
 * Admin CRUD + lifecycle controls cho simulator.
 *
 * Public serve (poll service hits) ở `simulator-public.controller.ts`.
 */
@ApiTags('Timing Alert Simulator (Admin)')
@ApiBearerAuth()
@UseGuards(LogtoAdminGuard)
@Controller('admin/timing-alert/simulator')
export class TimingAlertSimulatorAdminController {
  constructor(private readonly simulator: SimulatorService) {}

  @Get()
  @ApiOperation({ summary: 'List all simulations' })
  @ApiResponse({ status: 200, type: [SimulationResponseDto] })
  async list(@Req() req: Request): Promise<SimulationResponseDto[]> {
    const sims = await this.simulator.list();
    const baseUrl = this.deriveBaseUrl(req);
    return Promise.all(sims.map((s) => this.toResponse(s, baseUrl)));
  }

  @Get(':id')
  @ApiOperation({ summary: 'Get simulation detail' })
  @ApiResponse({ status: 200, type: SimulationResponseDto })
  async get(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<SimulationResponseDto> {
    const sim = await this.simulator.get(id);
    return this.toResponse(sim, this.deriveBaseUrl(req));
  }

  @Post()
  @ApiOperation({
    summary: 'Create simulation + fetch RR snapshots',
    description:
      'Mỗi course trong input fetch ngay 1 lần từ RR, store Mongo. Sau đó BTC nhận lại publicUrl per course để paste vào race.courses[].apiUrl.',
  })
  @ApiResponse({ status: 201, type: SimulationResponseDto })
  async create(
    @Body() dto: CreateSimulationDto,
    @Req() req: AuthenticatedRequest,
  ): Promise<SimulationResponseDto> {
    const userId = req.user?.sub ?? 'unknown';
    const sim = await this.simulator.create(dto, `admin:${userId}`);
    return this.toResponse(sim, this.deriveBaseUrl(req as unknown as Request));
  }

  @Patch(':id')
  @ApiOperation({ summary: 'Update simulation meta (name/desc/speed/offset)' })
  @ApiResponse({ status: 200, type: SimulationResponseDto })
  async update(
    @Param('id') id: string,
    @Body() dto: UpdateSimulationDto,
    @Req() req: Request,
  ): Promise<SimulationResponseDto> {
    const sim = await this.simulator.update(id, dto);
    return this.toResponse(sim, this.deriveBaseUrl(req));
  }

  @Delete(':id')
  @ApiOperation({ summary: 'Delete simulation + snapshots' })
  async delete(@Param('id') id: string): Promise<{ deleted: boolean }> {
    return this.simulator.delete(id);
  }

  @Post(':id/refresh-snapshot/:simCourseId')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Re-fetch RR snapshot cho 1 course (sau khi RR update data)',
  })
  async refresh(
    @Param('id') id: string,
    @Param('simCourseId') simCourseId: string,
  ) {
    return this.simulator.refreshSnapshot(id, simCourseId);
  }

  @Post(':id/play')
  @HttpCode(200)
  @ApiOperation({ summary: 'Start hoặc resume simulation clock' })
  @ApiResponse({ status: 200, type: SimulationResponseDto })
  async play(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<SimulationResponseDto> {
    const sim = await this.simulator.play(id);
    return this.toResponse(sim, this.deriveBaseUrl(req));
  }

  @Post(':id/pause')
  @HttpCode(200)
  @ApiOperation({ summary: 'Pause simulation — accumulatedSeconds giữ nguyên' })
  @ApiResponse({ status: 200, type: SimulationResponseDto })
  async pause(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<SimulationResponseDto> {
    const sim = await this.simulator.pause(id);
    return this.toResponse(sim, this.deriveBaseUrl(req));
  }

  @Post(':id/reset')
  @HttpCode(200)
  @ApiOperation({ summary: 'Reset simulation về T=0 + status created' })
  @ApiResponse({ status: 200, type: SimulationResponseDto })
  async reset(
    @Param('id') id: string,
    @Req() req: Request,
  ): Promise<SimulationResponseDto> {
    const sim = await this.simulator.reset(id);
    return this.toResponse(sim, this.deriveBaseUrl(req));
  }

  @Post(':id/seek')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Seek tới T (giây) cụ thể — pause + override accumulatedSeconds',
  })
  @ApiResponse({ status: 200, type: SimulationResponseDto })
  async seek(
    @Param('id') id: string,
    @Body() dto: SeekSimulationDto,
    @Req() req: Request,
  ): Promise<SimulationResponseDto> {
    const sim = await this.simulator.seek(id, dto.seconds);
    return this.toResponse(sim, this.deriveBaseUrl(req));
  }

  // ─────────── Scenarios CRUD ───────────

  @Post(':id/scenarios')
  @HttpCode(200)
  @ApiOperation({
    summary: 'Add scenario (special case injection — VĐV miss chip, mat failure, etc.)',
  })
  @ApiResponse({ status: 200, type: SimulationResponseDto })
  async addScenario(
    @Param('id') id: string,
    @Body() dto: CreateScenarioDto,
    @Req() req: Request,
  ): Promise<SimulationResponseDto> {
    const sim = await this.simulator.addScenario(id, {
      type: dto.type,
      enabled: dto.enabled ?? true,
      count: dto.count,
      checkpointKey: dto.checkpointKey,
      topN: dto.topN,
      shiftMinutes: dto.shiftMinutes,
      scopeSimCourseId: dto.scopeSimCourseId,
      description: dto.description,
    });
    return this.toResponse(sim, this.deriveBaseUrl(req));
  }

  @Patch(':id/scenarios/:scenarioId')
  @ApiOperation({ summary: 'Update scenario (toggle enabled, edit count, etc.)' })
  @ApiResponse({ status: 200, type: SimulationResponseDto })
  async updateScenario(
    @Param('id') id: string,
    @Param('scenarioId') scenarioId: string,
    @Body() dto: UpdateScenarioDto,
    @Req() req: Request,
  ): Promise<SimulationResponseDto> {
    const sim = await this.simulator.updateScenario(id, scenarioId, dto);
    return this.toResponse(sim, this.deriveBaseUrl(req));
  }

  @Delete(':id/scenarios/:scenarioId')
  @ApiOperation({ summary: 'Delete scenario' })
  @ApiResponse({ status: 200, type: SimulationResponseDto })
  async deleteScenario(
    @Param('id') id: string,
    @Param('scenarioId') scenarioId: string,
    @Req() req: Request,
  ): Promise<SimulationResponseDto> {
    const sim = await this.simulator.deleteScenario(id, scenarioId);
    return this.toResponse(sim, this.deriveBaseUrl(req));
  }

  // ─────────── Internal mapper ───────────

  /**
   * Derive base URL cho publicUrl. Priority:
   * 1. `PUBLIC_API_BASE_URL` env (production) — VD `https://result.5bib.com`
   * 2. `BACKEND_PUBLIC_URL` env fallback
   * 3. Reconstruct from request `X-Forwarded-Proto/Host` or `Host` header
   *    — works cho local dev `http://localhost:8081` cũng như VPS qua nginx
   */
  private deriveBaseUrl(req: Request): string {
    const envUrl =
      process.env.PUBLIC_API_BASE_URL || process.env.BACKEND_PUBLIC_URL;
    if (envUrl) return envUrl.replace(/\/$/, '');
    const proto =
      (req.headers['x-forwarded-proto'] as string) ||
      (req.protocol ?? 'http');
    const host =
      (req.headers['x-forwarded-host'] as string) ||
      (req.headers.host as string) ||
      'localhost:8081';
    return `${proto}://${host}`;
  }

  private async toResponse(
    sim: TimingAlertSimulation | TimingAlertSimulationDocument,
    baseUrl: string,
  ): Promise<SimulationResponseDto> {
    const id = String((sim as TimingAlertSimulationDocument)._id);
    const currentSimSeconds = await this.simulator.getCurrentSimSeconds(id).catch(() => 0);

    return {
      id,
      name: sim.name,
      description: sim.description ?? null,
      speedFactor: sim.speedFactor,
      startOffsetSeconds: sim.startOffsetSeconds,
      status: sim.status,
      startedAt: sim.startedAt ? new Date(sim.startedAt).toISOString() : null,
      pausedAt: sim.pausedAt ? new Date(sim.pausedAt).toISOString() : null,
      accumulatedSeconds: sim.accumulatedSeconds,
      currentSimSeconds,
      scenarios: (sim.scenarios ?? []).map((s) => ({
        id: s.id,
        type: s.type,
        enabled: s.enabled,
        count: s.count,
        checkpointKey: s.checkpointKey,
        topN: s.topN,
        shiftMinutes: s.shiftMinutes,
        scopeSimCourseId: s.scopeSimCourseId,
        description: s.description,
      })),
      courses: (sim.courses ?? []).map((c: SimulationCourse) => ({
        simCourseId: c.simCourseId,
        label: c.label,
        sourceUrl: c.sourceUrl,
        snapshotFetchedAt: c.snapshotFetchedAt
          ? new Date(c.snapshotFetchedAt).toISOString()
          : null,
        snapshotItems: c.snapshotItems,
        earliestSeconds: c.earliestSeconds ?? null,
        latestSeconds: c.latestSeconds ?? null,
        publicUrl: `${baseUrl}/api/timing-alert/simulator-data/${c.simCourseId}`,
      })),
      createdBy: sim.createdBy ?? 'unknown',
      createdAt:
        (sim as TimingAlertSimulationDocument).created_at?.toISOString?.() ??
        new Date().toISOString(),
      updatedAt:
        (sim as TimingAlertSimulationDocument).updated_at?.toISOString?.() ??
        new Date().toISOString(),
    };
  }
}
