import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectModel } from '@nestjs/mongoose';
import { InjectRedis } from '@nestjs-modules/ioredis';
import { Model, Types } from 'mongoose';
import Redis from 'ioredis';
import { randomBytes } from 'crypto';
import {
  ChipMapping,
  ChipMappingDocument,
} from '../schemas/chip-mapping.schema';
import { RaceAthleteLookupService } from '../../race-master-data/services/race-athlete-lookup.service';
import { parseCsv, ParsedCsvRow } from '../utils/csv-parser';
import {
  hasFormulaInjection,
  normalizeChipId,
} from '../utils/normalize';
import {
  CHIP_PREVIEW_TTL_SECONDS,
  ChipRedisKeys,
} from '../utils/redis-keys';
import {
  ChipMappingItemDto,
  ListChipMappingsQueryDto,
  ListChipMappingsResponseDto,
  UpdateChipMappingDto,
} from '../dto/chip-mapping.dto';
import {
  ConfirmImportResponseDto,
  ImportPreviewResponseDto,
} from '../dto/import-chip-mapping.dto';

const MAX_CSV_ROWS = 5000;
// Chip IDs có nhiều format trong thực tế: pure hex (E20034125678),
// alphanumeric với hyphen (Y-359, B-12345), pure numeric (1234567890),
// underscore-separated (CHIP_ABC). Cho phép `-` và `_` ngoài alphanumeric.
// Formula injection (= + - @ tab CR ') được check riêng trong
// hasFormulaInjection() — KHÔNG conflict vì regex này dùng SAU normalize +
// formula check.
const CHIP_ID_REGEX = /^[A-Z0-9][A-Z0-9_-]{2,31}$/;
const BIB_REGEX = /^[A-Za-z0-9_-]{1,32}$/;

interface PreviewBlob {
  raceId: number;
  byUserId: string;
  valid: { chip_id: string; bib_number: string }[];
  toCreate: number;
  toUpdate: number;
  toSkip: number;
}

@Injectable()
export class ChipMappingService {
  private readonly logger = new Logger(ChipMappingService.name);

  constructor(
    @InjectModel(ChipMapping.name)
    private readonly chipMappingModel: Model<ChipMappingDocument>,
    private readonly raceAthleteLookup: RaceAthleteLookupService,
    @InjectRedis() private readonly redis: Redis,
  ) {}

  // ─────────── CSV IMPORT ───────────

