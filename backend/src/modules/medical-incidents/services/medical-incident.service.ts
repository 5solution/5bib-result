import {
  BadRequestException,
  ConflictException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import Redis from 'ioredis';
import { Model, Types } from 'mongoose';
import { LogtoUser } from '../../logto-auth/types';
import { CreateIncidentDto } from '../dto/create-incident.dto';
import {
  IncidentListResponseDto,
  IncidentResponseDto,
} from '../dto/incident-response.dto';
import { ListIncidentsFilterDto } from '../dto/list-incidents-filter.dto';
import { UpdateIncidentStatusDto } from '../dto/update-incident-status.dto';
import {
  ActorRole,
  IncidentState,
  MedicalIncident,
  MedicalIncidentDocument,
  Severity,
  STATES,
} from '../schemas/medical-incident.schema';
import { MedicalIncidentSseService } from './sse-broadcaster.service';

/**
 * F-018 BR-MI-12 — Forward-only state transition matrix (advisory §3.B).
 *
 *                    REP  MD   MOS  AR   HT   ROS  RDNF CLO
 *   REPORTED          -    ✓    ✓    ✓    -    ✓    ✓    ✓
 *   MEDIC_DISPATCHED  -    -    ✓    ✓    -    ✓    ✓    ✓
 *   MEDIC_ON_SITE     -    -    -    ✓    -    ✓    ✓    ✓
 *   AMB_REQUESTED     -    -    -    -    ✓    ✓    ✓    -
 *   HOSPITAL_TRANSFER -    -    -    -    -    -    ✓    ✓
 *   RESOLVED_ONSITE   -    -    -    -    -    -    -    ✓
 *   RESOLVED_DNF      -    -    -    -    -    -    -    ✓
 *   CLOSED            -    -    -    -    -    -    -    -  (terminal)
 */
const TRANSITION_MATRIX: Record<IncidentState, IncidentState[]> = {
  REPORTED: [
    'MEDIC_DISPATCHED',
    'MEDIC_ON_SITE',
    'AMB_REQUESTED',
    'RESOLVED_ONSITE',
    'RESOLVED_DNF',
    'CLOSED',
  ],
  MEDIC_DISPATCHED: [
    'MEDIC_ON_SITE',
    'AMB_REQUESTED',
    'RESOLVED_ONSITE',
    'RESOLVED_DNF',
    'CLOSED',
  ],
  MEDIC_ON_SITE: [
    'AMB_REQUESTED',
    'RESOLVED_ONSITE',
    'RESOLVED_DNF',
    'CLOSED',
  ],
  AMB_REQUESTED: ['HOSPITAL_TRANSFER', 'RESOLVED_ONSITE', 'RESOLVED_DNF'],
  HOSPITAL_TRANSFER: ['RESOLVED_DNF', 'CLOSED'],
  RESOLVED_ONSITE: ['CLOSED'],
  RESOLVED_DNF: ['CLOSED'],
  CLOSED: [],
};

const ACTIVE_STATES: ReadonlySet<IncidentState> = new Set([
  'REPORTED',
  'MEDIC_DISPATCHED',
  'MEDIC_ON_SITE',
  'AMB_REQUESTED',
  'HOSPITAL_TRANSFER',
]);

const ACTIVE_COUNT_TTL = 60;
const LOCK_TTL = 5;

@Injectable()
export class MedicalIncidentService {
  private readonly logger = new Logger(MedicalIncidentService.name);

  constructor(
    @InjectModel(MedicalIncident.name)
    private readonly incidentModel: Model<MedicalIncidentDocument>,
    @InjectRedis() private readonly redis: Redis,
    private readonly sse: MedicalIncidentSseService,
  ) {}

  /** F-018 BR-MI-32 — derive actor role from Logto user roles/scopes. */
  private deriveActorRole(user: LogtoUser): ActorRole {
    const roles = (user.roles ?? []).map((r) => r.toLowerCase());
    if (roles.includes('race_director') || roles.includes('admin')) {
      return 'race_director';
    }
    if (roles.includes('medic') || roles.includes('medical')) {
      return 'medic';
    }
    return 'operator';
  }

  /** F-018 BR-MI-32 — strip PII for non-medical roles. */
  private redactForRole(
    incident: MedicalIncidentDocument | IncidentResponseDto,
    actorRole: ActorRole,
  ): IncidentResponseDto {
    const raw = this.toResponse(incident);
    if (actorRole === 'medic' || actorRole === 'race_director') {
      return raw;
    }
    return {
      ...raw,
      athleteName: undefined,
      description: undefined,
      attachments: [],
      witnessStatements: raw.witnessStatements.map((w) => ({
        ...w,
        statement: undefined,
        contact: undefined,
      })),
    };
  }

  private toResponse(
    doc: MedicalIncidentDocument | IncidentResponseDto,
  ): IncidentResponseDto {
    // doc could be Mongoose doc OR plain object after .lean()
    // Cast safely.
    const d = doc as unknown as MedicalIncidentDocument & { _id: Types.ObjectId };
    if ((d as unknown as IncidentResponseDto).id) {
      return d as unknown as IncidentResponseDto;
    }
    return {
      id: d._id?.toString() ?? '',
      raceId: d.raceId,
      bib: d.bib,
      athleteName: d.athleteName,
      severity: d.severity,
      category: d.category,
      traumaSubtype: d.traumaSubtype,
      description: d.description,
      gpsLocation: {
        lat: d.gpsLocation.lat,
        lng: d.gpsLocation.lng,
        source: d.gpsLocation.source,
        aidStationId: d.gpsLocation.aidStationId,
        accuracyMeters: d.gpsLocation.accuracyMeters,
      },
      reportedByUserId: d.reportedByUserId,
      reportedAt: (d.reportedAt instanceof Date
        ? d.reportedAt.toISOString()
        : new Date(d.reportedAt).toISOString()),
      state: d.state,
      closureReason: d.closureReason,
      incidentTransitions: (d.incidentTransitions ?? []).map((t) => ({
        from: t.from,
        to: t.to,
        actorId: t.actorId,
        actorRole: t.actorRole,
        at: t.at instanceof Date ? t.at.toISOString() : new Date(t.at).toISOString(),
        reason: t.reason,
        gps: t.gps,
      })),
      medicalTeamAssigned: d.medicalTeamAssigned ?? [],
      witnessStatements: (d.witnessStatements ?? []).map((w) => ({
        name: w.name,
        statement: w.statement,
        contact: w.contact,
        signedAt:
          w.signedAt instanceof Date
            ? w.signedAt.toISOString()
            : new Date(w.signedAt).toISOString(),
      })),
      medicalDirectorSignature: d.medicalDirectorSignature
        ? {
            name: d.medicalDirectorSignature.name,
            signedAt:
              d.medicalDirectorSignature.signedAt instanceof Date
                ? d.medicalDirectorSignature.signedAt.toISOString()
                : new Date(d.medicalDirectorSignature.signedAt).toISOString(),
          }
        : undefined,
      attachments: (d.attachments ?? []).map((a) => ({
        s3Key: a.s3Key,
        mime: a.mime,
        sizeBytes: a.sizeBytes,
        uploadedAt:
          a.uploadedAt instanceof Date
            ? a.uploadedAt.toISOString()
            : new Date(a.uploadedAt).toISOString(),
      })),
      ambulanceETA: d.ambulanceETA
        ? d.ambulanceETA instanceof Date
          ? d.ambulanceETA.toISOString()
          : new Date(d.ambulanceETA).toISOString()
        : undefined,
      medicArrivedAt: d.medicArrivedAt
        ? d.medicArrivedAt instanceof Date
          ? d.medicArrivedAt.toISOString()
          : new Date(d.medicArrivedAt).toISOString()
        : undefined,
      outcome: d.outcome,
      anonymized: !!d.anonymized,
      latestPdfS3Key: d.latestPdfS3Key,
      createdAt:
        d.createdAt instanceof Date
          ? d.createdAt.toISOString()
          : new Date(d.createdAt ?? Date.now()).toISOString(),
      updatedAt:
        d.updatedAt instanceof Date
          ? d.updatedAt.toISOString()
          : new Date(d.updatedAt ?? Date.now()).toISOString(),
    };
  }

  /**
   * F-018 BR-MI-23..26 — create incident.
   * Validates: ≥1 of (bib/name/desc), Sev 4-5 photo required, "Khác" desc ≥10 chars.
   */
  async createIncident(
    raceId: string,
    mongoRaceId: string,
    dto: CreateIncidentDto,
    user: LogtoUser,
  ): Promise<IncidentResponseDto> {
    // BR-MI-24
    if (!dto.bib && !dto.athleteName && !dto.description) {
      throw new BadRequestException(
        'Cần ít nhất một trong: BIB, Tên VĐV, Mô tả',
      );
    }
    // BR-MI-10 — "Khác" requires ≥10 chars description.
    if (
      dto.category === 'other' &&
      (!dto.description || dto.description.trim().length < 10)
    ) {
      throw new BadRequestException(
        'Danh mục "Khác" yêu cầu mô tả tối thiểu 10 ký tự',
      );
    }
    // BR-MI-26 — Sev 4-5 photo required ≥1.
    if (
      (dto.severity === 4 || dto.severity === 5) &&
      (!dto.attachmentKeys || dto.attachmentKeys.length === 0)
    ) {
      throw new BadRequestException(
        'Cần tối thiểu 1 ảnh cho mức Nặng/Nguy kịch (Sev 4-5)',
      );
    }
    // BR-MI-08 — trauma sub-type required for trauma.
    if (dto.category === 'trauma' && !dto.traumaSubtype) {
      throw new BadRequestException(
        'Chấn thương yêu cầu chọn sub-type (Té ngã / Vết rách / Đầu / Khác)',
      );
    }

    const actorRole = this.deriveActorRole(user);
    const reportedAt = dto.reportedAt ? new Date(dto.reportedAt) : new Date();

    const created = await this.incidentModel.create({
      raceId,
      mongoRaceId: new Types.ObjectId(mongoRaceId),
      bib: dto.bib,
      athleteName: dto.athleteName,
      severity: dto.severity,
      category: dto.category,
      traumaSubtype: dto.traumaSubtype,
      description: dto.description,
      gpsLocation: dto.gpsLocation,
      reportedByUserId: user.userId,
      reportedAt,
      state: 'REPORTED',
      medicalTeamAssigned: dto.medicalTeamAssigned ?? [],
      witnessStatements: (dto.witnessStatements ?? []).map((w) => ({
        ...w,
        signedAt: new Date(),
      })),
      attachments: (dto.attachmentKeys ?? []).map((s3Key) => ({
        s3Key,
        mime: 'image/jpeg',
        sizeBytes: 0,
        uploadedAt: new Date(),
        uploadedByUserId: user.userId,
      })),
      // BR-MI-15 — initial transition INITIAL → REPORTED.
      incidentTransitions: [
        {
          from: 'INITIAL',
          to: 'REPORTED',
          actorId: user.userId,
          actorRole,
          at: reportedAt,
          reason: 'Initial report',
          gps: dto.gpsLocation,
        },
      ],
    });

    if (!created) {
      throw new BadRequestException('Tao su co that bai');
    }
    await this.invalidateActiveCount(raceId);
    const createdDoc = created as unknown as MedicalIncidentDocument & {
      _id: Types.ObjectId;
    };
    this.sse.emit('incident.created', raceId, {
      id: createdDoc._id.toString(),
      severity: createdDoc.severity,
      category: createdDoc.category,
      bib: createdDoc.bib,
      state: createdDoc.state,
    });

    return this.redactForRole(createdDoc, actorRole);
  }

  async listIncidents(
    raceId: string,
    filter: ListIncidentsFilterDto,
    user: LogtoUser,
  ): Promise<IncidentListResponseDto> {
    const actorRole = this.deriveActorRole(user);
    const q: Record<string, unknown> = { raceId };
    if (filter.severity?.length) q.severity = { $in: filter.severity };
    if (filter.state?.length) q.state = { $in: filter.state };
    if (filter.category) q.category = filter.category;
    if (filter.bib) q.bib = filter.bib;
    if (filter.since) q.reportedAt = { $gte: new Date(filter.since) };

    const limit = filter.limit ?? 50;
    const offset = filter.offset ?? 0;

    const [items, total, activeCount] = await Promise.all([
      this.incidentModel
        .find(q)
        .sort({ reportedAt: -1 })
        .skip(offset)
        .limit(limit)
        .lean(),
      this.incidentModel.countDocuments(q),
      this.getActiveCount(raceId),
    ]);

    return {
      items: items.map((i) =>
        this.redactForRole(i as MedicalIncidentDocument, actorRole),
      ),
      total,
      limit,
      offset,
      activeCount,
    };
  }

  async getIncident(
    raceId: string,
    id: string,
    user: LogtoUser,
  ): Promise<IncidentResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException();
    }
    const incident = await this.incidentModel.findOne({ _id: id, raceId });
    // BR-MI security IDOR: 404 not 403 (avoid info leak).
    if (!incident) throw new NotFoundException();
    const actorRole = this.deriveActorRole(user);
    if (
      (incident.severity === 4 || incident.severity === 5) &&
      actorRole === 'race_director'
    ) {
      this.logger.log(
        `[audit] Sev ${incident.severity} read by ${user.userId} (${actorRole}) — incident ${id}`,
      );
    }
    return this.redactForRole(incident, actorRole);
  }

  /**
   * F-018 BR-MI-11..16 — state transition.
   * - Forward-only matrix
   * - Sev 4-5 must hit MEDIC_ON_SITE OR AMB_REQUESTED before resolving
   * - FALSE_ALARM Race Director only
   * - Witness statements ≥2 for Sev 4-5 closure
   * - Lock via SETNX (concurrent transitions → 409)
   */
  async transitionStatus(
    raceId: string,
    id: string,
    dto: UpdateIncidentStatusDto,
    user: LogtoUser,
  ): Promise<IncidentResponseDto> {
    if (!Types.ObjectId.isValid(id)) {
      throw new NotFoundException();
    }
    // SETNX lock 5s.
    const lockKey = `medical:incident-lock:${id}`;
    const acquired = await this.redis.set(lockKey, user.userId, 'EX', LOCK_TTL, 'NX');
    if (!acquired) {
      throw new ConflictException(
        'Sự cố đang được cập nhật bởi người khác — thử lại sau vài giây',
      );
    }

    try {
      const incident = await this.incidentModel.findOne({ _id: id, raceId });
      if (!incident) throw new NotFoundException();

      const actorRole = this.deriveActorRole(user);
      const fromState = incident.state;
      const toState = dto.to;

      // Forward-only matrix.
      const allowed = TRANSITION_MATRIX[fromState] ?? [];
      if (!allowed.includes(toState)) {
        throw new BadRequestException(
          `Chuyển trạng thái không hợp lệ: ${fromState} → ${toState}. Cho phép: [${allowed.join(', ')}]`,
        );
      }

      // BR-MI-13 — Sev 4-5 must pass through MEDIC_ON_SITE OR AMB_REQUESTED before resolving.
      const isResolution =
        toState === 'RESOLVED_ONSITE' ||
        toState === 'RESOLVED_DNF' ||
        toState === 'CLOSED';
      if ((incident.severity === 4 || incident.severity === 5) && isResolution) {
        const hasGated = incident.incidentTransitions.some(
          (t) => t.to === 'MEDIC_ON_SITE' || t.to === 'AMB_REQUESTED',
        );
        if (!hasGated && fromState !== 'MEDIC_ON_SITE' && fromState !== 'AMB_REQUESTED') {
          throw new BadRequestException(
            'Sev 4-5 phải đi qua MEDIC_ON_SITE hoặc AMB_REQUESTED trước khi đóng',
          );
        }
      }

      // BR-MI-14 — closureReason required when entering CLOSED.
      if (toState === 'CLOSED') {
        if (!dto.closureReason) {
          throw new BadRequestException(
            'Cần chọn closure_reason khi đóng sự cố',
          );
        }
        // FALSE_ALARM is Race Director only.
        if (
          dto.closureReason === 'FALSE_ALARM' &&
          actorRole !== 'race_director'
        ) {
          throw new ForbiddenException(
            'Chỉ Race Director được phép đóng FALSE_ALARM',
          );
        }
      }

      // F-018 A2 — Sev 4-5 closure → ≥2 witness statements required.
      if (
        (incident.severity === 4 || incident.severity === 5) &&
        toState === 'CLOSED' &&
        dto.closureReason !== 'FALSE_ALARM'
      ) {
        const incomingWitnesses = dto.witnessStatements ?? [];
        const totalWitnesses =
          incident.witnessStatements.length + incomingWitnesses.length;
        if (totalWitnesses < 2) {
          throw new BadRequestException(
            'Sev 4-5 closure yêu cầu ≥2 nhân chứng (witness statements)',
          );
        }
      }

      // BR-MI-16 — reasonNote required for severity downgrade or FALSE_ALARM.
      if (
        dto.newSeverity &&
        dto.newSeverity < incident.severity &&
        !dto.reasonNote
      ) {
        throw new BadRequestException(
          'Hạ mức nghiêm trọng yêu cầu reason_note',
        );
      }
      if (dto.closureReason === 'FALSE_ALARM' && !dto.reasonNote) {
        throw new BadRequestException(
          'closure_reason=FALSE_ALARM yêu cầu reason_note',
        );
      }

      // F-018 A3 — typed-name signature required at CLOSED transition.
      const incomingSignature =
        dto.medicalDirectorSignature ?? incident.medicalDirectorSignature;
      if (toState === 'CLOSED' && !incomingSignature) {
        throw new BadRequestException(
          'CLOSED transition yêu cầu medicalDirectorSignature (typed name + signedAt)',
        );
      }

      // Apply: APPEND to incidentTransitions[] (NEVER mutate existing entries).
      const transition = {
        from: fromState,
        to: toState,
        actorId: user.userId,
        actorRole,
        at: new Date(),
        reason: dto.reasonNote,
        gps: dto.gps,
      };

      const update: Record<string, unknown> = {
        $set: {
          state: toState,
        },
        $push: { incidentTransitions: transition },
      };
      const $set = update.$set as Record<string, unknown>;

      if (toState === 'CLOSED') {
        $set.closureReason = dto.closureReason;
      }
      if (dto.newSeverity) {
        $set.severity = dto.newSeverity;
      }
      if (dto.medicsToAssign?.length) {
        update.$addToSet = {
          medicalTeamAssigned: { $each: dto.medicsToAssign },
        };
      }
      if (dto.witnessStatements?.length) {
        const existing = (update.$push as Record<string, unknown>);
        existing.witnessStatements = {
          $each: dto.witnessStatements.map((w) => ({
            ...w,
            signedAt: new Date(),
          })),
        };
      }
      if (dto.medicalDirectorSignature) {
        $set.medicalDirectorSignature = {
          name: dto.medicalDirectorSignature.name,
          signedAt: new Date(dto.medicalDirectorSignature.signedAt),
        };
      }
      if (toState === 'MEDIC_ON_SITE') {
        $set.medicArrivedAt = new Date();
      }

      const updated = await this.incidentModel.findOneAndUpdate(
        { _id: id, raceId, state: fromState }, // optimistic lock — state must still match
        update,
        { new: true },
      );

      if (!updated) {
        throw new ConflictException(
          'Sự cố đã thay đổi trạng thái — refresh và thử lại',
        );
      }

      await this.invalidateActiveCount(raceId);
      this.sse.emit('incident.state_changed', raceId, {
        id,
        from: fromState,
        to: toState,
        severity: updated.severity,
      });
      if (dto.newSeverity && dto.newSeverity > incident.severity) {
        this.sse.emit('incident.severity_escalated', raceId, {
          id,
          from: incident.severity,
          to: dto.newSeverity,
        });
      }

      return this.redactForRole(updated, actorRole);
    } finally {
      // Best-effort lock release (TTL guarantees eviction even on crash).
      await this.redis.del(lockKey).catch(() => undefined);
    }
  }

  // BR-MI active-count cache.
  private async getActiveCount(raceId: string): Promise<number> {
    const key = `medical:race:${raceId}:active-count`;
    const cached = await this.redis.get(key);
    if (cached !== null) return parseInt(cached, 10);
    const count = await this.incidentModel.countDocuments({
      raceId,
      state: { $in: Array.from(ACTIVE_STATES) },
    });
    await this.redis.set(key, count.toString(), 'EX', ACTIVE_COUNT_TTL);
    return count;
  }

  private async invalidateActiveCount(raceId: string): Promise<void> {
    await this.redis.del(`medical:race:${raceId}:active-count`).catch(() => undefined);
  }

  /** Internal: list raw docs for PDF generator (medical role only). */
  async findForPdf(raceId: string, ids?: string[]): Promise<MedicalIncidentDocument[]> {
    const q: Record<string, unknown> = { raceId };
    if (ids?.length) {
      q._id = { $in: ids.filter((i) => Types.ObjectId.isValid(i)) };
    }
    return this.incidentModel.find(q).sort({ reportedAt: 1 }).lean();
  }

  /** Internal helper for tests — exposes transition matrix. */
  static getAllowedTransitions(from: IncidentState): IncidentState[] {
    return [...(TRANSITION_MATRIX[from] ?? [])];
  }

  static isActiveState(state: IncidentState): boolean {
    return ACTIVE_STATES.has(state);
  }
}
