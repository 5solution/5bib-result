// papaparse types use `export as namespace Papa` — must use namespace import,
// not default. Match existing pattern in team-management/*-import.service.ts.
import * as Papa from 'papaparse';
import { stripBom } from './normalize';

export interface ParsedCsvRow {
  chip_id: string;
  bib_number: string;
  lineNo: number;
}

export interface CsvParseResult {
  rows: ParsedCsvRow[];
  errors: { row: number; reason: string }[];
}

/**
 * Parse CSV with BOM strip, CRLF/LF tolerance, quoted-value support.
 * Required header: chip_id, bib_number (case-insensitive).
 */
export function parseCsv(buffer: Buffer): CsvParseResult {
  const raw = stripBom(buffer.toString('utf-8'));

  const result = Papa.parse<Record<string, string>>(raw, {
    header: true,
    skipEmptyLines: true,
    transformHeader: (h) => h.trim().toLowerCase(),
  });

  const errors: { row: number; reason: string }[] = [];
  for (const e of result.errors) {
    errors.push({
      row: (e.row ?? 0) + 2, // +1 for header, +1 for 1-based
      reason: e.message,
    });
  }

  if (!result.meta.fields?.includes('chip_id')) {
    errors.push({ row: 1, reason: 'Missing required column: chip_id' });
  }
  if (!result.meta.fields?.includes('bib_number')) {
    errors.push({ row: 1, reason: 'Missing required column: bib_number' });
  }

  if (errors.length > 0) return { rows: [], errors };

  const rows: ParsedCsvRow[] = result.data.map((r, idx) => ({
    chip_id: (r.chip_id ?? '').trim(),
    bib_number: (r.bib_number ?? '').trim(),
    lineNo: idx + 2, // +1 header, +1 1-based
  }));

  return { rows, errors };
}