  async previewImport(
    raceId: number,
    byUserId: string,
    fileBuffer: Buffer,
  ): Promise<ImportPreviewResponseDto> {
    if (!fileBuffer || fileBuffer.length === 0) {
      throw new BadRequestException('Empty file');
    }

    const parsed = parseCsv(fileBuffer);
    if (parsed.errors.length > 0 && parsed.rows.length === 0) {
      // Header errors — fail fast
      throw new BadRequestException(
        `CSV parse failed: ${parsed.errors[0].reason}`,
      );
    }

    if (parsed.rows.length > MAX_CSV_ROWS) {
      throw new PayloadTooLargeException(
        `CSV exceeds ${MAX_CSV_ROWS} rows. Split file or contact admin.`,
      );
    }

    const errors: { row: number; reason: string }[] = [...parsed.errors];
    const warnings: { row: number; reason: string }[] = [];
    const valid: { chip_id: string; bib_number: string; lineNo: number }[] = [];
    const seenChipInFile = new Map<string, number>(); // chip_id → first lineNo
    const seenBibInFile = new Map<string, number>(); // NEW-1 fix: bib_number → first lineNo

    for (const row of parsed.rows) {
      // 1. Empty / required check
      if (!row.chip_id || !row.bib_number) {
        errors.push({
          row: row.lineNo,
          reason: 'chip_id or bib_number is empty',
        });
        continue;
      }

      // 2. Formula injection (MUST-DO #8 — extended regex)
      if (hasFormulaInjection(row.chip_id)) {
        errors.push({
          row: row.lineNo,
          reason: `Formula injection detected in chip_id: ${row.chip_id.slice(0, 12)}`,
        });
        continue;
      }
      if (hasFormulaInjection(row.bib_number)) {
        errors.push({
          row: row.lineNo,
          reason: `Formula injection detected in bib_number`,
        });
        continue;
      }

      const chipId = normalizeChipId(row.chip_id);
      const bib = row.bib_number.trim();

      // 3. Format
      if (!CHIP_ID_REGEX.test(chipId)) {
        errors.push({
          row: row.lineNo,
          reason: `Invalid chip_id format (expected 4-32 alphanumeric): ${row.chip_id}`,
        });
        continue;
      }
      if (!BIB_REGEX.test(bib)) {
        errors.push({
          row: row.lineNo,
          reason: `Invalid bib_number format: ${bib}`,
        });
        continue;
      }

      // 4. In-file duplicate chip_id (QC original test case)
      if (seenChipInFile.has(chipId)) {
        errors.push({
          row: row.lineNo,
          reason: `Duplicate chip_id ${chipId} (first appears at row ${seenChipInFile.get(chipId)})`,
        });
        continue;
      }

      // NEW-1 fix: in-file duplicate bib_number → reject before bulkWrite
      // catches it as a misleading "concurrent import" error.
      if (seenBibInFile.has(bib)) {
        errors.push({
          row: row.lineNo,
          reason: `Duplicate bib_number ${bib} in file (first appears at row ${seenBibInFile.get(bib)})`,
        });
        continue;
      }

      seenChipInFile.set(chipId, row.lineNo);
      seenBibInFile.set(bib, row.lineNo);

      valid.push({ chip_id: chipId, bib_number: bib, lineNo: row.lineNo });
    }

    if (valid.length === 0) {
      return {
        totalRows: parsed.rows.length,
        valid: 0,
        toCreate: 0,
        toUpdate: 0,
        toSkip: 0,
        swapDeletes: 0,
        errors,
        warnings,
        previewToken: '',
      };
    }

    // 5. Verify BIB exists in race via master data (cache-fast lookup,
    //    no direct MySQL query). Master data fetches Redis → Mongo →
    //    MySQL fallback. CSV import có cap 5K rows so well within
    //    lookupBibs limit (1000 per call) — chunk if needed.
    const bibSet = Array.from(new Set(valid.map((v) => v.bib_number)));
    const existingBibs = new Set<string>();
    for (let i = 0; i < bibSet.length; i += 1000) {
      const chunk = bibSet.slice(i, i + 1000);
      const found = await this.raceAthleteLookup.lookupBibs(raceId, chunk);
      for (const bib of found.keys()) existingBibs.add(bib);
    }

    const validFiltered: { chip_id: string; bib_number: string; lineNo: number }[] =
      [];
    for (const v of valid) {
      if (!existingBibs.has(v.bib_number)) {
        // BUG #6 fix — split into warnings (allowed but flagged) instead of
        // errors (blocked). For pilot pre-assigned BIB workflow we ALLOW
        // unknown bib (BIB might be pre-printed but not yet in athletes
        // table — tolerate per BR-11).
        warnings.push({
          row: v.lineNo,
          reason: `BIB ${v.bib_number} not yet in athletes table — will resolve at lookup time`,
        });
      }
      validFiltered.push(v);
    }

    // 6. Classify create / update / skip + detect bib swaps
    //    Query existing mappings by chip OR by bib (BUG #2 — swap detection
    //    needs bib lookup too).
    const existingMappings = await this.chipMappingModel
      .find({
        mysql_race_id: raceId,
        deleted: false,
        $or: [
          { chip_id: { $in: validFiltered.map((v) => v.chip_id) } },
          { bib_number: { $in: validFiltered.map((v) => v.bib_number) } },
        ],
      })
      .select({ chip_id: 1, bib_number: 1 })
      .lean<{ chip_id: string; bib_number: string }[]>()
      .exec();

    const existingByChip = new Map(
      existingMappings.map((e) => [e.chip_id, e.bib_number]),
    );
    const existingByBib = new Map(
      existingMappings.map((e) => [e.bib_number, e.chip_id]),
    );

    let toCreate = 0;
    let toUpdate = 0;
    let toSkip = 0;
    let swapDeletes = 0;
    for (const v of validFiltered) {
      const curBib = existingByChip.get(v.chip_id);
      if (curBib === undefined) toCreate += 1;
      else if (curBib !== v.bib_number) toUpdate += 1;
      else toSkip += 1;

      // Bib reassignment — another chip currently holds this bib_number.
      const bibHolder = existingByBib.get(v.bib_number);
      if (bibHolder && bibHolder !== v.chip_id) {
        swapDeletes += 1;
        warnings.push({
          row: v.lineNo,
          reason: `BIB ${v.bib_number} currently held by chip ${bibHolder} — old mapping will be soft-deleted on confirm`,
        });
      }
    }

    // 7. Cache preview blob in Redis with TTL 10m
    const previewToken = randomBytes(16).toString('base64url');
    const blob: PreviewBlob = {
      raceId,
      byUserId,
      valid: validFiltered.map((v) => ({
        chip_id: v.chip_id,
        bib_number: v.bib_number,
      })),
      toCreate,
      toUpdate,
      toSkip,
    };
    await this.redis.set(
      ChipRedisKeys.preview(previewToken),
      JSON.stringify(blob),
      'EX',
      CHIP_PREVIEW_TTL_SECONDS,
    );

    return {
      totalRows: parsed.rows.length,
      valid: validFiltered.length,
      toCreate,
      toUpdate,
      toSkip,
      swapDeletes,
      errors,
      warnings,
      previewToken,
    };
  }

