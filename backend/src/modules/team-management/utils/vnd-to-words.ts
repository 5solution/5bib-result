/**
 * VND amount → tiếng Việt (lower-case, ready to prefix with "Bằng chữ:").
 *
 * Covers the realistic acceptance_value range: 0 .. 999_999_999_999 (< 1 nghìn tỷ).
 * Rejects negative, non-integer, and out-of-range values — acceptance_value is
 * stored as INT (VND, no decimals) and bounded by app-level validation.
 *
 * Examples:
 *   0          → "không đồng"
 *   1_500_000  → "một triệu năm trăm nghìn đồng"
 *   12_345_678 → "mười hai triệu ba trăm bốn mươi lăm nghìn sáu trăm bảy mươi tám đồng"
 *   2_000_000_000 → "hai tỷ đồng"
 *
 * Rules handled:
 *   - "mười" (10), "một mười" → "mười"   (never "một mươi")
 *   - "mươi lăm" when unit=5 after tens  (not "năm")
 *   - "mươi một" → "mươi mốt" when unit=1 after tens >= 20
 *   - "linh X" when tens=0 and unit > 0 inside a 3-digit group (e.g. 105 → "một trăm linh năm")
 *   - Trailing zero groups are skipped ("hai tỷ đồng", not "hai tỷ không triệu không nghìn")
 *   - Leading zero groups force "không trăm" when sub-billion chunk needs padding
 */

const DIGIT_WORDS = [
  'không',
  'một',
  'hai',
  'ba',
  'bốn',
  'năm',
  'sáu',
  'bảy',
  'tám',
  'chín',
] as const;

const SCALE_WORDS = ['', 'nghìn', 'triệu', 'tỷ'] as const;

const MAX_SUPPORTED = 999_999_999_999; // under 1,000 tỷ

export function vndToWords(n: number): string {
  if (!Number.isFinite(n) || !Number.isInteger(n)) {
    throw new Error(`vndToWords: expected integer, got ${n}`);
  }
  if (n < 0) {
    throw new Error(`vndToWords: negative amount not supported (${n})`);
  }
  if (n > MAX_SUPPORTED) {
    throw new Error(
      `vndToWords: amount exceeds supported range (${n} > ${MAX_SUPPORTED})`,
    );
  }
  if (n === 0) return 'không đồng';

  // Split into groups of 3 digits from least significant: [units, nghìn, triệu, tỷ]
  const groups: number[] = [];
  let rest = n;
  while (rest > 0) {
    groups.push(rest % 1000);
    rest = Math.floor(rest / 1000);
  }

  const parts: string[] = [];
  for (let i = groups.length - 1; i >= 0; i--) {
    const g = groups[i];
    if (g === 0) continue;
    // Pad with "không trăm" / "linh X" only when this group is NOT the most
    // significant non-zero group — matches the conventional reading style.
    const isLeadingNonZero = i === groups.length - 1;
    const chunk = readThreeDigitGroup(g, !isLeadingNonZero);
    const scale = SCALE_WORDS[i];
    parts.push(scale ? `${chunk} ${scale}` : chunk);
  }

  return `${parts.join(' ').replace(/\s+/g, ' ').trim()} đồng`;
}

/**
 * Read a 0..999 number as Vietnamese words.
 * @param forcePad if true and hundreds=0, prefix "không trăm" so continuation
 *                 groups read naturally (e.g. "một tỷ không trăm linh năm triệu").
 */
function readThreeDigitGroup(n: number, forcePad: boolean): string {
  if (n === 0) return '';
  const hundreds = Math.floor(n / 100);
  const tens = Math.floor((n % 100) / 10);
  const units = n % 10;

  const pieces: string[] = [];

  if (hundreds > 0) {
    pieces.push(`${DIGIT_WORDS[hundreds]} trăm`);
  } else if (forcePad) {
    pieces.push('không trăm');
  }

  if (tens === 0) {
    if (units > 0) {
      // "linh X" when we already emitted a hundreds segment OR force-padded.
      if (pieces.length > 0) {
        pieces.push('linh');
        pieces.push(DIGIT_WORDS[units]);
      } else {
        // Group 0..9 standalone — shouldn't hit forcePad=false path unless n<10.
        pieces.push(DIGIT_WORDS[units]);
      }
    }
  } else if (tens === 1) {
    pieces.push('mười');
    if (units === 5) {
      pieces.push('lăm');
    } else if (units > 0) {
      pieces.push(DIGIT_WORDS[units]);
    }
  } else {
    pieces.push(`${DIGIT_WORDS[tens]} mươi`);
    if (units === 1) {
      pieces.push('mốt');
    } else if (units === 5) {
      pieces.push('lăm');
    } else if (units > 0) {
      pieces.push(DIGIT_WORDS[units]);
    }
  }

  return pieces.join(' ');
}

/**
 * Capitalise the first Vietnamese word — used when rendering "Bằng chữ:"
 * standalone so the sentence starts with an uppercase letter.
 */
export function capitaliseFirst(s: string): string {
  if (!s) return s;
  return s.charAt(0).toUpperCase() + s.slice(1);
}
