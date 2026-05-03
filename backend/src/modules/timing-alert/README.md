# Timing Miss Alert Module — v1.0

> **Status:** Phase 0 + Phase 1A shipped (skeleton + crypto + config CRUD)
> **Spec ref:** `5BIB_PRD_TimingMissAlert_v1.0.md` (final v1.0.2)
> **Branch:** `5bib_racemonitor_v1`

## Mục đích

Phát hiện VĐV miss timing point realtime trong race day. Alert CRITICAL khi top age group bị miss → ngăn trao nhầm giải (case BIB 98898 race 192 02/05/2026).

**Module ĐỘC LẬP HOÀN TOÀN với MySQL legacy:**
- ✅ MongoDB write/read (3 collection: configs, alerts, polls)
- ✅ HTTP RaceResult Simple API (Phase 1B+ qua `RaceResultApiService` shared từ Phase 0)
- ❌ KHÔNG TypeORM connection
- ❌ KHÔNG `'platform'` named connection
- ❌ KHÔNG sờ `5bib_platform_live`

Athlete metadata 100% từ RR API response (`Bib`, `Firstname`, `Lastname`, `Contest`, `Category`, `Gender`).

## Setup env

```bash
# 32-byte key (hex 64 chars OR base64 44 chars)
TIMING_ALERT_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Per-config 60-300s, default cho config mới
TIMING_ALERT_DEFAULT_POLL_INTERVAL=90

# Phase 1C — Telegram CRITICAL push
TIMING_ALERT_TELEGRAM_CHAT_ID=
```

**Conditional load:** module chỉ wire vào app khi `TIMING_ALERT_ENCRYPTION_KEY` non-empty. Pattern giống `Reconciliation` theo `PLATFORM_DB_HOST`.

## Architecture

```
┌─ Admin UI (Phase 2) ──────────────────────┐
│  /races/[id]/timing-alerts/               │
└──────────┬────────────────────────────────┘
           │ POST/GET config
           ▼
┌─ TimingAlertAdminController (Phase 1A) ───┐
│  + LogtoAdminGuard                         │
└──────────┬────────────────────────────────┘
           ▼
┌─ TimingAlertConfigService (Phase 1A) ──────┐
│  upsert / getByRaceId / decryptKeyForPoll  │
└──────────┬────────────────────────────────┘
           │ encrypt
           ▼
┌─ ApiKeyCrypto (AES-256-GCM) ──────────────┐
│  random IV + authTag verify               │
└────────────────────────────────────────────┘

         (Phase 1B sẽ thêm)
┌─ TimingAlertPollCron @Cron(90s/race) ─────┐
│  inject RaceResultApiService (Phase 0)    │
│  → MissDetectorService                     │
│  → ProjectedRankService                    │
│  → TimingAlertSseService                   │
└────────────────────────────────────────────┘
```

## API endpoints (Phase 1A)

| Method | Path | Description |
|--------|------|-------------|
| `POST` | `/api/admin/races/:raceId/timing-alert/config` | Upsert config — encrypt API keys |
| `PUT` | `/api/admin/races/:raceId/timing-alert/config` | Alias of POST |
| `GET` | `/api/admin/races/:raceId/timing-alert/config` | Read masked config |

All endpoints behind `LogtoAdminGuard`. Response NEVER trả plaintext API key — masked `LE2K...7VWA (32 chars)`.

## Mongo collections

| Collection | Purpose | TTL |
|------------|---------|-----|
| `timing_alert_configs` | Per-race config (RR API keys ENCRYPTED, checkpoints, cutoffs) | ∞ |
| `timing_alerts` | Alert state (OPEN/RESOLVED/FALSE_ALARM) + audit log | ∞ |
| `timing_alert_polls` | Poll cycle audit log | **90 days** (`expireAfterSeconds`) |

**Indexes:**
- `timing_alerts.{race, bib}` unique partial filter `status: 'OPEN'` — re-detect tăng `detection_count` thay vì insert mới
- `timing_alerts.{race, severity, status}` — admin filter
- `timing_alerts.first_detected_at: -1` — sort recent
- `timing_alert_configs.{enabled}` — Phase 1B cron tìm enabled races nhanh
- `timing_alert_polls.started_at: 1` TTL 90d — auto DELETE

## Security

| Item | Implementation |
|------|----------------|
| API key at rest | AES-256-GCM, random 12-byte IV per encrypt, 16-byte authTag verify |
| API key in API response | Masked qua `ApiKeyCrypto.mask()` — never plaintext |
| API key in error log | Regex masking 32-char tokens trong `RaceResultApiService.maskUrl` |
| Audit trail | `enabled_by_user_id` từ Logto JWT `req.user.sub` (chống spoof body) |
| Decrypt boundary | `decryptKeyForPoll()` chỉ exposed qua DI service, KHÔNG có HTTP endpoint |

**Key rotation:** Phase 1A chấp nhận manual rotate qua POST config (re-input plaintext). Phase 2 nếu cần auto-rotate scheduler.

**Key format limitation:** mask regex `/[A-Z0-9]{32}/` specific cho RR Simple API token format hiện tại. Nếu vendor đổi format → silent leak. Phase 1C plan structured logging để mọi key luôn pass qua `ApiKeyCrypto.mask()`.

## Verification log

`verification-timing-alert.md` (root repo) — TA-1..TA-20 evidence. Phase 1A coverage: TA-1, TA-2, TA-3, TA-19. Phase 1B sẽ cover TA-4..TA-18, TA-20.

## Next phases

- **Phase 1B (BLOCK PAUSE #1):** Poll engine + miss detector 3-tier + projected rank + auto-resolve
- **Phase 1C (BLOCK PAUSE #8):** SSE realtime stream + Telegram CRITICAL push
- **Phase 2:** Admin UI dashboard + sound + browser push
- **Phase 3:** Pilot race
