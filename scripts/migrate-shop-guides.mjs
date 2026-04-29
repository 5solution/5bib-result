/**
 * One-off migration: shop.5bib.com user-guide articles → hotro.5bib.com.
 *
 * Runs inside the backend container (Node 22, has node_modules: cheerio,
 * mongodb, @aws-sdk/client-s3). Reads env vars from backend.env.
 *
 * Steps per article:
 *   1. Fetch HTML from shop.5bib.com/<slug>
 *   2. Parse: title, body HTML (.content-page.rte), <img src="..."> list
 *   3. Download each image, upload to S3 prefix articles/migration-2026-04/<slug>/<i>.<ext>
 *   4. Rewrite <img src> in body HTML to S3 URLs (CDN-hosted)
 *   5. Build article doc + insert/upsert into PROD Mongo `articles` collection
 *
 * Skip articles that 404. Log every step. Idempotent: upsert by slug.
 */
import { load } from 'cheerio';
import { MongoClient } from 'mongodb';
import { S3Client, PutObjectCommand } from '@aws-sdk/client-s3';

const SLUGS = [
  'huong-dan-su-dung-5bib-mobile-app-mua-ve',
  'mua-nhom',
  'huong-dan-su-dung-5bib-mobile-app-check-in',
  'nhan-chuyen-nhuong',
  'uy-quyen-racekit',
  'cap-nhat-thong-tin-uy-quyen',
  'huong-dan-su-dung-5bib-mobile-app-chuyen-nhuong-ve',
  'chinh-sua-thong-tin',
  'dang-nhap',
  'doi-mat-khau',
  'them-ho-so-van-dong-vien',
  'ghi-danh',
  'huong-dan-quay-bib-tren-he-thong-5bib',
  'huong-dan-thay-doi-cu-ly',
];

const SOURCE_BASE = 'https://shop.5bib.com';
const TARGET_CATEGORY = 'tinh-nang-5bib';
const FEATURED_SLUG = 'huong-dan-su-dung-5bib-mobile-app-mua-ve';
const AUTHOR_NAME = '5BIB Team';
const AUTHOR_ID = 'system-migration-2026-04';

const env = (key, fallback) => {
  const v = process.env[key];
  if (!v && fallback === undefined) throw new Error(`Missing env: ${key}`);
  return v ?? fallback;
};

const log = (...a) => console.log(`[${new Date().toISOString()}]`, ...a);

async function fetchArticle(slug) {
  const url = `${SOURCE_BASE}/${slug}`;
  const res = await fetch(url, {
    headers: { 'User-Agent': 'Mozilla/5.0 5bib-content-migration/1.0' },
  });
  if (!res.ok) {
    log(`  ✗ fetch ${slug} → ${res.status}`);
    return null;
  }
  return await res.text();
}

function parseArticle(html, slug) {
  const $ = load(html);
  // <title>Title — 5BIB Shop</title> → strip suffix
  let title = ($('title').first().text() || '').trim();
  title = title.replace(/\s+/g, ' ').replace(/\s*[—|·-]\s*5BIB.*$/i, '').trim();

  // Body container: Sapo theme uses `.content-page.rte` for blog content.
  let bodyEl = $('.content-page.rte').first();
  if (!bodyEl.length) bodyEl = $('article').first();
  if (!bodyEl.length) bodyEl = $('.body_content').first();

  // Strip layout-y tags + Shopify cruft from the body before serialising.
  bodyEl.find('script, style, .breadcrumb, nav, .product-tags').remove();

  // Collect images BEFORE serializing so we can rewrite srcs in place.
  const imgs = [];
  bodyEl.find('img').each((i, el) => {
    let src = $(el).attr('src') || $(el).attr('data-src') || '';
    if (!src) return;
    if (src.startsWith('//')) src = 'https:' + src;
    else if (src.startsWith('/')) src = `${SOURCE_BASE}${src}`;
    const alt = $(el).attr('alt') || '';
    imgs.push({ index: imgs.length, src, alt, $el: $(el) });
  });

  // Strip the auto-suggested next/prev "Bài viết liên quan" tail Sapo injects.
  bodyEl.find('.related-articles, .post-related').remove();

  return { title, $, bodyEl, imgs };
}

const sniffExt = (url) => {
  const m = url.match(/\.(jpe?g|png|webp|gif)(\?|$)/i);
  return m ? m[1].toLowerCase().replace('jpeg', 'jpg') : 'jpg';
};

async function uploadImage(s3, bucket, slug, idx, srcUrl) {
  const res = await fetch(srcUrl, {
    headers: { 'User-Agent': 'Mozilla/5.0 5bib-content-migration/1.0' },
  });
  if (!res.ok) {
    log(`  ✗ image ${idx} fetch failed ${res.status}: ${srcUrl}`);
    return null;
  }
  const buf = Buffer.from(await res.arrayBuffer());
  const ext = sniffExt(srcUrl);
  const key = `articles/migration-2026-04/${slug}/${idx}.${ext}`;
  const contentType = ext === 'png' ? 'image/png' : ext === 'webp' ? 'image/webp' : ext === 'gif' ? 'image/gif' : 'image/jpeg';
  await s3.send(new PutObjectCommand({
    Bucket: bucket, Key: key, Body: buf, ContentType: contentType,
    CacheControl: 'public, max-age=31536000, immutable',
  }));
  return `https://${bucket}.s3.ap-southeast-1.amazonaws.com/${key}`;
}

