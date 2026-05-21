/**
 * FEATURE-056 scope expansion 2026-05-21 (Phase 4) — Recap Article Generator.
 *
 * Pure factory functions producing auto-generated editorial articles per race.
 * 6 templates, gating per data richness (skip if insufficient data):
 *   1. race-narrative (always renders if race ended + ≥1 finisher)
 *   2. winner-profile-{courseId} (per course with top1 NAM+NỮ)
 *   3. pacing-analysis (≥10 finishers + valid negSplit data)
 *   4. course-difficulty (≥2 courses)
 *   5. age-group-highlights (≥3 AG buckets)
 *   6. pace-distribution (≥10 finishers + valid pace distribution)
 *
 * Output: markdown body + sanitized HTML + metadata. Storage layer
 * (RecapArticleStorage) persists to S3.
 *
 * Per Danny mandate 2026-05-21 "k nó kiện đấy" — neutral factual narrative,
 * no editorial interpretation that could be disputed.
 */

import { Injectable, Logger } from '@nestjs/common';
import sanitizeHtml = require('sanitize-html');

import {
  RaceRecapResponseDto,
  RecapPodiumPerCourseDto,
  RecapAGBreakdownPerCourseDto,
} from '../dto/race-recap-response.dto';

const SANITIZE_OPTIONS: sanitizeHtml.IOptions = {
  allowedTags: [
    'p',
    'h2',
    'h3',
    'strong',
    'em',
    'ul',
    'ol',
    'li',
    'a',
    'br',
    'blockquote',
    // QC 2026-05-21 fix — course-difficulty template emits pipe tables.
    // Sanitize allowlist must mirror markdownToHtml output OR table rows
    // would be stripped on cold-path PUT to S3.
    'table',
    'thead',
    'tbody',
    'tr',
    'th',
    'td',
  ],
  allowedAttributes: { a: ['href', 'rel', 'target'] },
  transformTags: {
    a: sanitizeHtml.simpleTransform('a', {
      rel: 'nofollow noopener',
      target: '_blank',
    }),
  },
};

export interface GeneratedRecapArticle {
  /** Slug for S3 key + URL ref. Unique within race scope. */
  slug: string;
  /** Article H1 title — Vietnamese, factual headline. */
  title: string;
  /** 2-3 sentence teaser for card preview (max 240 chars). */
  summary: string;
  /** Editorial category bucket. */
  category:
    | 'race-narrative'
    | 'winner-profile'
    | 'pacing'
    | 'course-difficulty'
    | 'age-group'
    | 'pace-distribution';
  /** Approx read time minutes derived from word count. */
  readMinutes: number;
  /** Source: 'auto' for generated, 'admin' if admin-overridden. */
  source: 'auto' | 'admin';
  /** Raw markdown body (300-500 words typical). */
  markdown: string;
  /** Pre-rendered sanitized HTML (allowlist trong SANITIZE_OPTIONS). */
  html: string;
  /** ISO timestamp when generated. */
  publishedAt: string;
}

@Injectable()
export class RecapArticleGenerator {
  private readonly logger = new Logger(RecapArticleGenerator.name);

  /**
   * Generate auto-articles for a race based on recap data richness.
   *
   * Order: race-narrative first → winners → analysis → course → AG → pace-dist.
   * Skip individual templates if data insufficient (silent skip, log info).
   *
   * Returns 2-N articles (typically 3-6 depending on data).
   */
  generateForRace(recap: RaceRecapResponseDto): GeneratedRecapArticle[] {
    const out: GeneratedRecapArticle[] = [];

    // 1. Race overall narrative (anchor article — always render if any finisher)
    if (recap.hero.totalFinishers > 0) {
      out.push(this.buildRaceNarrative(recap));
    }

    // 2. Winner profiles per course (longest first)
    const sortedPodiums = [...recap.podiums].sort((a, b) => {
      const da = parseFloat((a.distance ?? '0').replace(',', '.'));
      const db = parseFloat((b.distance ?? '0').replace(',', '.'));
      return db - da;
    });
    for (const podium of sortedPodiums) {
      if (podium.male[0] || podium.female[0]) {
        out.push(this.buildWinnerProfile(recap, podium));
      }
    }

    // 3. Pacing analysis (needs ≥10 finisher + valid negSplit data)
    const firstNeg = recap.negativeSplits[0];
    if (
      firstNeg &&
      (firstNeg.finishersAnalyzed ?? 0) >= 10 &&
      firstNeg.avgFirstHalf &&
      firstNeg.avgSecondHalf
    ) {
      out.push(this.buildPacingAnalysis(recap, firstNeg));
    }

    // 4. Course difficulty (needs ≥2 courses with distribution data)
    if ((recap.finisherDistribution?.length ?? 0) >= 2) {
      out.push(this.buildCourseDifficulty(recap));
    }

    // 5. Age group highlights (needs ≥3 AG buckets across courses)
    const totalBuckets = recap.agBreakdowns.reduce(
      (sum, ag) => sum + ag.buckets.length,
      0,
    );
    if (totalBuckets >= 3) {
      out.push(this.buildAgeGroupHighlights(recap));
    }

    // 6. Pace distribution (needs ≥10 finishers + valid p10/p90)
    const firstPace = recap.paceStats[0];
    if (
      firstPace &&
      firstPace.finisherCount >= 10 &&
      firstPace.p10Pace !== '—' &&
      firstPace.p90Pace !== '—'
    ) {
      out.push(this.buildPaceDistribution(recap, firstPace));
    }

    this.logger.log(
      `[recap-articles] race=${recap.raceId} generated=${out.length} (totalFinishers=${recap.hero.totalFinishers})`,
    );
    return out;
  }