  /**
   * Confirm phase: read preview blob → bulk upsert → return imported count.
   * Cache patch is delegated to ChipCacheService (called from controller).
   */
  async confirmImport(
    previewToken: string,
    raceId: number,
    byUserId: string,
  ): Promise<{ imported: number; mappings: { chip_id: string; bib_number: string }[] }> {
    const dataStr = await this.redis.get(ChipRedisKeys.preview(previewToken));
    if (!dataStr) {
      this.logger.warn(
        `[confirmImport] preview not found in Redis token=${previewToken.slice(0, 8)}... race=${raceId} by=${byUserId}`,
      );
      throw new BadRequestException('Preview expired or invalid');
    }
    const blob = JSON.parse(dataStr) as PreviewBlob;

    // Defense in depth: verify race scope (BR-02)
    if (blob.raceId !== raceId) {
      this.logger.warn(
        `[confirmImport] race mismatch blob=${blob.raceId} url=${raceId} token=${previewToken.slice(0, 8)}...`,
      );
      throw new ForbiddenException('Preview token belongs to different race');
    }
    if (blob.byUserId !== byUserId) {
      this.logger.warn(
        `[confirmImport] user mismatch blob=${blob.byUserId} req=${byUserId} token=${previewToken.slice(0, 8)}...`,
      );
      throw new ForbiddenException('Preview token belongs to different user');
    }

    if (blob.valid.length === 0) {
      return { imported: 0, mappings: [] };
    }

    // BUG #2 fix — two-phase to handle chip-BIB swaps without unique index conflicts.
    //
    // Why: composite UNIQUE on (mysql_race_id, bib_number) where deleted=false.
    // If import swaps bib between two existing chips (A: 100→200, B: 200→100),
    // a single bulkWrite hits unique conflicts because the old assignments
    // still exist when the new ones try to write. With ordered:false those
    // errors are SILENT — DB unchanged but caller thinks import succeeded.
    //
    // Phase 1: pre-soft-delete any existing mapping whose bib_number is being
    //          claimed by a DIFFERENT chip in this import.
    // Phase 2: bulk upsert — now no unique conflicts can occur.
    // Phase 3: read bulkWrite result — if any unexpected write errors remain
    //          (concurrent import on same race), throw 400.

    const importedChips = blob.valid.map((v) => v.chip_id);
    const importedBibs = blob.valid.map((v) => v.bib_number);

    const existingDocs = await this.chipMappingModel
      .find({
        mysql_race_id: blob.raceId,
        deleted: false,
        $or: [
          { chip_id: { $in: importedChips } },
          { bib_number: { $in: importedBibs } },
        ],
      })
      .select({ _id: 1, chip_id: 1, bib_number: 1 })
      .lean<
        { _id: Types.ObjectId; chip_id: string; bib_number: string }[]
      >()
      .exec();

    const docByBib = new Map<string, { _id: Types.ObjectId; chip_id: string }>();
    for (const d of existingDocs) {
      docByBib.set(d.bib_number, { _id: d._id, chip_id: d.chip_id });
    }

    // Identify docs whose bib_number is being reassigned to a different chip.
    const idsToSoftDelete: Types.ObjectId[] = [];
    for (const v of blob.valid) {
      const holder = docByBib.get(v.bib_number);
      if (holder && holder.chip_id !== v.chip_id) {
        idsToSoftDelete.push(holder._id);
      }
    }

    if (idsToSoftDelete.length > 0) {
      await this.chipMappingModel.updateMany(
        { _id: { $in: idsToSoftDelete }, deleted: false },
        {
          $set: {
            deleted: true,
            deleted_at: new Date(),
            deleted_by_user_id: byUserId,
          },
        },
      );
      this.logger.log(
        `[CSV import] race=${blob.raceId} pre-soft-deleted ${idsToSoftDelete.length} mapping(s) for bib reassignment`,
      );
    }

    const ops = blob.valid.map((v) => ({
      updateOne: {
        filter: {
          mysql_race_id: blob.raceId,
          chip_id: v.chip_id,
          deleted: false,
        },
        update: {
          $set: {
            bib_number: v.bib_number,
            status: 'ACTIVE' as const,
            imported_by_user_id: byUserId,
          },
          $setOnInsert: {
            mysql_race_id: blob.raceId,
            chip_id: v.chip_id,
            deleted: false,
          },
        },
        upsert: true,
      },
    }));

    let writeResult;
    try {
      writeResult = await this.chipMappingModel.bulkWrite(ops, {
        ordered: false,
      });
    } catch (err) {
      // Mongoose throws a MongoBulkWriteError when ANY op fails (even with
      // ordered:false). The result is attached to the error.
      const e = err as {
        message?: string;
        result?: {
          hasWriteErrors?: () => boolean;
          getWriteErrors?: () => Array<{ errmsg: string; index: number }>;
        };
      };
      const writeErrs = e.result?.getWriteErrors?.() ?? [];
      this.logger.error(
        `[CSV import] race=${blob.raceId} bulkWrite threw: ${e.message ?? 'unknown'} writeErrors=${writeErrs.length}` +
          (writeErrs[0] ? ` first=${writeErrs[0].errmsg}` : ''),
      );
      throw new BadRequestException(
        writeErrs.length > 0
          ? `Import failed: ${writeErrs.length} chip(s) conflict — ${writeErrs[0].errmsg.slice(0, 200)}`
          : `Import failed: ${e.message ?? 'unknown bulk write error'}`,
      );
    }

    const writeErrors =
      typeof writeResult.hasWriteErrors === 'function' &&
      writeResult.hasWriteErrors()
        ? writeResult.getWriteErrors()
        : [];

    if (writeErrors.length > 0) {
      this.logger.error(
        `[CSV import] race=${blob.raceId} bulkWrite returned ${writeErrors.length} write errors: ${writeErrors[0].errmsg}`,
      );
      throw new BadRequestException(
        `Import partially failed: ${writeErrors.length} chip(s) — ${writeErrors[0].errmsg.slice(0, 200)}`,
      );
    }

    await this.redis.del(ChipRedisKeys.preview(previewToken));

    this.logger.log(
      `[CSV import] race=${raceId} by=${byUserId} imported=${blob.valid.length} swapped=${idsToSoftDelete.length}`,
    );

    return { imported: blob.valid.length, mappings: blob.valid };
  }

