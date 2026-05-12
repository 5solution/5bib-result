import { numToVnWords, vndAmountInWords } from './vn-num-to-words';

describe('numToVnWords', () => {
  it('returns "không" for zero', () => {
    expect(numToVnWords(0)).toBe('Không');
  });

  it('reads single digits', () => {
    expect(numToVnWords(1)).toBe('Một');
    expect(numToVnWords(5)).toBe('Năm');
    expect(numToVnWords(9)).toBe('Chín');
  });

  it('reads teen numbers correctly', () => {
    expect(numToVnWords(10)).toBe('Mười');
    expect(numToVnWords(15)).toBe('Mười lăm');
    expect(numToVnWords(19)).toBe('Mười chín');
  });

  it('uses "mốt" for 21 and "tư" / "lăm" for 4/5 in tens', () => {
    expect(numToVnWords(21)).toBe('Hai mươi mốt');
    expect(numToVnWords(24)).toBe('Hai mươi tư');
    expect(numToVnWords(25)).toBe('Hai mươi lăm');
  });

  it('reads hundreds with "lẻ"', () => {
    expect(numToVnWords(105)).toBe('Một trăm lẻ năm');
    expect(numToVnWords(200)).toBe('Hai trăm');
    expect(numToVnWords(999)).toBe('Chín trăm chín mươi chín');
  });

  it('reads thousands', () => {
    expect(numToVnWords(1000)).toBe('Một nghìn');
    expect(numToVnWords(1234)).toBe(
      'Một nghìn hai trăm ba mươi tư',
    );
    expect(numToVnWords(15000)).toBe('Mười lăm nghìn');
  });

  it('reads millions + nested zero groups', () => {
    expect(numToVnWords(1_000_000)).toBe('Một triệu');
    expect(numToVnWords(1_234_567)).toBe(
      'Một triệu hai trăm ba mươi tư nghìn năm trăm sáu mươi bảy',
    );
  });

  it('reads billions', () => {
    expect(numToVnWords(1_000_000_000)).toBe('Một tỷ');
    expect(numToVnWords(2_500_000_000)).toBe(
      'Hai tỷ năm trăm triệu',
    );
  });

  it('handles invalid / negative inputs', () => {
    expect(numToVnWords(null)).toBe('');
    expect(numToVnWords(undefined)).toBe('');
    expect(numToVnWords(-100)).toBe('');
    expect(numToVnWords(NaN)).toBe('');
  });

  it('floors floats (no decimals in VND)', () => {
    expect(numToVnWords(1234.99)).toBe(
      'Một nghìn hai trăm ba mươi tư',
    );
  });
});

describe('vndAmountInWords', () => {
  it('appends "đồng" suffix', () => {
    expect(vndAmountInWords(1_500_000)).toBe('Một triệu năm trăm nghìn đồng');
  });

  it('returns "" for null', () => {
    expect(vndAmountInWords(null)).toBe('');
  });

  it('returns "Không đồng" for 0', () => {
    expect(vndAmountInWords(0)).toBe('Không đồng');
  });
});
