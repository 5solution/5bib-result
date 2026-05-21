/**
 * FEATURE-056 scope expansion 2026-05-21 (Phase 4) — Recap Article S3 Storage.
 *
 * Persists generated recap articles as markdown files in S3 with frontmatter
 * metadata. Path convention: `recap-articles/{raceId}/{slug}.md`
 *
 * S3 lifecycle (CLAUDE.md rule 7): NONE — race recap articles are race-day
 * artifacts persisted indefinitely. Admin can manually delete to force regen.
 *
 * Frontmatter format (YAML between `---` fences):
 *   title, summary, category, readMinutes, source, publishedAt, raceId
 *
 * Public read: bucket policy allows public-get on `recap-articles/` prefix
 * (no PII content; markdown is render-only public artifact like courses/).
 */

import { Injectable, Logger } from '@nestjs/common';
import {
  S3Client,
  PutObjectCommand,
  GetObjectCommand,
  DeleteObjectCommand,
  ListObjectsV2Command,
} from '@aws-sdk/client-s3';
import { env } from 'src/config';

import { GeneratedRecapArticle } from './recap-article-generator.service';

const BUCKET = env.s3.bucket;
const REGION = env.s3.region;
const PREFIX = 'recap-articles';

@Injectable()
export class RecapArticleStorage {
  private readonly logger = new Logger(RecapArticleStorage.name);

  constructor(private readonly s3: S3Client) {}

  /**
   * Write articles to S3. Per-article PUT (best-effort parallel).
   * Returns list of S3 keys successfully written.
   */
  async putArticles(
    raceId: string,
    articles: GeneratedRecapArticle[],
  ): Promise<string[]> {
    const writes = articles.map(async (a) => {
      const key = this.buildKey(raceId, a.slug);
      const body = this.serializeArticle(a, raceId);
      try {
        await this.s3.send(
          new PutObjectCommand({
            Bucket: BUCKET,
            Key: key,
            Body: body,
            ContentType: 'text/markdown; charset=utf-8',
            CacheControl: 'public, max-age=3600',
          }),
        );
        return key;
      } catch (err) {
        this.logger.warn(
          `[recap-articles] failed to PUT ${key}: ${(err as Error).message}`,
        );
        return null;
      }
    });

    const results = await Promise.all(writes);
    const ok = results.filter((k): k is string => !!k);
    this.logger.log(
      `[recap-articles] race=${raceId} wrote ${ok.length}/${articles.length} articles to S3`,
    );
    return ok;
  }

  /**
   * Read all articles for a race from S3. Returns parsed array OR null if
   * no articles exist yet for this race.
   */
  async getArticles(
    raceId: string,
  ): Promise<GeneratedRecapArticle[] | null> {
    try {
      const list = await this.s3.send(
        new ListObjectsV2Command({
          Bucket: BUCKET,
          Prefix: `${PREFIX}/${raceId}/`,
        }),
      );
      if (!list.Contents || list.Contents.length === 0) return null;

      const reads = list.Contents.filter((o) => o.Key?.endsWith('.md')).map(
        async (obj) => {
          if (!obj.Key) return null;
          try {
            const res = await this.s3.send(
              new GetObjectCommand({ Bucket: BUCKET, Key: obj.Key }),
            );
            const body = await res.Body?.transformToString('utf-8');
            if (!body) return null;
            return this.deserializeArticle(body);
          } catch (err) {
            this.logger.warn(
              `[recap-articles] failed to GET ${obj.Key}: ${(err as Error).message}`,
            );
            return null;
          }
        },
      );

      const parsed = await Promise.all(reads);
      const articles = parsed.filter((a): a is GeneratedRecapArticle => !!a);

      // Preserve generator order: race-narrative first, winners, then analysis.
      // Use category sort + slug as tie-break.
      const categoryOrder: Record<string, number> = {
        'race-narrative': 0,
        'winner-profile': 1,
        pacing: 2,
        'course-difficulty': 3,
        'age-group': 4,
        'pace-distribution': 5,
      };
      articles.sort((a, b) => {
        const ca = categoryOrder[a.category] ?? 99;
        const cb = categoryOrder[b.category] ?? 99;
        if (ca !== cb) return ca - cb;
        return a.slug.localeCompare(b.slug);
      });

      return articles;
    } catch (err) {
      this.logger.warn(
        `[recap-articles] LIST failed race=${raceId}: ${(err as Error).message}`,
      );
      return null;
    }
  }

