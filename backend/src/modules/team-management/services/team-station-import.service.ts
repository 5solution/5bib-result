import {
  BadRequestException,
  Injectable,
  Logger,
  NotFoundException,
  PayloadTooLargeException,
} from '@nestjs/common';
import { InjectRepository } from '@nestjs/typeorm';
import { Repository } from 'typeorm';
import * as Papa from 'papaparse';
import * as XLSX from 'xlsx';
import * as ExcelJS from 'exceljs';

import { VolTeamCategory } from '../entities/vol-team-category.entity';
import { VolStation } from '../entities/vol-station.entity';
import {
  ImportStationsResponseDto,
  ImportStationsRowErrorDto,
  ImportStationsRowInsertedDto,
  ImportStationsRowSkippedDto,
} from '../dto/import-stations.dto';
import { TeamCacheService } from './team-cache.service';

const MAX_ROWS = 500;
const MAX_FILE_BYTES = 2 * 1024 * 1024; // 2 MB
const CSV_MIMETYPES = new Set([
  'text/csv',
  'application/csv',
  'application/vnd.ms-excel',
  'text/plain',
]);
const XLSX_MIMETYPE =
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet';

type RawRow = Record<string, string>;

/**
 * v1.9 — Station bulk import.
 *
 * Import scope is per-category (team) — :categoryId from the route.
 * Template columns: station_name *, location_description, gps_lat,
 * gps_lng, sort_order.
 *
 * Duplicate rule: same station_name (case-insensitive) in the same
 * category is skipped (not an error).
 */
@Injectable()
export class TeamStationImportService {
  private readonly logger = new Logger(TeamStationImportService.name);

  constructor(
    @InjectRepository(VolTeamCategory, 'volunteer')
    private readonly categoryRepo: Repository<VolTeamCategory>,
    @InjectRepository(VolStation, 'volunteer')
    private readonly stationRepo: Repository<VolStation>,
    private readonly cache: TeamCacheService,
  ) {}

  // ─────────────────────────────────────────────────────────────────────
  // TEMPLATE
  // ─────────────────────────────────────────────────────────────────────

