/**
 * FEATURE-056 Phase 4 — RecapArticleGenerator unit tests.
 *
 * Covers 6 templates + data-richness gating rules per Danny mandate
 * "auto-decide theo data richness".
 */

import { RecapArticleGenerator } from './recap-article-generator.service';
import { RaceRecapResponseDto } from '../dto/race-recap-response.dto';

describe('RecapArticleGenerator', () => {
  let svc: RecapArticleGenerator;

  beforeEach(() => {
    svc = new RecapArticleGenerator();
  });

  function buildBaseRecap(
    overrides: Partial<RaceRecapResponseDto> = {},
  ): RaceRecapResponseDto {
    return {
      raceId: 'race-001',
      raceTitle: 'Test Marathon 2026',
      raceSlug: 'test-marathon-2026',
      endDate: '2026-05-03T00:00:00Z',
      hero: {
        totalFinishers: 100,
        dnsCount: 5,
        dnfCount: 3,
        dsqCount: 0,
        headline: '100 VĐV về đích',
        registered: 108,
      },
      podiums: [
        {
          courseId: 'c-42k',
          courseName: '42KM',
          distance: '42',
          male: [
            {
              name: 'Nguyễn Văn A',
              bib: '1001',
              chipTime: '2:38:14',
              medal: 'gold' as const,
              category: 'Nam 30-39',
              city: 'Hà Nội',
            },
          ],
          female: [
            {
              name: 'Trần Thị B',
              bib: '5001',
              chipTime: '3:09:47',
              medal: 'gold' as const,
              category: 'Nữ 30-39',
              city: 'Hồ Chí Minh',
            },
          ],
          maleFinisherCount: 60,
          femaleFinisherCount: 40,
        },
      ],
      paceStats: [
        {
          courseId: 'c-42k',
          courseName: '42KM',
          medianPace: '5:30/km',
          p10Pace: '4:30/km',
          p90Pace: '7:00/km',
          distribution: [5, 15, 25, 30, 15, 5, 3, 2, 0, 0],
          finisherCount: 100,
        },
      ],
      negativeSplits: [
        {
          courseId: 'c-42k',
          courseName: '42KM',
          negativeSplitPercent: 25.5,
          interpretation: 'Race phù hợp đa số trình độ.',
          avgFirstHalf: '1:18:00',
          avgSecondHalf: '1:20:14',
          deltaSeconds: 134,
          finishersAnalyzed: 80,
          benchmark: 40,
        },
      ],
      agBreakdowns: [
        {
          courseId: 'c-42k',
          courseName: '42KM',
          buckets: [
            {
              category: 'Nam 30-39',
              finisherCount: 30,
              top5: [
                {
                  name: 'A',
                  bib: '1',
                  chipTime: '2:40:00',
                  medal: 'gold' as const,
                },
                {
                  name: 'B',
                  bib: '2',
                  chipTime: '2:45:00',
                  medal: 'silver' as const,
                },
                {
                  name: 'C',
                  bib: '3',
                  chipTime: '2:50:00',
                  medal: 'bronze' as const,
                },
              ],
            },
            {
              category: 'Nam 40-49',
              finisherCount: 20,
              top5: [
                {
                  name: 'D',
                  bib: '4',
                  chipTime: '2:55:00',
                  medal: 'gold' as const,
                },
              ],
            },
            {
              category: 'Nữ 30-39',
              finisherCount: 15,
              top5: [
                {
                  name: 'E',
                  bib: '5',
                  chipTime: '3:10:00',
                  medal: 'gold' as const,
                },
              ],
            },
          ],
        },
      ],
      finisherDistribution: [
        {
          courseId: 'c-21k',
          courseName: '21KM',
          distance: '21',
          finisherCount: 50,
          medianPace: '5:00/km',
          bestChipTime: '1:15:00',
        },
        {
          courseId: 'c-42k',
          courseName: '42KM',
          distance: '42',
          finisherCount: 100,
          medianPace: '5:30/km',
          bestChipTime: '2:38:14',
        },
      ],
      computedAt: new Date().toISOString(),
      ...overrides,
    };
  }

  it('TC-art-01 race rich data → 6 articles all rendered', () => {
    const recap = buildBaseRecap();
    const articles = svc.generateForRace(recap);
    expect(articles.length).toBe(6);
    expect(articles.map((a) => a.category)).toEqual([
      'race-narrative',
      'winner-profile',
      'pacing',
      'course-difficulty',
      'age-group',
      'pace-distribution',
    ]);
  });

  it('TC-art-02 race narrative always renders if finishers > 0', () => {
    const recap = buildBaseRecap();
    const articles = svc.generateForRace(recap);
    const narrative = articles.find((a) => a.slug === 'race-overall-narrative');
    expect(narrative).toBeDefined();
    expect(narrative!.title).toContain('Test Marathon 2026');
    expect(narrative!.title).toMatch(/100/); // finisher count
    expect(narrative!.markdown).toContain('100');
  });

  it('TC-art-03 winner profile per course (each podium → 1 article)', () => {
    const recap = buildBaseRecap();
    const articles = svc.generateForRace(recap);
    const winners = articles.filter((a) => a.category === 'winner-profile');
    expect(winners.length).toBe(1); // 1 podium in base recap
    expect(winners[0].slug).toBe('winner-profile-c-42k');
    expect(winners[0].markdown).toContain('Nguyễn Văn A');
    expect(winners[0].markdown).toContain('Trần Thị B');
    expect(winners[0].markdown).toContain('2:38:14');
  });

  it('TC-art-04 skip pacing if finishers analyzed < 10', () => {
    const recap = buildBaseRecap({
      negativeSplits: [
        {
          courseId: 'c-42k',
          courseName: '42KM',
          negativeSplitPercent: 5,
          interpretation: 'Quá ít dữ liệu.',
          avgFirstHalf: '1:00:00',
          avgSecondHalf: '1:30:00',
          deltaSeconds: 1800,
          finishersAnalyzed: 5,
          benchmark: 40,
        },
      ],
    });
    const articles = svc.generateForRace(recap);
    expect(articles.find((a) => a.category === 'pacing')).toBeUndefined();
  });

  it('TC-art-05 skip course-difficulty if < 2 courses', () => {
    const recap = buildBaseRecap({
      finisherDistribution: [
        {
          courseId: 'c-42k',
          courseName: '42KM',
          finisherCount: 100,
          medianPace: '5:30/km',
        },
      ],
    });
    const articles = svc.generateForRace(recap);
    expect(articles.find((a) => a.category === 'course-difficulty')).toBeUndefined();
  });

  it('TC-art-06 skip age-group if < 3 buckets', () => {
    const recap = buildBaseRecap({
      agBreakdowns: [
        {
          courseId: 'c-42k',
          courseName: '42KM',
          buckets: [
            {
              category: 'Nam 30-39',
              finisherCount: 10,
              top5: [],
            },
          ],
        },
      ],
    });
    const articles = svc.generateForRace(recap);
    expect(articles.find((a) => a.category === 'age-group')).toBeUndefined();
  });

  it('TC-art-07 skip pace-distribution if < 10 finishers', () => {
    const recap = buildBaseRecap({
      paceStats: [
        {
          courseId: 'c-42k',
          courseName: '42KM',
          medianPace: '5:30/km',
          p10Pace: '5:00/km',
          p90Pace: '6:00/km',
          distribution: [1, 2, 3, 1, 0, 0, 0, 0, 0, 0],
          finisherCount: 7,
        },
      ],
    });
    const articles = svc.generateForRace(recap);
    expect(articles.find((a) => a.category === 'pace-distribution')).toBeUndefined();
  });

  it('TC-art-08 HTML sanitization — script tag escaped to harmless entity', () => {
    const recap = buildBaseRecap({
      raceTitle: 'Race <script>alert(1)</script> 2026',
    });
    const articles = svc.generateForRace(recap);
    for (const a of articles) {
      // Script tag must NEVER appear as executable HTML in any article
      expect(a.html).not.toContain('<script');
      expect(a.html).not.toContain('</script>');
    }
    // Race-narrative article references raceTitle → input must be escaped
    const narrative = articles.find((a) => a.category === 'race-narrative')!;
    expect(narrative.html).toContain('&lt;script&gt;');
  });

  it('TC-art-09 readMinutes derived from word count', () => {
    const recap = buildBaseRecap();
    const articles = svc.generateForRace(recap);
    for (const a of articles) {
      expect(a.readMinutes).toBeGreaterThanOrEqual(1);
      expect(a.readMinutes).toBeLessThanOrEqual(10);
    }
  });

  it('TC-art-10 summary max 240 chars', () => {
    const recap = buildBaseRecap();
    const articles = svc.generateForRace(recap);
    for (const a of articles) {
      expect(a.summary.length).toBeLessThanOrEqual(240);
    }
  });

  it('TC-art-11 minimum 2 articles even with sparse data (narrative + 1 winner)', () => {
    const recap = buildBaseRecap({
      negativeSplits: [], // skip pacing
      finisherDistribution: undefined, // skip course-difficulty
      agBreakdowns: [], // skip age-group
      paceStats: [], // skip pace-distribution
    });
    const articles = svc.generateForRace(recap);
    expect(articles.length).toBe(2); // narrative + 1 winner profile
    expect(articles[0].category).toBe('race-narrative');
    expect(articles[1].category).toBe('winner-profile');
  });

  it('TC-art-12 winner profile order — longest distance first', () => {
    const recap = buildBaseRecap({
      podiums: [
        {
          courseId: 'c-10k',
          courseName: '10KM',
          distance: '10',
          male: [
            { name: 'M10', bib: '10', chipTime: '0:35:00', medal: 'gold' },
          ],
          female: [],
        },
        {
          courseId: 'c-70k',
          courseName: '70KM',
          distance: '70',
          male: [
            { name: 'M70', bib: '70', chipTime: '7:00:00', medal: 'gold' },
          ],
          female: [],
        },
      ],
    });
    const articles = svc.generateForRace(recap);
    const winners = articles.filter((a) => a.category === 'winner-profile');
    expect(winners.length).toBe(2);
    // Longest first
    expect(winners[0].slug).toBe('winner-profile-c-70k');
    expect(winners[1].slug).toBe('winner-profile-c-10k');
  });
});
