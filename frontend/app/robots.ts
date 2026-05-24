import type { MetadataRoute } from 'next';
import { headers } from 'next/headers';

/**
 * 5BIB / 5Solution multi-host robots.
 *
 * Each subdomain's `/robots.txt` MUST point to its OWN sitemap (not a
 * cross-host sitemap) and declare its OWN canonical host — otherwise
 * Google treats them as duplicate / orphan.
 *
 * Shared rules across all hosts:
 *   - Disallow /api/, /admin/, /_next/
 *   - F-056 Phase 5: Disallow /runners exact, allow /runners/* profiles
 *
 * Explicit allow for AI crawlers (GPTBot, ChatGPT-User, PerplexityBot,
 * ClaudeBot, Claude-Web, Google-Extended, CCBot, anthropic-ai,
 * Applebot-Extended) — listing them by name signals "we expect you,
 * please cite us" and avoids accidental block via aggressive UA filters
 * at the reverse-proxy layer.
 *
 * FEATURE-A · SEO Uplift v1
 */

function detectHost(rawHost: string | null): string {
  const host = (rawHost ?? '').toLowerCase().split(':')[0];
  if (host.endsWith('5solution.vn')) return '5solution.vn';
  if (host.startsWith('timing.')) return 'timing.5bib.com';
  if (host.startsWith('solution.5sport')) return 'solution.5sport.vn';
  if (host.startsWith('solution.')) return 'solution.5bib.com';
  return '5bib.com';
}

export default async function robots(): Promise<MetadataRoute.Robots> {
  const hdr = await headers();
  const host = detectHost(hdr.get('host'));

  const wildcardRule = {
    userAgent: '*',
    allow: ['/', '/runners/*'],
    disallow: ['/api/', '/admin/', '/_next/', '/runners$'],
  };

  const aiCrawlerNames = [
    'GPTBot',
    'ChatGPT-User',
    'PerplexityBot',
    'ClaudeBot',
    'Claude-Web',
    'Google-Extended',
    'CCBot',
    'anthropic-ai',
    'Applebot-Extended',
  ];

  const aiRules = aiCrawlerNames.map((ua) => ({
    userAgent: ua,
    allow: '/',
  }));

  return {
    rules: [wildcardRule, ...aiRules],
    sitemap: `https://${host}/sitemap.xml`,
    host: `https://${host}`,
  };
}