  // ─────────── LIST / EDIT / DELETE ───────────

  async list(
    raceId: number,
    query: ListChipMappingsQueryDto,
  ): Promise<ListChipMappingsResponseDto> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? 50;

    const filter: Record<string, unknown> = {
      mysql_race_id: raceId,
      deleted: false,
    };
    if (query.search) {
      const s = query.search.trim();
      const sUpper = s.toUpperCase();
      filter.$or = [
        { chip_id: { $regex: `^${escapeRegex(sUpper)}` } },
        { bib_number: { $regex: `^${escapeRegex(s)}` } },
      ];
    }

    const [items, total] = await Promise.all([
      this.chipMappingModel
        .find(filter)
        .sort({ updated_at: -1 })
        .skip((page - 1) * pageSize)
        .limit(pageSize)
        .lean<
          (ChipMapping & { _id: Types.ObjectId; created_at: Date; updated_at: Date })[]
        >()
        .exec(),
      this.chipMappingModel.countDocuments(filter).exec(),
    ]);

    return {
      items: items.map((d): ChipMappingItemDto => ({
        id: d._id.toString(),
        mysql_race_id: d.mysql_race_id,
        chip_id: d.chip_id,
        bib_number: d.bib_number,
        status: d.status,
        created_at: d.created_at,
        updated_at: d.updated_at,
      })),
      total,
      page,
      pageSize,
    };
  }

  /** Verify mapping belongs to raceId (BR-08 multi-tenant isolation). */
  async update(
    mappingId: string,
    raceId: number,
    body: UpdateChipMappingDto,
  ): Promise<ChipMappingItemDto> {
    if (!Types.ObjectId.isValid(mappingId)) {
      throw new BadRequestException('Invalid mapping id');
    }
    const doc = await this.chipMappingModel
      .findOne({ _id: mappingId, deleted: false })
      .exec();
    if (!doc) throw new NotFoundException('Mapping not found');
    if (doc.mysql_race_id !== raceId) {
      throw new ForbiddenException('Mapping does not belong to this race');
    }

    if (body.chip_id !== undefined) {
      doc.chip_id = normalizeChipId(body.chip_id);
    }
    if (body.bib_number !== undefined) doc.bib_number = body.bib_number.trim();
    if (body.status !== undefined) doc.status = body.status;

    await doc.save();
    // Re-query as lean to get timestamps with proper typing.
    const saved = await this.chipMappingModel
      .findById(doc._id)
      .lean<
        ChipMapping & { _id: Types.ObjectId; created_at: Date; updated_at: Date }
      >()
      .exec();
    if (!saved) throw new NotFoundException('Mapping vanished after save');
    return {
      id: saved._id.toString(),
      mysql_race_id: saved.mysql_race_id,
      chip_id: saved.chip_id,
      bib_number: saved.bib_number,
      status: saved.status,
      created_at: saved.created_at,
      updated_at: saved.updated_at,
    };
  }

  async softDelete(
    mappingId: string,
    raceId: number,
    byUserId: string,
  ): Promise<{ chip_id: string; bib_number: string }> {
    if (!Types.ObjectId.isValid(mappingId)) {
      throw new BadRequestException('Invalid mapping id');
    }
    const doc = await this.chipMappingModel
      .findOne({ _id: mappingId, deleted: false })
      .exec();
    if (!doc) throw new NotFoundException('Mapping not found');
    if (doc.mysql_race_id !== raceId) {
      throw new ForbiddenException('Mapping does not belong to this race');
    }

    doc.deleted = true;
    doc.deleted_at = new Date();
    doc.deleted_by_user_id = byUserId;
    await doc.save();
    return { chip_id: doc.chip_id, bib_number: doc.bib_number };
  }

  /** Used by ChipCacheService.preload — returns all active mappings for race. */
  async listAllActive(
    raceId: number,
  ): Promise<{ chip_id: string; bib_number: string }[]> {
    return this.chipMappingModel
      .find({ mysql_race_id: raceId, deleted: false, status: 'ACTIVE' })
      .select({ chip_id: 1, bib_number: 1, _id: 0 })
      .lean<{ chip_id: string; bib_number: string }[]>()
      .exec();
  }

  async findByChipId(
    raceId: number,
    chipId: string,
  ): Promise<ChipMappingDocument | null> {
    return this.chipMappingModel
      .findOne({
        mysql_race_id: raceId,
        chip_id: chipId,
        deleted: false,
      })
      .exec();
  }
}

function escapeRegex(s: string): string {
  return s.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}
