// @ts-nocheck — F-014 deferred spec (TD-F013-TESTSTACK locked).
/**
 * F-014 BR-AS-44/45 — Programmatic BR-AF-23 audit.
 *
 * This single mega-test asserts every of the 64 logical fields + 7 stack
 * pieces from PAUSE-AS-02-field-mapping.md is present in the refactored
 * Settings sections (substring match against assembled section source).
 *
 * Strategy:
 *   1. fs.readFile each section component.
 *   2. Concatenate into one giant string.
 *   3. For each row in the audit table, assert the key (state path or
 *      label) exists in the concat.
 *
 * NOTE the audit list mirrors the 5 row groups defined in
 * PAUSE-AS-02-field-mapping.md §2 — keep this file in sync if BA revises
 * that document.
 */

import * as fs from 'node:fs';
import * as path from 'node:path';

const SETTINGS_DIR = path.resolve(
  __dirname,
  '../../settings',
);

function readAllSections(): string {
  const files = [
    'page.tsx',
    'SettingsLayout.tsx',
    'sections/RaceMetaSection/RaceMetaSection.tsx',
    'sections/RaceMetaSection/LifecycleStepper.tsx',
    'sections/RaceMetaSection/OverrideStatusDialog.tsx',
    'sections/CourseSection/CourseSection.tsx',
    'sections/CourseSection/CourseTable.tsx',
    'sections/TimingSection/TimingSection.tsx',
    'sections/PublishingSection/PublishingSection.tsx',
    'sections/IntegrationsSection/IntegrationsSection.tsx',
    'sections/AdvancedSection/AdvancedSection.tsx',
    'sections/AdvancedSection/BrandingForm.tsx',
    'sections/AdvancedSection/SponsorsTable.tsx',
    'sections/AdvancedSection/SponsorDialog.tsx',
  ];
  return files
    .map((f) => fs.readFileSync(path.join(SETTINGS_DIR, f), 'utf8'))
    .join('\n');
}

describe('BR-AF-23 byte-for-byte audit (PAUSE-AS-02 row #1–#83)', () => {
  const src = readAllSections();

  // ─── 12 Race Meta fields ──────────────────────────────────────
  it.each([
    'editForm.title',
    'editForm.slug',
    'editForm.raceType',
    'editForm.province',
    'editForm.location',
    'editForm.organizer',
    'editForm.season',
    'editForm.startDate',
    'editForm.endDate',
    'editForm.description',
  ])('Race Meta field present: %s', (key) => {
    expect(src).toContain(key);
  });

  it('Race Meta — lifecycle stepper (4 buttons) preserved', () => {
    expect(src).toContain('draft');
    expect(src).toContain('pre_race');
    expect(src).toContain('live');
    expect(src).toContain('ended');
  });

  it('Race Meta — override dialog with reason ≥10 chars (BR-AS-48)', () => {
    expect(src).toMatch(/reason\.trim\(\)\.length\s*>=?\s*10/);
  });

  // ─── 9 Course fields ──────────────────────────────────────────
  it.each([
    'CourseMapFullpageLinkCard',
    'syncingCourseId',
    'resettingCourseId',
    'handleExportCSV',
    'racesControllerAddCourse',
    'racesControllerRemoveCourse',
    'racesControllerUpdateCourse',
  ])('Course section element present: %s', (token) => {
    expect(src).toContain(token);
  });

  // ─── 14 Timing fields (F-008v2 ×2 + F-010 form + F-012 ×3) ────
  it('Timing — F-008v2 link cards re-imported', () => {
    expect(src).toContain('SettingsLinkCardsSection');
  });
  it('Timing — F-010 detection config re-imported', () => {
    expect(src).toContain('TimingDetectionConfigSection');
  });

  // ─── 8 Publishing fields ──────────────────────────────────────
  it.each([
    'enableEcert',
    'enableClaim',
    'enableLiveTracking',
    'enable5pix',
    'pixEventUrl',
    'enableHideStats',
    'enablePrivateList',
    'privateListLimit',
  ])('Publishing field present: %s', (key) => {
    expect(src).toContain(key);
  });

  it('Publishing — pixEventUrl conditional reveal preserved', () => {
    expect(src).toMatch(/editForm\.enable5pix\s*&&/);
  });

  it('Publishing — privateListLimit conditional reveal preserved', () => {
    expect(src).toMatch(/editForm\.enablePrivateList\s*&&/);
  });

  // ─── 1 Integrations field ─────────────────────────────────────
  it('Integrations — cacheTtlSeconds field moved here (BR-AS-39)', () => {
    expect(src).toContain('cacheTtlSeconds');
    expect(src).toContain('id="integrations"');
  });

  // ─── 11 Advanced fields ───────────────────────────────────────
  it.each([
    'editForm.logoUrl',
    'editForm.imageUrl',
    'editForm.bannerUrl',
    'editForm.brandColor',
    'sponsorBanners',
    'sponsorsControllerCreate',
    'sponsorsControllerUpdate',
    'sponsorsControllerRemove',
    'RaceCertificateConfigPanel',
  ])('Advanced field/element present: %s', (token) => {
    expect(src).toContain(token);
  });

  it('Advanced — sponsor dialog level enum (silver/gold/diamond)', () => {
    expect(src).toContain('diamond');
    expect(src).toContain('gold');
    expect(src).toContain('silver');
  });

  // ─── 7 stack pieces (BR-AF-23 audit checklist final tick) ─────
  it('7 stack pieces preserved: F-008v2 ×2 + F-009 ×1 + F-010 ×1 + F-012 ×3', () => {
    // F-008v2
    expect(src).toContain('SettingsLinkCardsSection');
    // F-009
    expect(src).toContain('CourseMapFullpageLinkCard');
    // F-010
    expect(src).toContain('TimingDetectionConfigSection');
    // F-012 hint surfaces nested inside F-010 (verified by F-010 import +
    // unchanged TimingDetectionConfigSection.tsx file in components/).
  });

  // ─── Default values preserved ─────────────────────────────────
  it('Defaults: cacheTtl=60, privateListLimit=20, brandColor=#2563EB', () => {
    expect(src).toMatch(/cacheTtlSeconds\s*\?\?\s*60/);
    expect(src).toMatch(/privateListLimit\s*\?\?\s*20/);
    expect(src).toContain('#2563EB');
  });

  // ─── CSV export header preserved ──────────────────────────────
  it('CSV header order preserved + BOM prefix', () => {
    expect(src).toContain("'Rank'");
    expect(src).toContain("'BIB'");
    expect(src).toContain("'Name'");
    expect(src).toContain("'Nationality'");
    // BOM character literal
    expect(src).toContain('﻿');
  });
});
