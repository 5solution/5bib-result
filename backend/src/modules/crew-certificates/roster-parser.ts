import * as ExcelJS from 'exceljs';
import * as Papa from 'papaparse';
import { slugifyVN } from '../../common/utils/slugify';
import {
  CREW_COL_FULLNAME,
  CREW_COL_PHOTO,
  CREW_COL_POSITION,
  CREW_PHOTO_URL_REGEX,
  CREW_ROSTER_MAX_ROWS,
} from './crew-certificates.constants';
import { RecipientRowDto, InvalidRosterRowDto } from './dto/crew-response.dto';

export interface ParsedRoster {
  total: number;
  valid: RecipientRowDto[];
  invalid: InvalidRosterRowDto[];
  extraFields: string[];
}

/** Lowercase + bỏ dấu + collapse space (so khớp header tiếng Việt). */
function normalizeHeader(h: string): string {
  return h
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/đ/g, 'd')
    .replace(/Đ/g, 'D')
    .toLowerCase()
    .trim()
    .replace(/\s+/g, ' ');
}

/** Parse Excel (.xlsx) hoặc CSV → rows keyed theo header gốc. */
async function readRows(
  buffer: Buffer,
  filename: string,
): Promise<{ headers: string[]; rows: Record<string, string>[] }> {
  const isCsv = filename.toLowerCase().endsWith('.csv');
  if (isCsv) {
    const text = buffer.toString('utf8');
    const parsed = Papa.parse<Record<string, string>>(text, {
      header: true,
      skipEmptyLines: true,
    });
    const headers = (parsed.meta.fields ?? []).map((f) => f.trim());
    const rows = (parsed.data ?? []).map((r) => {
      const o: Record<string, string> = {};
      for (const h of headers) o[h] = String(r[h] ?? '').trim();
      return o;
    });
    return { headers, rows };
  }

  const wb = new ExcelJS.Workbook();
  await wb.xlsx.load(
    buffer.buffer.slice(
      buffer.byteOffset,
      buffer.byteOffset + buffer.byteLength,
    ) as ArrayBuffer,
  );
  const ws = wb.worksheets[0];
  if (!ws) return { headers: [], rows: [] };

  const colHeader: Record<number, string> = {};
  const headers: string[] = [];
  ws.getRow(1).eachCell((cell, col) => {
    const h = String(cell.value ?? '').trim();
    if (h) {
      colHeader[col] = h;
      headers.push(h);
    }
  });

  const rows: Record<string, string>[] = [];
  ws.eachRow({ includeEmpty: false }, (row, rowNumber) => {
    if (rowNumber === 1) return;
    const o: Record<string, string> = {};
    for (const [colStr, h] of Object.entries(colHeader)) {
      const cell = row.getCell(Number(colStr));
      o[h] = String(cell.value ?? '').trim();
    }
    rows.push(o);
  });
  return { headers, rows };
}

export async function parseRoster(
  buffer: Buffer,
  filename: string,
): Promise<ParsedRoster> {
  const { headers, rows } = await readRows(buffer, filename);

  // Map header → role (fullName/position/photo) hoặc extra.
  let fullNameHeader: string | undefined;
  let positionHeader: string | undefined;
  let photoHeader: string | undefined;
  const extraHeaders: string[] = [];
  for (const h of headers) {
    const n = normalizeHeader(h);
    if (n === CREW_COL_FULLNAME) fullNameHeader = h;
    else if (n === CREW_COL_POSITION) positionHeader = h;
    else if (n === CREW_COL_PHOTO) photoHeader = h;
    else extraHeaders.push(h);
  }

  const valid: RecipientRowDto[] = [];
  const invalid: InvalidRosterRowDto[] = [];

  if (!fullNameHeader || !positionHeader) {
    return {
      total: rows.length,
      valid,
      invalid: [
        {
          rowNumber: 1,
          reason: 'File thiếu cột bắt buộc "Họ tên" và/hoặc "Vị trí"',
        },
      ],
      extraFields: extraHeaders,
    };
  }

  const capped = rows.slice(0, CREW_ROSTER_MAX_ROWS);
  capped.forEach((row, idx) => {
    const rowNumber = idx + 2; // +1 header, +1 1-indexed
    const fullName = (row[fullNameHeader as string] ?? '').trim();
    const position = (row[positionHeader as string] ?? '').trim();
    if (!fullName || !position) {
      invalid.push({
        rowNumber,
        reason: !fullName ? 'Thiếu Họ tên' : 'Thiếu Vị trí',
      });
      return;
    }
    const photoRaw = photoHeader ? (row[photoHeader] ?? '').trim() : '';
    const photoUrl = CREW_PHOTO_URL_REGEX.test(photoRaw) ? photoRaw : undefined;
    const extraFields: Record<string, string> = {};
    for (const h of extraHeaders) {
      const v = (row[h] ?? '').trim();
      if (v) extraFields[slugifyVN(h)] = v;
    }
    valid.push({ fullName, position, photoUrl, extraFields });
  });

  return {
    total: rows.length,
    valid,
    invalid,
    extraFields: extraHeaders,
  };
}