  /**
   * Delete all articles for a race. Used by admin regenerate flow.
   */
  async deleteAllForRace(raceId: string): Promise<number> {
    const list = await this.s3.send(
      new ListObjectsV2Command({
        Bucket: BUCKET,
        Prefix: `${PREFIX}/${raceId}/`,
      }),
    );
    if (!list.Contents) return 0;

    const dels = list.Contents.map(async (obj) => {
      if (!obj.Key) return false;
      try {
        await this.s3.send(
          new DeleteObjectCommand({ Bucket: BUCKET, Key: obj.Key }),
        );
        return true;
      } catch (err) {
        this.logger.warn(
          `[recap-articles] DEL failed ${obj.Key}: ${(err as Error).message}`,
        );
        return false;
      }
    });
    const results = await Promise.all(dels);
    const ok = results.filter(Boolean).length;
    this.logger.log(
      `[recap-articles] race=${raceId} deleted ${ok} articles from S3`,
    );
    return ok;
  }

  // ─── Internal helpers ─────────────────────────────────────────────────

  buildKey(raceId: string, slug: string): string {
    return `${PREFIX}/${raceId}/${slug}.md`;
  }

  publicUrl(raceId: string, slug: string): string {
    return `https://${BUCKET}.s3.${REGION}.amazonaws.com/${this.buildKey(raceId, slug)}`;
  }

  private serializeArticle(
    a: GeneratedRecapArticle,
    raceId: string,
  ): string {
    const fm = [
      '---',
      `slug: ${escapeYaml(a.slug)}`,
      `title: ${escapeYaml(a.title)}`,
      `summary: ${escapeYaml(a.summary)}`,
      `category: ${a.category}`,
      `readMinutes: ${a.readMinutes}`,
      `source: ${a.source}`,
      `publishedAt: ${a.publishedAt}`,
      `raceId: ${raceId}`,
      '---',
      '',
    ].join('\n');
    return fm + a.markdown;
  }

  private deserializeArticle(body: string): GeneratedRecapArticle | null {
    const fmMatch = body.match(/^---\n([\s\S]+?)\n---\n([\s\S]*)$/);
    if (!fmMatch) return null;
    const fm = fmMatch[1];
    const markdown = fmMatch[2];

    const get = (key: string): string | null => {
      const m = fm.match(new RegExp(`^${key}:\\s*(.+)$`, 'm'));
      return m ? unescapeYaml(m[1].trim()) : null;
    };

    const slug = get('slug');
    const title = get('title');
    const summary = get('summary');
    const category = get('category') as GeneratedRecapArticle['category'] | null;
    const readMinutesStr = get('readMinutes');
    const source = get('source') as 'auto' | 'admin' | null;
    const publishedAt = get('publishedAt');

    if (!slug || !title || !category || !publishedAt) return null;

    // HTML must be re-rendered from markdown — storage layer doesn't keep
    // the rendered HTML to avoid drift if sanitize allowlist changes.
    // RaceRecapService.assembleArticlesResponse() will re-render.
    return {
      slug,
      title,
      summary: summary ?? '',
      category,
      readMinutes: readMinutesStr ? parseInt(readMinutesStr) || 1 : 1,
      source: source ?? 'auto',
      markdown,
      html: '', // re-rendered downstream
      publishedAt,
    };
  }
}

function escapeYaml(s: string): string {
  // Single-line YAML scalar — wrap in double quotes if special chars present
  if (/[:#\n"'\\]/.test(s)) {
    return `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
  }
  return s;
}

function unescapeYaml(s: string): string {
  if (s.startsWith('"') && s.endsWith('"')) {
    return s.slice(1, -1).replace(/\\"/g, '"').replace(/\\\\/g, '\\');
  }
  return s;
}
