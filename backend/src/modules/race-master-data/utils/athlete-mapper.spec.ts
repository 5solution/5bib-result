/**
 * FEATURE-048 Phase 1A — Athlete mapper PII populate unit tests.
 *
 * Verifies BR-48-05: mapMysqlAthleteToSchema now includes email/contact_phone/id_number.
 * Verifies BR-48-07: toPublicView STRIPS PII (defense layer).
 * Verifies BR-48-15: PII strict allowlist preserved across mapper variants.
 */

import {
  mapMysqlAthleteToSchema,
  toPublicView,
  toAdminView,
  normalizeGender,
} from './athlete-mapper';
import { AthleteReadonly } from '../entities/athlete-readonly.entity';
import { RaceAthlete } from '../schemas/race-athlete.schema';

function makeMysqlAthlete(
  overrides: Partial<AthleteReadonly> = {},
): AthleteReadonly {
  return {
    athletes_id: 92634,
    race_id: 192,
    bib_number: '88043',
    name: 'NGUYỄN BÌNH MINH',
    dob: new Date('1985-06-15'),
    email: 'minh.nguyen@example.com',
    last_status: 'ACTIVE',
    racekit_recieved: 0,
    racekit_recieved_time: null,
    subinfo_id: 100,
    code_id: null,
    modified_on: new Date(),
    deleted: false,
    // F-048 fix: phone/CCCD live in athlete_subinfo (NOT athletes)
    subinfo: {
      id: 100,
      contact_phone: '0901234567',
      id_number: '001185000123',
    },
    code: null,
    ...overrides,
    /* eslint-disable @typescript-eslint/no-explicit-any */
  } as any;
  /* eslint-enable @typescript-eslint/no-explicit-any */
}

describe('mapMysqlAthleteToSchema() — F-048 BR-48-05 PII populate', () => {
  it('populates email/contact_phone/id_number from MySQL athlete', () => {
    const mysql = makeMysqlAthlete();
    const mapped = mapMysqlAthleteToSchema(192, mysql);

    expect(mapped.email).toBe('minh.nguyen@example.com');
    expect(mapped.contact_phone).toBe('0901234567');
    expect(mapped.id_number).toBe('001185000123');
  });

  it('email normalized to lowercase + trimmed', () => {
    const mysql = makeMysqlAthlete({ email: '  Athlete@EXAMPLE.com  ' });
    const mapped = mapMysqlAthleteToSchema(192, mysql);

    expect(mapped.email).toBe('athlete@example.com');
  });

  it('phone + id_number trimmed (no case change — preserve format) from subinfo', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mysql = makeMysqlAthlete({
      subinfo: {
        id: 100,
        contact_phone: '  0987654321  ',
        id_number: '  044089000001  ',
      } as any,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const mapped = mapMysqlAthleteToSchema(192, mysql);

    expect(mapped.contact_phone).toBe('0987654321');
    expect(mapped.id_number).toBe('044089000001');
  });

  it('PII fields null when MySQL source is null (anonymous athlete)', () => {
    const mysql = makeMysqlAthlete({
      email: null,
      subinfo: null,
    });
    const mapped = mapMysqlAthleteToSchema(192, mysql);

    expect(mapped.email).toBeNull();
    expect(mapped.contact_phone).toBeNull();
    expect(mapped.id_number).toBeNull();
  });

  it('empty string PII → null (defensive)', () => {
    /* eslint-disable @typescript-eslint/no-explicit-any */
    const mysql = makeMysqlAthlete({
      email: '',
      subinfo: { id: 100, contact_phone: '   ', id_number: '' } as any,
    });
    /* eslint-enable @typescript-eslint/no-explicit-any */
    const mapped = mapMysqlAthleteToSchema(192, mysql);

    expect(mapped.email).toBeNull();
    expect(mapped.contact_phone).toBeNull();
    expect(mapped.id_number).toBeNull();
  });

  it('still maps non-PII fields correctly (regression check)', () => {
    const mysql = makeMysqlAthlete();
    const mapped = mapMysqlAthleteToSchema(192, mysql);

    expect(mapped.mysql_race_id).toBe(192);
    expect(mapped.athletes_id).toBe(92634);
    expect(mapped.bib_number).toBe('88043');
    expect(mapped.full_name).toBe('NGUYỄN BÌNH MINH');
    expect(mapped.source).toBe('mysql_platform');
  });
});

describe('toPublicView() — BR-48-07 PII strip defense', () => {
  function makeAthleteDoc(
    overrides: Partial<RaceAthlete> = {},
  ): RaceAthlete {
    return {
      mysql_race_id: 192,
      athletes_id: 1,
      bib_number: '100',
      display_name: 'Test',
      bib_name: null,
      full_name: 'Test Athlete',
      gender: 'Nam',
      course_id: 1,
      course_name: '21KM',
      course_distance: '21K',
      club: null,
      ticket_type_id: null,
      items: null,
      last_status: 'ACTIVE',
      racekit_received: false,
      racekit_received_at: null,
      ageOnRaceDay: null,
      email: 'leaked@example.com',
      contact_phone: '0987654321',
      id_number: '001185000123',
      source: 'mysql_platform',
      legacy_modified_on: null,
      synced_at: new Date(),
      sync_version: 2,
      ...overrides,
      /* eslint-disable @typescript-eslint/no-explicit-any */
    } as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  it('STRIPS email/contact_phone/id_number from output', () => {
    const doc = makeAthleteDoc();
    const view = toPublicView(doc);

    expect(view).not.toHaveProperty('email');
    expect(view).not.toHaveProperty('contact_phone');
    expect(view).not.toHaveProperty('id_number');
  });

  it('includes safe public fields', () => {
    const doc = makeAthleteDoc();
    const view = toPublicView(doc);

    expect(view.bib_number).toBe('100');
    expect(view.full_name).toBe('Test Athlete');
    expect(view.gender).toBe('Nam');
  });
});

describe('toAdminView() — admin context includes PII', () => {
  function makeAthleteDoc(): RaceAthlete {
    return {
      mysql_race_id: 192,
      athletes_id: 1,
      bib_number: '100',
      display_name: 'X',
      bib_name: null,
      full_name: 'X',
      gender: null,
      course_id: null,
      course_name: null,
      course_distance: null,
      club: null,
      ticket_type_id: null,
      items: null,
      last_status: null,
      racekit_received: false,
      racekit_received_at: null,
      ageOnRaceDay: null,
      email: 'admin-view@test.com',
      contact_phone: '0901111111',
      id_number: '044089000099',
      source: 'mysql_platform',
      legacy_modified_on: null,
      synced_at: new Date(),
      sync_version: 1,
      /* eslint-disable @typescript-eslint/no-explicit-any */
    } as any;
    /* eslint-enable @typescript-eslint/no-explicit-any */
  }

  it('INCLUDES email/contact_phone/id_number for admin context', () => {
    const doc = makeAthleteDoc();
    const view = toAdminView(doc);

    expect(view.email).toBe('admin-view@test.com');
    expect(view.contact_phone).toBe('0901111111');
    expect(view.id_number).toBe('044089000099');
  });
});

describe('normalizeGender() — regression', () => {
  it('MALE → Nam', () => {
    expect(normalizeGender('MALE')).toBe('Nam');
  });
  it('F → Nữ', () => {
    expect(normalizeGender('F')).toBe('Nữ');
  });
  it('null → null', () => {
    expect(normalizeGender(null)).toBeNull();
  });
});