  // ─── Template 1: Race overall narrative ─────────────────────────────────

  private buildRaceNarrative(
    recap: RaceRecapResponseDto,
  ): GeneratedRecapArticle {
    const finishers = recap.hero.totalFinishers.toLocaleString('vi-VN');
    const registered = recap.hero.registered?.toLocaleString('vi-VN') ?? finishers;
    const dnf = recap.hero.dnfCount.toLocaleString('vi-VN');
    const courses = recap.podiums.length;
    const year = recap.endDate
      ? new Date(recap.endDate).getFullYear()
      : new Date().getFullYear();

    const title = `${finishers} VĐV chinh phục ${recap.raceTitle}`;
    const summary = `${recap.raceTitle} kết thúc với ${finishers}/${registered} VĐV về đích trên ${courses} cự ly. ${dnf} VĐV không hoàn thành. Toàn cảnh giải qua các con số.`;

    const md = [
      `# ${title}`,
      ``,
      `${recap.raceTitle} đã chính thức khép lại với **${finishers} VĐV về đích** trên tổng số ${registered} VĐV đăng ký. Tỷ lệ hoàn thành đạt ${Math.round((recap.hero.totalFinishers / Math.max(parseInt(registered.replace(/\D/g, '')) || recap.hero.totalFinishers, 1)) * 100)}%.`,
      ``,
      `## Bức tranh tổng thể`,
      ``,
      `Giải đấu diễn ra trên **${courses} cự ly** khác nhau, phục vụ đa dạng trình độ VĐV từ phong trào đến chuyên nghiệp. Trong đó, ${dnf} VĐV không hoàn thành cuộc đua (DNF) — con số phản ánh độ khó nhất định của cung đường.`,
      ``,
      ...(recap.hero.elevationGain
        ? [
            `## Đặc điểm đường chạy`,
            ``,
            `Tổng elevation gain ghi nhận **${recap.hero.elevationGain.toLocaleString('vi-VN')}m**${recap.hero.elevationSegments ? ` qua ${recap.hero.elevationSegments} đoạn dốc 800m+` : ''} — yếu tố then chốt định hình chiến thuật pacing của VĐV.`,
            ``,
          ]
        : []),
      `## Ý nghĩa`,
      ``,
      `Mỗi VĐV về đích là một câu chuyện riêng — về sự chuẩn bị, ý chí, và niềm tin. ${finishers} câu chuyện ấy gộp lại thành ${recap.raceTitle} ${year}.`,
    ].join('\n');

    return this.finalize({
      slug: 'race-overall-narrative',
      title,
      summary,
      category: 'race-narrative',
      markdown: md,
    });
  }

  // ─── Template 2: Winner profile per course ──────────────────────────────

