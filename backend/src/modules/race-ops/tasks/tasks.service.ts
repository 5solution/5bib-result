import {
  BadRequestException,
  Injectable,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { Model, Types } from 'mongoose';
import { Request } from 'express';
import { OpsTask, OpsTaskDocument } from '../schemas/ops-task.schema';
import { OpsTeam, OpsTeamDocument } from '../schemas/ops-team.schema';
import { AuditService } from '../audit/audit.service';
import { AUDIT_ACTIONS } from '../common/constants';
import { EventsService } from '../events/events.service';
import {
  CreateTaskDto,
  ImportTasksDto,
  ImportTasksResponseDto,
  TaskListQueryDto,
  TaskListResponseDto,
  TaskResponseDto,
  UpdateTaskDto,
  UpdateTaskStatusDto,
} from './dto/task.dto';

/**
 * TasksService — timeline tasks cho event (event-wide hoặc gắn team).
 *
 * Rules:
 *  - Delete = soft-delete (`deleted_at`).
 *  - Admin có full CRUD. Leader chỉ thấy/update task của team mình (BR-02).
 *  - status=BLOCKED bắt buộc `blocker_reason`.
 *  - Khi status → DONE → set completed_at/by.
 */
@Injectable()
export class TasksService {
  constructor(
    @InjectModel(OpsTask.name)
    private readonly taskModel: Model<OpsTaskDocument>,
    @InjectModel(OpsTeam.name)
    private readonly teamModel: Model<OpsTeamDocument>,
    private readonly eventsService: EventsService,
    private readonly auditService: AuditService,
  ) {}

  async create(
    tenantId: string,
    eventId: string,
    createdBy: string,
    dto: CreateTaskDto,
    request?: Request,
  ): Promise<TaskResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    let teamObjId: Types.ObjectId | null = null;
    if (dto.team_id) {
      const team = await this.teamModel
        .findOne({
          _id: new Types.ObjectId(dto.team_id),
          event_id: event._id,
          deleted_at: null,
        })
        .lean();
      if (!team) throw new NotFoundException('Team not found');
      teamObjId = team._id;
    }

    const created = await this.taskModel.create({
      event_id: event._id,
      team_id: teamObjId,
      title: dto.title,
      description: dto.description,
      due_at: new Date(dto.due_at),
      due_end_at: dto.due_end_at ? new Date(dto.due_end_at) : undefined,
      assignee_user_ids: (dto.assignee_user_ids ?? []).map(
        (id) => new Types.ObjectId(id),
      ),
      status: 'PENDING',
    });

    await this.auditService.log({
      event_id: event._id,
      user_id: createdBy,
      action: 'CREATE_TASK',
      entity_type: 'ops_tasks',
      entity_id: created._id,
      payload: { title: created.title, team_id: teamObjId ? String(teamObjId) : null },
      request,
    });

    return this.toResponse(created);
  }

  async list(
    tenantId: string,
    eventId: string,
    query: TaskListQueryDto,
    scopeTeamId?: string,
  ): Promise<TaskListResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    const filter: Record<string, unknown> = {
      event_id: event._id,
      deleted_at: null,
    };

    if (scopeTeamId) {
      if (!Types.ObjectId.isValid(scopeTeamId)) {
        return { items: [], total: 0 };
      }
      // Leader xem task team mình + task event-wide (team_id=null)
      filter.$or = [
        { team_id: new Types.ObjectId(scopeTeamId) },
        { team_id: null },
      ];
    } else if (query.team_id) {
      filter.team_id = new Types.ObjectId(query.team_id);
    }

    if (query.status) filter.status = query.status;
    if (query.assignee_user_id) {
      filter.assignee_user_ids = new Types.ObjectId(query.assignee_user_id);
    }

    const [items, total] = await Promise.all([
      this.taskModel.find(filter).sort({ due_at: 1 }).lean(),
      this.taskModel.countDocuments(filter),
    ]);

    return {
      items: items.map((t) => this.toResponse(t)),
      total,
    };
  }

  async findOne(
    tenantId: string,
    eventId: string,
    taskId: string,
    scopeTeamId?: string,
  ): Promise<TaskResponseDto> {
    const doc = await this.findEntity(tenantId, eventId, taskId);
    if (scopeTeamId) {
      const tid = doc.team_id ? String(doc.team_id) : null;
      if (tid !== null && tid !== scopeTeamId) {
        throw new NotFoundException('Task not found');
      }
    }
    return this.toResponse(doc);
  }

  async update(
    tenantId: string,
    eventId: string,
    taskId: string,
    updatedBy: string,
    dto: UpdateTaskDto,
    scopeTeamId?: string,
    request?: Request,
  ): Promise<TaskResponseDto> {
    const doc = await this.findEntity(tenantId, eventId, taskId);

    if (scopeTeamId) {
      const tid = doc.team_id ? String(doc.team_id) : null;
      if (tid !== null && tid !== scopeTeamId) {
        throw new NotFoundException('Task not found');
      }
      // Leader không được move task sang team khác hoặc tạo event-wide
      if (dto.team_id !== undefined && dto.team_id !== scopeTeamId) {
        throw new BadRequestException(
          'Leader không được move task sang team khác',
        );
      }
    }

    const patch: Record<string, unknown> = {};
    if (dto.title !== undefined) patch.title = dto.title;
    if (dto.description !== undefined) patch.description = dto.description;
    if (dto.due_at !== undefined) patch.due_at = new Date(dto.due_at);
    if (dto.due_end_at !== undefined) {
      patch.due_end_at = dto.due_end_at ? new Date(dto.due_end_at) : null;
    }
    if (dto.team_id !== undefined) {
      if (dto.team_id === null || dto.team_id === '') {
        patch.team_id = null;
      } else {
        const team = await this.teamModel
          .findOne({
            _id: new Types.ObjectId(dto.team_id),
            event_id: doc.event_id,
            deleted_at: null,
          })
          .lean();
        if (!team) throw new NotFoundException('Team not found');
        patch.team_id = team._id;
      }
    }
    if (dto.assignee_user_ids !== undefined) {
      patch.assignee_user_ids = dto.assignee_user_ids.map(
        (id) => new Types.ObjectId(id),
      );
    }

    let fromStatus: string | undefined;
    let toStatus: string | undefined;
    if (dto.status !== undefined && dto.status !== doc.status) {
      if (dto.status === 'BLOCKED' && !dto.blocker_reason && !doc.blocker_reason) {
        throw new BadRequestException(
          'blocker_reason bắt buộc khi chuyển sang BLOCKED',
        );
      }
      fromStatus = doc.status;
      toStatus = dto.status;
      patch.status = dto.status;
      if (dto.status === 'DONE') {
        patch.completed_at = new Date();
        patch.completed_by = new Types.ObjectId(updatedBy);
      } else {
        patch.completed_at = null;
        patch.completed_by = null;
      }
    }
    if (dto.blocker_reason !== undefined) {
      patch.blocker_reason = dto.blocker_reason;
    }

    await this.taskModel.updateOne({ _id: doc._id }, { $set: patch });

    await this.auditService.log({
      event_id: doc.event_id,
      user_id: updatedBy,
      action: fromStatus
        ? AUDIT_ACTIONS.UPDATE_TASK_STATUS
        : 'UPDATE_TASK',
      entity_type: 'ops_tasks',
      entity_id: doc._id,
      from_state: fromStatus,
      to_state: toStatus,
      payload: patch,
      request,
    });

    const fresh = await this.taskModel.findById(doc._id).lean();
    if (!fresh) throw new NotFoundException('Task disappeared after update');
    return this.toResponse(fresh);
  }

  async updateStatus(
    tenantId: string,
    eventId: string,
    taskId: string,
    updatedBy: string,
    dto: UpdateTaskStatusDto,
    scopeTeamId?: string,
    request?: Request,
  ): Promise<TaskResponseDto> {
    return this.update(
      tenantId,
      eventId,
      taskId,
      updatedBy,
      {
        status: dto.status,
        blocker_reason: dto.blocker_reason,
      },
      scopeTeamId,
      request,
    );
  }

  async archive(
    tenantId: string,
    eventId: string,
    taskId: string,
    userId: string,
    request?: Request,
  ): Promise<void> {
    const doc = await this.findEntity(tenantId, eventId, taskId);
    await this.taskModel.updateOne(
      { _id: doc._id },
      { $set: { deleted_at: new Date() } },
    );
    await this.auditService.log({
      event_id: doc.event_id,
      user_id: userId,
      action: 'ARCHIVE_TASK',
      entity_type: 'ops_tasks',
      entity_id: doc._id,
      payload: { title: doc.title },
      request,
    });
  }

  /**
   * Bulk import từ Excel (TIMELINE sheet). Admin-only.
   * `replace_by_sheet=true` → xoá tasks có cùng source_excel_sheet trước khi import
   * (dùng khi re-upload file mới).
   */
  async importFromExcel(
    tenantId: string,
    eventId: string,
    importedBy: string,
    dto: ImportTasksDto,
    request?: Request,
  ): Promise<ImportTasksResponseDto> {
    const event = await this.eventsService.findEntity(tenantId, eventId);

    const response: ImportTasksResponseDto = {
      created: 0,
      replaced: 0,
      skipped: 0,
      errors: [],
    };

    // Optional: replace existing tasks có cùng sheet
    if (dto.replace_by_sheet) {
      const sheets = Array.from(
        new Set(
          dto.rows
            .map((r) => r.source_excel_sheet)
            .filter((s): s is string => !!s),
        ),
      );
      if (sheets.length > 0) {
        const res = await this.taskModel.updateMany(
          {
            event_id: event._id,
            source_excel_sheet: { $in: sheets },
            deleted_at: null,
          },
          { $set: { deleted_at: new Date() } },
        );
        response.replaced = res.modifiedCount;
      }
    }

    // Validate team_ids upfront
    const teamIds = Array.from(
      new Set(
        dto.rows
          .map((r) => r.team_id)
          .filter((t): t is string => !!t && Types.ObjectId.isValid(t)),
      ),
    );
    const teams = teamIds.length
      ? await this.teamModel
          .find({
            _id: { $in: teamIds.map((id) => new Types.ObjectId(id)) },
            event_id: event._id,
            deleted_at: null,
          })
          .select('_id')
          .lean()
      : [];
    const validTeamSet = new Set(teams.map((t) => String(t._id)));

    const docs: Array<Record<string, unknown>> = [];
    for (let i = 0; i < dto.rows.length; i++) {
      const row = dto.rows[i];
      if (!row.title || row.title.trim().length < 2) {
        response.errors.push(`Row ${i}: title thiếu/quá ngắn`);
        response.skipped += 1;
        continue;
      }
      if (!row.due_at) {
        response.errors.push(`Row ${i}: due_at thiếu`);
        response.skipped += 1;
        continue;
      }
      const dueAt = new Date(row.due_at);
      if (Number.isNaN(dueAt.valueOf())) {
        response.errors.push(`Row ${i}: due_at không parse được`);
        response.skipped += 1;
        continue;
      }
      let teamObjId: Types.ObjectId | null = null;
      if (row.team_id) {
        if (!validTeamSet.has(row.team_id)) {
          response.errors.push(`Row ${i}: team_id không tồn tại trong event`);
          response.skipped += 1;
          continue;
        }
        teamObjId = new Types.ObjectId(row.team_id);
      }
      docs.push({
        event_id: event._id,
        team_id: teamObjId,
        title: row.title.trim(),
        description: row.description,
        due_at: dueAt,
        due_end_at: row.due_end_at ? new Date(row.due_end_at) : undefined,
        status: 'PENDING',
        source_excel_row: row.source_excel_row,
        source_excel_sheet: row.source_excel_sheet,
      });
    }

    if (docs.length > 0) {
      const inserted = await this.taskModel.insertMany(docs);
      response.created = inserted.length;
    }

    await this.auditService.log({
      event_id: event._id,
      user_id: importedBy,
      action: 'IMPORT_TASKS',
      entity_type: 'ops_tasks',
      entity_id: event._id,
      payload: {
        created: response.created,
        replaced: response.replaced,
        skipped: response.skipped,
      },
      request,
    });

    return response;
  }

  private async findEntity(
    tenantId: string,
    eventId: string,
    taskId: string,
  ): Promise<OpsTaskDocument> {
    const event = await this.eventsService.findEntity(tenantId, eventId);
    if (!Types.ObjectId.isValid(taskId)) {
      throw new NotFoundException('Task not found');
    }
    const doc = await this.taskModel.findOne({
      _id: new Types.ObjectId(taskId),
      event_id: event._id,
      deleted_at: null,
    });
    if (!doc) throw new NotFoundException('Task not found');
    return doc;
  }

  private toResponse(
    doc: OpsTaskDocument | Record<string, unknown>,
  ): TaskResponseDto {
    const d = doc as Record<string, unknown> & { _id: Types.ObjectId };
    return {
      id: String(d._id),
      event_id: String(d.event_id),
      team_id: d.team_id ? String(d.team_id) : null,
      title: String(d.title),
      description: d.description as string | undefined,
      due_at: new Date(d.due_at as string | Date),
      due_end_at: d.due_end_at
        ? new Date(d.due_end_at as string | Date)
        : undefined,
      status: d.status as TaskResponseDto['status'],
      assignee_user_ids: Array.isArray(d.assignee_user_ids)
        ? (d.assignee_user_ids as Types.ObjectId[]).map((u) => String(u))
        : [],
      blocker_reason: d.blocker_reason as string | undefined,
      completed_at: d.completed_at
        ? new Date(d.completed_at as string | Date)
        : undefined,
      completed_by: d.completed_by ? String(d.completed_by) : null,
      source_excel_row: d.source_excel_row as number | undefined,
      source_excel_sheet: d.source_excel_sheet as string | undefined,
      created_at: new Date(d.created_at as string | Date),
      updated_at: new Date(d.updated_at as string | Date),
    };
  }
}