  async generateTemplateXlsx(categoryId: number): Promise<Buffer> {
    const category = await this.categoryRepo.findOne({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Team (category) không tồn tại');

    const wb = new ExcelJS.Workbook();
    wb.creator = '5BIB Team Management';
    wb.created = new Date();

    const ws = wb.addWorksheet('Trạm');
    const columns: Array<{
      header: string;
      key: string;
      width: number;
      required: boolean;
    }> = [
      {
        header: 'station_name *',
        key: 'station_name',
        width: 36,
        required: true,
      },
      {
        header: 'location_description',
        key: 'location_description',
        width: 50,
        required: false,
      },
      { header: 'gps_lat', key: 'gps_lat', width: 16, required: false },
      { header: 'gps_lng', key: 'gps_lng', width: 16, required: false },
      {
        header: 'sort_order (số nguyên ≥ 0)',
        key: 'sort_order',
        width: 22,
        required: false,
      },
    ];
    ws.columns = columns.map((c) => ({
      header: c.header,
      key: c.key,
      width: c.width,
    }));

    const headerRow = ws.getRow(1);
    headerRow.font = { bold: true, color: { argb: 'FFFFFFFF' } };
    headerRow.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FF1F2937' },
    };
    headerRow.alignment = { vertical: 'middle', horizontal: 'left' };
    headerRow.height = 22;
    // Required column (station_name) gets a red header cell.
    const requiredCell = headerRow.getCell(1);
    requiredCell.fill = {
      type: 'pattern',
      pattern: 'solid',
      fgColor: { argb: 'FFB91C1C' },
    };

    // Example rows
    ws.addRow({
      station_name: 'Trạm Nước Km5',
      location_description: 'Gần cọc km 5, cạnh suối',
      gps_lat: '21.0285',
      gps_lng: '105.8042',
      sort_order: 10,
    });
    ws.addRow({
      station_name: 'Trạm Y Tế Đỉnh',
      location_description: 'Đỉnh núi, gần chốt kiểm tra',
      gps_lat: '',
      gps_lng: '',
      sort_order: 20,
    });
    ws.getRow(2).font = { italic: true, color: { argb: 'FF6B7280' } };
    ws.getRow(3).font = { italic: true, color: { argb: 'FF6B7280' } };
    ws.views = [{ state: 'frozen', ySplit: 1 }];

    // Info sheet
    const infoWs = wb.addWorksheet('Hướng dẫn');
    infoWs.getCell('A1').value = `Template import trạm cho team: ${category.name}`;
    infoWs.getCell('A1').font = { bold: true, size: 13 };
    infoWs.getCell('A3').value =
      'Điền danh sách trạm vào sheet "Trạm". Cột station_name là bắt buộc.';
    infoWs.getCell('A4').value =
      'Trạm trùng tên (cùng team) sẽ bị bỏ qua không báo lỗi.';
    infoWs.getCell('A5').value =
      'gps_lat / gps_lng là tọa độ thập phân (VD: 21.028511 / 105.804817). Để trống nếu không có.';
    infoWs.getCell('A6').value = 'sort_order: số nguyên ≥ 0, mặc định 0 nếu để trống.';
    infoWs.getColumn('A').width = 80;

    const arrayBuffer = await wb.xlsx.writeBuffer();
    return Buffer.from(arrayBuffer as ArrayBuffer);
  }

  // ─────────────────────────────────────────────────────────────────────
  // IMPORT
  // ─────────────────────────────────────────────────────────────────────

  async importStations(
    categoryId: number,
    file: Express.Multer.File | undefined,
    actorLabel: string,
  ): Promise<ImportStationsResponseDto> {
    const category = await this.categoryRepo.findOne({
      where: { id: categoryId },
    });
    if (!category) throw new NotFoundException('Team (category) không tồn tại');

    const rawRows = this.parseFile(file);

    // Existing stations in this category → for DB duplicate detection.
    const existing = await this.stationRepo.find({
      where: { category_id: categoryId },
      select: { id: true, station_name: true },
    });
    const existingNameSet = new Set(
      existing.map((s) => s.station_name.trim().toLowerCase()),
    );

    const inserted: ImportStationsRowInsertedDto[] = [];
    const skipped: ImportStationsRowSkippedDto[] = [];
    const errors: ImportStationsRowErrorDto[] = [];
    const seenInFile = new Set<string>();

    type Candidate = {
      row: number;
      station_name: string;
      location_description: string | null;
      gps_lat: number | null;
      gps_lng: number | null;
      sort_order: number;
    };
    const toInsert: Candidate[] = [];

    rawRows.forEach((raw, idx) => {
      const row = idx + 1;
      const rowErrors: string[] = [];

      const station_name = String(raw.station_name ?? '').trim();
      const location_description =
        String(raw.location_description ?? '').trim() || null;
      const gpsLatRaw = String(raw.gps_lat ?? '').trim();
      const gpsLngRaw = String(raw.gps_lng ?? '').trim();
      const sortRaw = String(raw.sort_order ?? '').trim();

      if (!station_name) rowErrors.push('Thiếu station_name');
      if (station_name.length > 200) rowErrors.push('station_name vượt 200 ký tự');
      if (location_description && location_description.length > 1000) {
        rowErrors.push('location_description vượt 1000 ký tự');
      }

      let gps_lat: number | null = null;
      if (gpsLatRaw !== '') {
        const n = parseFloat(gpsLatRaw);
        if (isNaN(n) || n < -90 || n > 90) {
          rowErrors.push('gps_lat phải là số thập phân trong khoảng -90 đến 90');
        } else {
          gps_lat = n;
        }
      }

      let gps_lng: number | null = null;
      if (gpsLngRaw !== '') {
        const n = parseFloat(gpsLngRaw);
        if (isNaN(n) || n < -180 || n > 180) {
          rowErrors.push('gps_lng phải là số thập phân trong khoảng -180 đến 180');
        } else {
          gps_lng = n;
        }
      }

      let sort_order = 0;
      if (sortRaw !== '') {
        const n = Number(sortRaw);
        if (!Number.isFinite(n) || !Number.isInteger(n) || n < 0) {
          rowErrors.push('sort_order phải là số nguyên ≥ 0');
        } else {
          sort_order = n;
        }
      }

      if (rowErrors.length > 0) {
        errors.push({ row, errors: rowErrors });
        return;
      }

      const key = station_name.toLowerCase();
      if (seenInFile.has(key)) {
        skipped.push({ row, station_name, reason: 'duplicate_in_file' });
        return;
      }
      seenInFile.add(key);

      if (existingNameSet.has(key)) {
        skipped.push({ row, station_name, reason: 'duplicate_in_db' });
        return;
      }

      toInsert.push({
        row,
        station_name,
        location_description,
        gps_lat,
        gps_lng,
        sort_order,
      });
    });

    // Sequential inserts (capped at MAX_ROWS — performance is fine).
    for (const c of toInsert) {
      try {
        const saved = await this.stationRepo.save(
          this.stationRepo.create({
            category_id: categoryId,
            event_id: category.event_id,
            station_name: c.station_name,
            location_description: c.location_description,
            gps_lat:
              c.gps_lat !== null ? c.gps_lat.toFixed(7) : null,
            gps_lng:
              c.gps_lng !== null ? c.gps_lng.toFixed(7) : null,
            sort_order: c.sort_order,
            status: 'setup',
            is_active: false,
          }),
        );
        inserted.push({ row: c.row, id: saved.id, station_name: saved.station_name });
      } catch (err) {
        const msg = (err as Error).message ?? '';
        if (/unique|duplicate/i.test(msg)) {
          skipped.push({
            row: c.row,
            station_name: c.station_name,
            reason: 'duplicate_in_db',
          });
        } else {
          errors.push({ row: c.row, errors: [`Lỗi lưu DB: ${msg}`] });
        }
      }
    }

    if (inserted.length > 0) {
      await this.cache.invalidateStations(category.event_id, categoryId);
    }

    this.logger.log(
      `[STATION-IMPORT] category=${categoryId} total=${rawRows.length} inserted=${inserted.length} skipped=${skipped.length} errors=${errors.length} by=${actorLabel}`,
    );

    return { total_rows: rawRows.length, inserted, skipped, errors };
  }

  // ─────────────────────────────────────────────────────────────────────
  // PARSING (mirrors team-supply-item-import logic)
  // ─────────────────────────────────────────────────────────────────────

  private parseFile(file: Express.Multer.File | undefined): RawRow[] {
    if (!file) throw new BadRequestException('Thiếu file upload');
    if (file.size > MAX_FILE_BYTES) {
      throw new PayloadTooLargeException('File quá lớn (tối đa 2MB)');
    }

    const name = (file.originalname ?? '').toLowerCase();
    const isCsv =
      name.endsWith('.csv') || CSV_MIMETYPES.has(file.mimetype ?? '');
    const isXlsx =
      name.endsWith('.xlsx') || file.mimetype === XLSX_MIMETYPE;

    if (name.endsWith('.xls') && !name.endsWith('.xlsx')) {
      throw new BadRequestException(
        'Không hỗ trợ .xls cũ — dùng .xlsx hoặc .csv',
      );
    }

    let rows: RawRow[];
    try {
      if (isXlsx) rows = this.parseXlsx(file.buffer);
      else if (isCsv) rows = this.parseCsv(file.buffer);
      else throw new BadRequestException('Chỉ hỗ trợ .csv và .xlsx');
    } catch (err) {
      if (err instanceof BadRequestException) throw err;
      throw new BadRequestException('File không đọc được');
    }

    // Filter empty rows
    const nonEmpty = rows.filter((r) =>
      Object.values(r).some((v) => v !== '' && v != null),
    );
    if (nonEmpty.length === 0) {
      throw new BadRequestException('File trống hoặc chỉ có header');
    }
    if (nonEmpty.length > MAX_ROWS) {
      throw new BadRequestException(
        `File có ${nonEmpty.length} dòng, vượt giới hạn ${MAX_ROWS}`,
      );
    }
    return nonEmpty;
  }

  private parseXlsx(buffer: Buffer): RawRow[] {
    const wb = XLSX.read(buffer, { type: 'buffer' });
    const ws = wb.Sheets[wb.SheetNames[0]];
    if (!ws) throw new BadRequestException('File XLSX không có sheet nào');
    return XLSX.utils.sheet_to_json<RawRow>(ws, {
      defval: '',
      raw: false,
    });
  }

  private parseCsv(buffer: Buffer): RawRow[] {
    const text = buffer.toString('utf8').replace(/^\uFEFF/, ''); // strip BOM
    const result = Papa.parse<RawRow>(text, {
      header: true,
      skipEmptyLines: true,
      transformHeader: (h: string) => h.trim(),
    });
    if (result.errors.length > 0) {
      throw new BadRequestException(
        `CSV parse error: ${result.errors[0].message}`,
      );
    }
    return result.data;
  }
}