  private buildWinnerProfile(
    recap: RaceRecapResponseDto,
    podium: RecapPodiumPerCourseDto,
  ): GeneratedRecapArticle {
    const courseLabel = podium.courseName ?? podium.distance ?? podium.courseId;
    const male = podium.male[0];
    const female = podium.female[0];

    const titleParts: string[] = [];
    if (male) titleParts.push(`${male.name} (${male.chipTime})`);
    if (female) titleParts.push(`${female.name} (${female.chipTime})`);
    const title = `Winners ${courseLabel} — ${titleParts.join(' & ')}`;

    const summary = [
      `Cự ly ${courseLabel}:`,
      male ? `Nam ${male.name} ${male.chipTime}.` : '',
      female ? `Nữ ${female.name} ${female.chipTime}.` : '',
    ]
      .filter(Boolean)
      .join(' ')
      .slice(0, 240);

    const mdBlocks: string[] = [
      `# Winners cự ly ${courseLabel}`,
      ``,
      `Hai VĐV xuất sắc nhất cự ly **${courseLabel}** đã ghi tên mình vào bảng vàng ${recap.raceTitle}.`,
      ``,
    ];

    if (male) {
      mdBlocks.push(
        `## Top 1 Nam: ${male.name}`,
        ``,
        `- **BIB**: ${male.bib}`,
        `- **Chip time**: ${male.chipTime}`,
        ...(male.category ? [`- **Age group**: ${male.category}`] : []),
        ...(male.city ? [`- **Đại diện**: ${male.city}`] : []),
        ``,
        `Với thành tích ${male.chipTime}, ${male.name} đã chinh phục cự ly ${courseLabel} ở vị trí dẫn đầu phái mạnh.`,
        ``,
      );
    }

    if (female) {
      mdBlocks.push(
        `## Top 1 Nữ: ${female.name}`,
        ``,
        `- **BIB**: ${female.bib}`,
        `- **Chip time**: ${female.chipTime}`,
        ...(female.category ? [`- **Age group**: ${female.category}`] : []),
        ...(female.city ? [`- **Đại diện**: ${female.city}`] : []),
        ``,
        `${female.name} hoàn thành ${courseLabel} với chip time **${female.chipTime}** — danh hiệu top 1 nữ của giải.`,
        ``,
      );
    }

    if (podium.male.length >= 3 || podium.female.length >= 3) {
      mdBlocks.push(`## Podium đầy đủ`, ``);
      if (podium.male.length >= 2) {
        mdBlocks.push(
          `**Podium Nam:**`,
          ...podium.male.slice(0, 3).map(
            (c, i) => `${i + 1}. ${c.name} — ${c.chipTime}`,
          ),
          ``,
        );
      }
      if (podium.female.length >= 2) {
        mdBlocks.push(
          `**Podium Nữ:**`,
          ...podium.female.slice(0, 3).map(
            (c, i) => `${i + 1}. ${c.name} — ${c.chipTime}`,
          ),
          ``,
        );
      }
    }

    return this.finalize({
      slug: `winner-profile-${podium.courseId}`,
      title,
      summary,
      category: 'winner-profile',
      markdown: mdBlocks.join('\n'),
    });
  }

  // ─── Template 3: Pacing analysis ────────────────────────────────────────

  private buildPacingAnalysis(
    recap: RaceRecapResponseDto,
    neg: NonNullable<RaceRecapResponseDto['negativeSplits']>[number],
  ): GeneratedRecapArticle {
    const pct = neg.negativeSplitPercent;
    const benchmark = neg.benchmark ?? 40;
    const analyzed = neg.finishersAnalyzed?.toLocaleString('vi-VN') ?? '—';
    const courseLabel = neg.courseName;
    const delta = neg.deltaSeconds ?? 0;
    const deltaMin = Math.floor(Math.abs(delta) / 60);
    const deltaSec = Math.abs(delta) % 60;
    const deltaSign = delta >= 0 ? 'chậm hơn' : 'nhanh hơn';

    const title =
      pct < benchmark
        ? `Chỉ ${pct}% VĐV negative split — Race kỹ thuật cao`
        : `${pct}% VĐV negative split — Race friendly pacing`;
    const summary = `Phân tích ${analyzed} finisher có dữ liệu split: ${pct}% chạy nửa sau nhanh hơn nửa đầu (benchmark VN ${benchmark}%). Δ trung bình ${deltaMin}:${String(deltaSec).padStart(2, '0')} ${deltaSign}.`;

    const md = [
      `# ${title}`,
      ``,
      `Phân tích pacing trên **${analyzed} finisher** có đủ dữ liệu split (cự ly ${courseLabel}):`,
      ``,
      `- **AVG 1st half**: ${neg.avgFirstHalf}`,
      `- **AVG 2nd half**: ${neg.avgSecondHalf}`,
      `- **Δ delta**: ${deltaMin}:${String(deltaSec).padStart(2, '0')} ${deltaSign}`,
      `- **Negative split rate**: ${pct}% (benchmark VN ~${benchmark}%)`,
      ``,
      `## Ý nghĩa`,
      ``,
      neg.interpretation,
      ``,
      `## Tại sao điều này quan trọng?`,
      ``,
      `Negative split (chạy nửa sau nhanh hơn nửa đầu) là dấu hiệu của VĐV pacing tốt — không "bung" quá sớm ở đầu. Tỷ lệ ${pct}% ${pct < benchmark ? 'thấp hơn' : 'cao hơn'} benchmark phản ánh ${pct < benchmark ? 'đường chạy có yếu tố kỹ thuật (dốc, terrain) khiến phần lớn VĐV không pacing được đoạn cuối' : 'đường chạy thuận lợi cho chiến lược pacing kiểm soát'}.`,
    ].join('\n');

    return this.finalize({
      slug: 'pacing-analysis',
      title,
      summary,
      category: 'pacing',
      markdown: md,
    });
  }

