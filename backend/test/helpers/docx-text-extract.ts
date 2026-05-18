/**
 * F-042 DOCX content extraction test helper.
 *
 * Extracts plain text content from DOCX Buffer for assertion in test files.
 * Used by TC-42-01..09 to verify financial number rendering correctness:
 *   - Verify "25.870.000" (correct subtotal) present
 *   - Verify "152.000.000" (hardcoded sample) absent
 *
 * Implementation:
 *   1. Treat DOCX Buffer as ZIP archive
 *   2. Extract `word/document.xml`
 *   3. Strip XML tags + collapse whitespace
 *   4. Return plain text string
 *
 * Dependencies: `pizzip` (already in backend/package.json, used by docxtemplater)
 * Created by 5bib-fullstack-engineer trong F-042 (Manager Adjustment #2 plan).
 */
// eslint-disable-next-line @typescript-eslint/no-var-requires
const PizZip = require('pizzip');

/**
 * Extract plain text from DOCX Buffer.
 *
 * @param buffer - DOCX file as Buffer (from generateDocument result or fs.readFile)
 * @returns Plain text content (XML tags stripped, whitespace collapsed)
 * @throws Error if Buffer is not a valid DOCX zip or `word/document.xml` missing
 */
export async function extractDocxText(buffer: Buffer): Promise<string> {
  const zip = new PizZip(buffer);
  const docFile = zip.file('word/document.xml');
  if (!docFile) {
    throw new Error(
      'Invalid DOCX: word/document.xml not found in zip. ' +
        'Buffer may not be a valid Word document.',
    );
  }
  const xml = docFile.asText();

  // Strip XML tags + collapse multiple whitespace to single space
  const text = xml
    .replace(/<[^>]+>/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();

  return text;
}

/**
 * Convenience helper: assert text content contains all expected substrings.
 * Throws if any expected substring is missing.
 */
export async function assertDocxContains(
  buffer: Buffer,
  expected: string[],
): Promise<void> {
  const text = await extractDocxText(buffer);
  const missing = expected.filter((s) => !text.includes(s));
  if (missing.length > 0) {
    throw new Error(
      `DOCX content missing expected substrings: ${JSON.stringify(missing)}\n` +
        `Excerpt (first 500 chars): ${text.slice(0, 500)}...`,
    );
  }
}

/**
 * Convenience helper: assert text content does NOT contain any forbidden substrings.
 * Used for hardcoded sample value verification (BR-42-07).
 */
export async function assertDocxNotContains(
  buffer: Buffer,
  forbidden: string[],
): Promise<void> {
  const text = await extractDocxText(buffer);
  const found = forbidden.filter((s) => text.includes(s));
  if (found.length > 0) {
    throw new Error(
      `DOCX content contains forbidden substrings (hardcoded sample values? F-042 regression?): ` +
        `${JSON.stringify(found)}`,
    );
  }
}
