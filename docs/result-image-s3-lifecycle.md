# Result Image Creator — S3 Lifecycle & Infra Handover

**Purpose**: Generated result images are cached on S3 for 24h to deduplicate
renders across the 5000-concurrent-user target. After that window they must be
deleted so the bucket stays bounded (worst-case: 50k generations × 1.2 MB = 60
GB/day; 24h expiration caps steady-state at ~60 GB).

This doc has two sections:
1. **AWS CDK snippet** — paste into the existing infra stack.
2. **Manual console fallback** — click-through instructions if CDK isn't in
   use for this bucket yet.

---

## 1) AWS CDK snippet (preferred)

Add the following lifecycle rule to the S3 bucket used by `AWS_S3_BUCKET`
(shared bucket with other 5BIB media — ring-fenced by `result-images/`
prefix).

### `lib/infra-stack.ts` (or whichever stack owns the bucket)

```ts
import { Duration } from 'aws-cdk-lib';
import { Bucket, LifecycleRule, StorageClass } from 'aws-cdk-lib/aws-s3';

// If the bucket is already declared elsewhere, import it instead of creating.
// const bucket = Bucket.fromBucketName(this, 'SharedMediaBucket', '5bib-media');

const resultImageLifecycle: LifecycleRule = {
  id: 'result-image-24h-expiration',
  enabled: true,
  prefix: 'result-images/',          // scoped — does NOT touch logos, uploads, etc.
  expiration: Duration.days(1),       // S3 minimum granularity is 1 day
  abortIncompleteMultipartUploadAfter: Duration.days(1),
  // Optional: transition to cheaper tier after 12h if we ever see >24h hits
  // transitions: [{
  //   storageClass: StorageClass.ONE_ZONE_INFREQUENT_ACCESS,
  //   transitionAfter: Duration.hours(12),
  // }],
};

bucket.addLifecycleRule(resultImageLifecycle);
```

### If the bucket is new:

```ts
const bucket = new Bucket(this, 'FivebibMedia', {
  bucketName: '5bib-media',
  lifecycleRules: [resultImageLifecycle],
  cors: [{
    allowedMethods: ['GET' as any, 'HEAD' as any],
    allowedOrigins: [
      'https://result.5bib.com',
      'https://result-dev.5bib.com',
    ],
    allowedHeaders: ['*'],
    maxAge: 3600,
  }],
  blockPublicAccess: undefined, // keep default; result images are served via presigned URLs
});
```

### Why `expiration: Duration.days(1)` and not hours?

S3 Object Expiration runs **once per day** as a background sweep — it does
not honor sub-day precision. The actual delete may fire any time during the
24–48h window after the object's `Last-Modified`. That's fine for our use:
the render cache is a soft cache (backend falls back to fresh render if the
S3 object is gone), and we pay at most 2× the steady-state bytes.

---

## 2) Manual AWS Console fallback

If the infra isn't CDK-managed yet, do this click-through:

1. Open **S3 Console → Buckets → `5bib-media`** (or whichever bucket the
   backend's `AWS_S3_BUCKET` env points at).
2. Tab **Management → Lifecycle rules → Create lifecycle rule**.
3. Fill in:
   - **Rule name**: `result-image-24h-expiration`
   - **Status**: Enabled
   - **Scope**: *Limit the scope using one or more filters*
   - **Prefix**: `result-images/`
   - **Object size**: leave empty (all sizes)
4. **Lifecycle rule actions** → check **Expire current versions of objects**
   and **Delete expired object delete markers or incomplete multipart
   uploads**.
5. **Expire current versions**: `1 day(s) after object creation`
6. **Delete incomplete multipart uploads**: `1 day(s) after initiation`
7. Review → Create rule.

**Verify** after 24–48h:
```bash
aws s3 ls s3://5bib-media/result-images/ --recursive | wc -l
```
Should stabilise — if growing unbounded, the rule didn't apply. Check the
rule name + prefix on the bucket.

---

## 3) CORS prerequisite

The generated images are served via presigned URLs (see `UploadService`).
The bucket must return `Access-Control-Allow-Origin` for at least:
- `https://result.5bib.com` (prod)
- `https://result-dev.5bib.com` (dev)
- `http://localhost:3002` (local dev)

If already configured for logo uploads, leave it alone. If not, under
**Permissions → CORS** paste:

```json
[
  {
    "AllowedHeaders": ["*"],
    "AllowedMethods": ["GET", "HEAD"],
    "AllowedOrigins": [
      "https://result.5bib.com",
      "https://result-dev.5bib.com",
      "http://localhost:3002"
    ],
    "ExposeHeaders": [],
    "MaxAgeSeconds": 3600
  }
]
```

---

## 4) IAM: backend needs `s3:PutObject` + `s3:GetObject` on the prefix

The existing backend IAM user (used for logo uploads) already has these. No
change needed unless a separate principal will render images — in that case
scope the policy to `arn:aws:s3:::5bib-media/result-images/*`.

---

## 5) Observability checklist (post-deploy)

After lifecycle is live:

- [ ] CloudWatch metric: `NumberOfObjects` on `5bib-media` should plateau
      within 48h of first traffic at steady-state level.
- [ ] Daily expiration report: S3 Console → bucket → **Metrics → Lifecycle
      requests** — should show non-zero `Expire` counts once there's traffic
      older than 24h.
- [ ] Backend log should NOT report a surge of cache misses — if every
      request is rendering fresh, the bucket prefix is wrong or access is
      failing.

---

## 6) Rollback

Lifecycle rules are safe to disable without data loss — toggle the rule
status to **Disabled** in the console, or comment out the `addLifecycleRule`
call in CDK and redeploy. Existing expired objects are gone (this is S3),
but the cache will rebuild on-demand.

---

## Redis key registry (for reference)

These keys back the same system and are documented in `CLAUDE.md` — included
here so the dev knows what to monitor:

| Key | TTL | Purpose |
|-----|-----|---------|
| `ric:render-lock:{raceId}:{bib}:{hash}` | 60s | Single-flight lock across instances |
| `ric:share-count:{raceId}` | persistent | Redis INCR counter for live share badge |
| `ric:share-dedupe:{raceId}:{bib}:{minute}` | 60s | Double-click dedupe |
| `ric:badge-cache:{raceId}:{bib}` | 1h | Computed badge list |
| `ric:gen-progress:{raceId}:{bib}:{hash}` | 30s | Progress polling during generation |

`RENDER_MAX_CONCURRENT=8` is the in-process semaphore cap — tune per CPU on
the container spec (2 vCPU → 8 is safe with @napi-rs/canvas).

---

**Handover contact**: @dev-infra. Feature owner: @backend. Questions about
the lifecycle window go to PM (24h is a product decision, not a technical
constraint).