  // ─── Template 4: Course difficulty comparison ───────────────────────────

  private buildCourseDifficulty(
    recap: RaceRecapResponseDto,
  ): GeneratedRecapArticle {
    const dist = recap.finisherDistribution ?? [];
    const sortedByCount = [...dist].sort(
      (a, b) => b.finisherCount - a.finisherCount,
    );
    const top = sortedByCount[0];
    const hardest = [...dist].sort((a, b) => {
      // Heuristic: slower median pace = harder course
      const paceA = parsePaceSec(a.medianPace);
      const paceB = parsePaceSec(b.medianPace);
      return paceB - paceA;
    })[0];

    const title = `${top.courseName}: cự ly đông nhất với ${top.finisherCount.toLocaleString('vi-VN')} finisher`;
    const summary = `So sánh ${dist.length} cự ly của giải: ${top.courseName} đông nhất, ${hardest.courseName} có pace trung bình chậm nhất (đường khó nhất).`;

    const md = [
      `# ${title}`,
      ``,
      `${recap.raceTitle} chia thành **${dist.length} cự ly** — mỗi cự ly có đặc tính riêng về độ khó và lượng VĐV tham gia.`,
      ``,
      `## Bảng so sánh`,
      ``,
      `| Cự ly | Finisher | Median pace | Best time |`,
      `|-------|----------|-------------|-----------|`,
      ...dist.map(
        (d) =>
          `| ${d.courseName} | ${d.finisherCount.toLocaleString('vi-VN')} | ${d.medianPace ?? '—'} | ${d.bestChipTime ?? '—'} |`,
      ),
      ``,
      `## Cự ly đông nhất`,
      ``,
      `**${top.courseName}** thu hút ${top.finisherCount.toLocaleString('vi-VN')} VĐV về đích — chiếm tỷ trọng lớn nhất giải. Đây là cự ly chủ đạo, thường phù hợp với đa số VĐV phong trào.`,
      ``,
      `## Cự ly khó nhất (theo median pace)`,
      ``,
      `**${hardest.courseName}** có median pace ${hardest.medianPace ?? '—'} — chậm nhất trong các cự ly. Điều này phản ánh độ khó đường chạy (terrain, elevation) hoặc khoảng cách dài đòi hỏi VĐV pacing kiểm soát.`,
    ].join('\n');

    return this.finalize({
      slug: 'course-difficulty',
      title,
      summary,
      category: 'course-difficulty',
      markdown: md,
    });
  }

  // ─── Template 5: Age group highlights ───────────────────────────────────

