import {
  parseRaceResultAthlete,
  nextCheckpointInOrder,
  parseTimeToSeconds,
  secondsToHms,
} from './parsed-athlete';
import { RaceResultApiItem } from '../../race-result/types/race-result-api.types';
import { CourseCheckpoint } from '../utils/parsed-athlete';

const CHECKPOINTS_42KM: CourseCheckpoint[] = [
  { key: 'Start', distance_km: 0 },
  { key: 'TM1', distance_km: 10 },
  { key: 'TM2', distance_km: 21 },
  { key: 'TM3', distance_km: 32 },
  { key: 'Finish', distance_km: 42.195 },
];

function makeItem(overrides: Partial<RaceResultApiItem>): RaceResultApiItem {
  return {
    Bib: 1001,
    Name: 'Test Runner',
    OverallRank: 5,
    GenderRank: 3,
    CatRank: 2,
    Gender: 'Male',
    Category: 'Nam 40-49',
    ChipTime: '',
    GunTime: '',
    TimingPoint: 'TM2',
    Pace: '',
    Certi: '',
    Certificate: '',
    OverallRanks: '',
    GenderRanks: '',
    Chiptimes: '{"Start":"06:00","TM1":"06:50","TM2":"07:32:11"}',
    Guntimes: '',
    Paces: '',
    TODs: '',
    Sectors: '',
    OverrankLive: 0,
    Gap: '',
    Nationality: 'VN',
    Nation: 'Vietnam',
    Contest: '42KM',
    ...overrides,
  };
}

describe('parseRaceResultAthlete', () => {
  it('parses BIB + name + age group + checkpoint times', () => {
    const item = makeItem({ Firstname: 'Đặng', Lastname: 'Đức' });
    const result = parseRaceResultAthlete(item, CHECKPOINTS_42KM);

    expect(result.bib).toBe('1001');
    expect(result.fullName).toBe('Đặng Đức');
    expect(result.contest).toBe('42KM');
    expect(result.ageGroup).toBe('Nam 40-49');
    expect(result.checkpointTimes.TM2).toBe('07:32:11');
    expect(result.lastSeenPoint).toBe('TM2');
    expect(result.lastSeenTime).toBe('07:32:11');
  });

  it('falls back to Name field when Firstname/Lastname absent', () => {
    const item = makeItem({ Name: 'ĐẶNG ĐẠO ĐỨC' });
    const result = parseRaceResultAthlete(item, CHECKPOINTS_42KM);
    expect(result.fullName).toBe('ĐẶNG ĐẠO ĐỨC');
  });

  it('handles Bib=0 with Certificate URL fallback', () => {
    const item = makeItem({
      Bib: 0,
      Certificate: 'https://example.com/certificates/7254/42KM',
    });
    const result = parseRaceResultAthlete(item, CHECKPOINTS_42KM);
    expect(result.bib).toBe('7254');
  });

  it('Bib=0 with no Certificate → empty bib', () => {
    const item = makeItem({ Bib: 0, Certificate: '', Certi: '' });
    const result = parseRaceResultAthlete(item, CHECKPOINTS_42KM);
    expect(result.bib).toBe('');
  });

  it('lastSeenPoint follows COURSE order, not JSON key order (TA-6 synthetic)', () => {
    // BIB 98898 case: has Start, TM1, TM2 but NO TM3 + NO Finish
    const item = makeItem({
      Chiptimes: '{"Finish":"","TM2":"07:32:11","Start":"06:00","TM1":"06:50"}',
    });
    const result = parseRaceResultAthlete(item, CHECKPOINTS_42KM);
    expect(result.lastSeenPoint).toBe('TM2');
    expect(result.lastSeenTime).toBe('07:32:11');
    // Finish key trong JSON nhưng value="" → mergeTimes filter empty out →
    // KHÔNG có trong checkpointTimes map (dropped, không phải kept "").
    // Đây là behavior chuẩn để miss-detector + scenario-engine hoạt động
    // đúng — checkpoint chưa qua = absent key, không phải empty string.
    expect(result.checkpointTimes.Finish).toBeUndefined();
  });

  it('handles malformed Chiptimes JSON → empty object', () => {
    const item = makeItem({ Chiptimes: 'not-json{{{' });
    const result = parseRaceResultAthlete(item, CHECKPOINTS_42KM);
    expect(result.checkpointTimes).toEqual({});
    expect(result.lastSeenPoint).toBeNull();
    expect(result.lastSeenTime).toBeNull();
  });

  it('handles empty Chiptimes', () => {
    const item = makeItem({ Chiptimes: '' });
    const result = parseRaceResultAthlete(item, CHECKPOINTS_42KM);
    expect(result.lastSeenPoint).toBeNull();
  });

  it('athlete with NO checkpoint times → lastSeenPoint=null (DNS)', () => {
    const item = makeItem({ Chiptimes: '{}' });
    const result = parseRaceResultAthlete(item, CHECKPOINTS_42KM);
    expect(result.lastSeenPoint).toBeNull();
  });

  it('athlete who finished → lastSeenPoint=Finish', () => {
    const item = makeItem({
      Chiptimes:
        '{"Start":"06:00","TM1":"06:45","TM2":"07:30","TM3":"08:30","Finish":"09:15:00"}',
    });
    const result = parseRaceResultAthlete(item, CHECKPOINTS_42KM);
    expect(result.lastSeenPoint).toBe('Finish');
    expect(result.lastSeenTime).toBe('09:15:00');
  });
});

describe('nextCheckpointInOrder', () => {
  it('returns next CP when not at end', () => {
    expect(nextCheckpointInOrder('TM2', CHECKPOINTS_42KM)?.key).toBe('TM3');
  });
  it('returns null when at end (Finish)', () => {
    expect(nextCheckpointInOrder('Finish', CHECKPOINTS_42KM)).toBeNull();
  });
  it('returns null for unknown key', () => {
    expect(nextCheckpointInOrder('UNKNOWN', CHECKPOINTS_42KM)).toBeNull();
  });
});

describe('parseTimeToSeconds', () => {
  it('parses HH:MM:SS', () => {
    expect(parseTimeToSeconds('01:30:45')).toBe(5445);
  });
  it('parses MM:SS short race', () => {
    expect(parseTimeToSeconds('25:30')).toBe(1530);
  });
  it('returns null for invalid', () => {
    expect(parseTimeToSeconds('')).toBeNull();
    expect(parseTimeToSeconds('abc')).toBeNull();
    expect(parseTimeToSeconds(null)).toBeNull();
  });
});

describe('secondsToHms', () => {
  it('formats HH:MM:SS', () => {
    expect(secondsToHms(5445)).toBe('01:30:45');
    expect(secondsToHms(0)).toBe('00:00:00');
    expect(secondsToHms(60)).toBe('00:01:00');
  });
});