function buildExcerpt($, bodyEl) {
  const firstP = bodyEl.find('p').first().text().trim();
  const text = firstP || bodyEl.text().trim();
  return text.replace(/\s+/g, ' ').slice(0, 180).trim();
}

function computeReadTime(text) {
  const words = text.split(/\s+/).filter(Boolean).length;
  return Math.max(1, Math.ceil(words / 200));
}

async function processOne(slug, s3, bucket, articlesCol) {
  log(`→ ${slug}`);
  const html = await fetchArticle(slug);
  if (!html) return { slug, ok: false, reason: 'fetch_failed' };

  const parsed = parseArticle(html, slug);
  const { title, $, bodyEl, imgs } = parsed;
  if (!title || !bodyEl.length) {
    return { slug, ok: false, reason: 'parse_failed' };
  }
  log(`  title: "${title}" · ${imgs.length} images`);

  // Upload + rewrite each image src
  let coverImageUrl = '';
  for (const img of imgs) {
    const newUrl = await uploadImage(s3, bucket, slug, img.index, img.src);
    if (newUrl) {
      img.$el.attr('src', newUrl);
      img.$el.removeAttr('data-src');
      img.$el.removeAttr('data-thumb');
      if (!coverImageUrl) coverImageUrl = newUrl;
    } else {
      // Drop the broken image rather than leaving a dead bizweb URL.
      img.$el.remove();
    }
  }

  const bodyHtml = bodyEl.html()?.trim() || '';
  const plainText = bodyEl.text().replace(/\s+/g, ' ').trim();
  const excerpt = buildExcerpt($, bodyEl);
  const readTime = computeReadTime(plainText);

  // _id intentionally omitted — let MongoDB generate ObjectId. The Mongoose
  // Article schema treats _id as ObjectId; passing a UUID string here breaks
  // any related-articles query that re-casts _id back to ObjectId.
  const doc = {
    title,
    slug,
    type: 'help',
    products: ['5bib'],
    category: TARGET_CATEGORY,
    content: bodyHtml,
    excerpt,
    coverImageUrl,
    seoTitle: title.slice(0, 60),
    seoDescription: excerpt.slice(0, 158),
    status: 'published',
    publishedAt: new Date(),
    featured: slug === FEATURED_SLUG,
    authorId: AUTHOR_ID,
    authorName: AUTHOR_NAME,
    authorAvatar: '',
    readTimeMinutes: readTime,
    viewCount: 0,
    helpfulYes: 0,
    helpfulNo: 0,
    isDeleted: false,
    createdAt: new Date(),
    updatedAt: new Date(),
  };

  // Upsert by slug. createdAt preserved on existing rows; new rows get _id
  // auto-generated by MongoDB (ObjectId).
  const { createdAt: docCreatedAt, ...updates } = doc;
  await articlesCol.updateOne(
    { slug },
    { $set: updates, $setOnInsert: { createdAt: docCreatedAt } },
    { upsert: true },
  );

  log(`  ✓ upserted · cover=${coverImageUrl ? 'yes' : 'no'} · ${readTime}m read · ${imgs.length} imgs`);
  return { slug, ok: true, title, imgs: imgs.length, readTime };
}

(async () => {
  const mongoUrl = env('MONGODB_URL');
  const mongoDb = env('MONGODB_DB_NAME');
  const awsRegion = env('AWS_REGION', 'ap-southeast-1');
  const awsBucket = env('AWS_S3_BUCKET');
  const awsAccessKey = env('AWS_ACCESS_KEY_ID');
  const awsSecretKey = env('AWS_SECRET_ACCESS_KEY');

  log(`MongoDB: ${mongoUrl.replace(/:[^:@]+@/, ':***@')} db=${mongoDb}`);
  log(`S3: ${awsBucket} (${awsRegion})`);

  const s3 = new S3Client({
    region: awsRegion,
    credentials: { accessKeyId: awsAccessKey, secretAccessKey: awsSecretKey },
  });

  const client = new MongoClient(mongoUrl);
  await client.connect();
  const articlesCol = client.db(mongoDb).collection('articles');

  const results = [];
  for (const slug of SLUGS) {
    try {
      results.push(await processOne(slug, s3, awsBucket, articlesCol));
    } catch (err) {
      log(`  ✗ ${slug} threw: ${err.message}`);
      results.push({ slug, ok: false, reason: err.message });
    }
  }

  await client.close();

  log('\n=== SUMMARY ===');
  const ok = results.filter((r) => r.ok);
  const fail = results.filter((r) => !r.ok);
  log(`Success: ${ok.length}/${SLUGS.length}`);
  ok.forEach((r) => log(`  ✓ ${r.slug} — "${r.title}" (${r.imgs} imgs, ${r.readTime}m)`));
  if (fail.length) {
    log(`Failed: ${fail.length}`);
    fail.forEach((r) => log(`  ✗ ${r.slug} — ${r.reason}`));
  }
})();