  private buildAgeGroupHighlights(
    recap: RaceRecapResponseDto,
  ): GeneratedRecapArticle {
    // Flatten all buckets across courses, sort by finisherCount DESC
    const allBuckets: Array<{
      course: RecapAGBreakdownPerCourseDto;
      bucket: RecapAGBreakdownPerCourseDto['buckets'][number];
    }> = [];
    for (const course of recap.agBreakdowns) {
      for (const bucket of course.buckets) {
        allBuckets.push({ course, bucket });
      }
    }
    allBuckets.sort((a, b) => b.bucket.finisherCount - a.bucket.finisherCount);
    const top = allBuckets.slice(0, 3);
    if (top.length === 0) {
      // Should not reach here (gated by caller), but defensive
      return this.finalize({
        slug: 'age-group-highlights',
        title: 'AG breakdown',
        summary: 'Chưa có dữ liệu age group.',
        category: 'age-group',
        markdown: '# AG breakdown\n\nChưa đủ dữ liệu.',
      });
    }

    const title = `Nhóm ${top[0].bucket.category}: cạnh tranh nhất giải với ${top[0].bucket.finisherCount.toLocaleString('vi-VN')} finisher`;
    const summary = `Top 3 nhóm tuổi đông nhất: ${top.map((t) => `${t.bucket.category} (${t.bucket.finisherCount})`).join(', ')}.`;

    const md = [
      `# ${title}`,
      ``,
      `Bảng tổng kết các nhóm tuổi (age group) đông nhất tại ${recap.raceTitle}:`,
      ``,
      ...top.map(
        ({ course, bucket }, i) => [
          `## ${i + 1}. ${bucket.category} — ${course.courseName}`,
          ``,
          `- **Tổng finisher**: ${bucket.finisherCount.toLocaleString('vi-VN')}`,
          `- **Top 3**:`,
          ...bucket.top5
            .slice(0, 3)
            .map((c, j) => `  ${j + 1}. ${c.name} — ${c.chipTime}`),
          ``,
        ].join('\n'),
      ),
      ``,
      `## Ý nghĩa`,
      ``,
      `Số lượng VĐV đông trong một age group phản ánh nhóm tuổi đang dẫn dắt phong trào — thường là nhóm 30-49 tuổi (đỉnh sự nghiệp + thu nhập ổn định + đam mê chạy bộ).`,
    ].join('\n');

    return this.finalize({
      slug: 'age-group-highlights',
      title,
      summary,
      category: 'age-group',
      markdown: md,
    });
  }

  // ─── Template 6: Pace distribution analysis ─────────────────────────────

  private buildPaceDistribution(
    recap: RaceRecapResponseDto,
    pace: NonNullable<RaceRecapResponseDto['paceStats']>[number],
  ): GeneratedRecapArticle {
    const median = pace.medianPace;
    const p10 = pace.p10Pace;
    const p90 = pace.p90Pace;
    const count = pace.finisherCount.toLocaleString('vi-VN');

    const title = `Median pace ${median} — Bức tranh tốc độ ${pace.courseName}`;
    const summary = `${count} finisher cự ly ${pace.courseName}: median ${median}, top 10% chạy dưới ${p10}, bottom 10% trên ${p90}.`;

    const md = [
      `# ${title}`,
      ``,
      `Phân bố pace của **${count} finisher** cự ly ${pace.courseName}:`,
      ``,
      `- **P10 (top 10% nhanh nhất)**: ${p10}`,
      `- **Median (50%)**: ${median}`,
      `- **P90 (bottom 10% chậm nhất)**: ${p90}`,
      ``,
      `## Ý nghĩa`,
      ``,
      `Median ${median} là "tâm" của giải — phần lớn VĐV chạy quanh tốc độ này. Khoảng cách P10 → P90 phản ánh độ đa dạng trình độ: spread lớn = nhiều VĐV phong trào lẫn elite, spread hẹp = đồng đều.`,
      ``,
      `## Bạn ở đâu trên distribution?`,
      ``,
      `Nếu pace cá nhân của bạn dưới ${p10}, bạn thuộc top 10% nhanh nhất giải. Nếu quanh ${median}, bạn ở mức trung bình. Trên ${p90}, bạn thuộc nhóm 10% chậm nhất — vẫn về đích là thành công lớn.`,
    ].join('\n');

    return this.finalize({
      slug: 'pace-distribution',
      title,
      summary,
      category: 'pace-distribution',
      markdown: md,
    });
  }

  // ─── Common finalize: sanitize html + word count ────────────────────────

  private finalize(input: {
    slug: string;
    title: string;
    summary: string;
    category: GeneratedRecapArticle['category'];
    markdown: string;
  }): GeneratedRecapArticle {
    // Convert markdown to basic HTML (lightweight — no full markdown parser
    // dependency; we control template output so simple rules suffice).
    const html = markdownToHtml(input.markdown);
    const sanitized = sanitizeHtml(html, SANITIZE_OPTIONS);
    const wordCount = input.markdown.split(/\s+/).filter((w) => w.length > 0)
      .length;
    const readMinutes = Math.max(1, Math.round(wordCount / 200)); // 200 wpm

    return {
      slug: input.slug,
      title: input.title,
      summary: input.summary.slice(0, 240),
      category: input.category,
      readMinutes,
      source: 'auto',
      markdown: input.markdown,
      html: sanitized,
      publishedAt: new Date().toISOString(),
    };
  }
}

// ─── Internal helpers ─────────────────────────────────────────────────────

function parsePaceSec(pace: string | undefined): number {
  if (!pace || pace === '—') return 0;
  const m = pace.match(/^(\d+):(\d{2})/);
  if (!m) return 0;
  return parseInt(m[1]) * 60 + parseInt(m[2]);
}

/**
 * Lightweight markdown → HTML conversion for OUR template output only.
 * NOT a general-purpose markdown parser. Handles:
 *  - # / ## / ### headings
 *  - **bold** / *italic*
 *  - - / * list items grouped into <ul>
 *  - 1. ordered list items grouped into <ol>
 *  - Pipe-table (header | row | row)
 *  - Blank lines = paragraph break
 *  - [text](href) inline links
 */
function markdownToHtml(md: string): string {
  const lines = md.split('\n');
  const out: string[] = [];
  let inUl = false;
  let inOl = false;
  let inTable = false;

  const closeLists = () => {
    if (inUl) {
      out.push('</ul>');
      inUl = false;
    }
    if (inOl) {
      out.push('</ol>');
      inOl = false;
    }
  };

  for (let i = 0; i < lines.length; i++) {
    const raw = lines[i];
    const line = raw.trim();

    if (line.length === 0) {
      closeLists();
      if (inTable) {
        out.push('</tbody></table>');
        inTable = false;
      }
      continue;
    }

    // Headings
    if (line.startsWith('### ')) {
      closeLists();
      out.push(`<h3>${inline(line.slice(4))}</h3>`);
      continue;
    }
    if (line.startsWith('## ')) {
      closeLists();
      out.push(`<h2>${inline(line.slice(3))}</h2>`);
      continue;
    }
    if (line.startsWith('# ')) {
      closeLists();
      // Skip top-level h1 in body (title rendered separately)
      continue;
    }

    // Pipe table (header detection: line starts with | and next is separator)
    if (line.startsWith('|') && line.endsWith('|')) {
      const nextLine = (lines[i + 1] ?? '').trim();
      if (nextLine.startsWith('|') && /[-:]+/.test(nextLine)) {
        // Table header
        closeLists();
        const headers = line
          .slice(1, -1)
          .split('|')
          .map((h) => h.trim());
        out.push(
          '<table><thead><tr>' +
            headers.map((h) => `<th>${inline(h)}</th>`).join('') +
            '</tr></thead><tbody>',
        );
        inTable = true;
        i++; // skip separator
        continue;
      }
      if (inTable) {
        const cells = line
          .slice(1, -1)
          .split('|')
          .map((c) => c.trim());
        out.push('<tr>' + cells.map((c) => `<td>${inline(c)}</td>`).join('') + '</tr>');
        continue;
      }
    }

    // Unordered list
    if (line.startsWith('- ') || line.startsWith('* ')) {
      if (inOl) {
        out.push('</ol>');
        inOl = false;
      }
      if (!inUl) {
        out.push('<ul>');
        inUl = true;
      }
      out.push(`<li>${inline(line.slice(2))}</li>`);
      continue;
    }

    // Ordered list
    const olMatch = line.match(/^\d+\.\s+(.*)$/);
    if (olMatch) {
      if (inUl) {
        out.push('</ul>');
        inUl = false;
      }
      if (!inOl) {
        out.push('<ol>');
        inOl = true;
      }
      out.push(`<li>${inline(olMatch[1])}</li>`);
      continue;
    }

    // Paragraph
    closeLists();
    out.push(`<p>${inline(line)}</p>`);
  }

  closeLists();
  if (inTable) out.push('</tbody></table>');

  return out.join('\n');
}

function inline(text: string): string {
  let s = escapeHtml(text);
  // bold **text**
  s = s.replace(/\*\*([^*]+)\*\*/g, '<strong>$1</strong>');
  // italic *text* (after bold to avoid conflict)
  s = s.replace(/(^|[^*])\*([^*\n]+)\*(?!\*)/g, '$1<em>$2</em>');
  // link [text](href)
  s = s.replace(/\[([^\]]+)\]\(([^)]+)\)/g, '<a href="$2">$1</a>');
  return s;
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;');
}
