# Timing Alert Simulator

Standalone HTTP server mô phỏng RaceResult Simple API endpoint — test Timing Alert system end-to-end mà KHÔNG cần real race ongoing.

## Quick start

### 1. Tạo encryption key + start BE

```bash
cd backend
export TIMING_ALERT_ENCRYPTION_KEY=$(node -e "console.log(require('crypto').randomBytes(32).toString('base64'))")

# Override RR API base URL → simulator
export RACERESULT_API_BASE_URL=http://localhost:8090

npm run start:dev
```

### 2. Start simulator

```bash
# Terminal 2 — sim với speed 60x (1 phút sim = 1 giây real)
cd backend
npx ts-node scripts/timing-alert-simulator/simulator.ts \
  --scenario=scripts/timing-alert-simulator/scenarios/bib-98898-replay.json \
  --speed=60 \
  --port=8090

# Output:
# 🎮 Timing Alert Simulator listening on port 8090
#    Scenario: BIB 98898 Replay (race 192 — 02/05/2026 case)
#    Speed: 60x (race 06:00:00 → wall-clock 00:06:00)
```

### 3. POST timing-alert config

```bash
# Race document Mongo `_id` (admin pre-create race)
RACE_ID="69f2ca611e1147680ebea4c6"

# Config với rr_event_id="sim-event" + key dummy (sim ignores)
curl -X POST http://localhost:8081/api/admin/races/$RACE_ID/timing-alert/config \
  -H "Content-Type: application/json" \
  -H "Authorization: Bearer $LOGTO_JWT" \
  -d '{
    "rr_event_id": "sim-event",
    "rr_api_keys": { "42KM": "DUMMY_KEY_IGNORED_BY_SIM" },
    "course_checkpoints": {
      "42KM": [
        { "key": "Start", "distance_km": 0 },
        { "key": "TM1", "distance_km": 10 },
        { "key": "TM2", "distance_km": 21 },
        { "key": "TM3", "distance_km": 32 },
        { "key": "Finish", "distance_km": 42.195 }
      ]
    },
    "poll_interval_seconds": 60,
    "overdue_threshold_minutes": 30,
    "top_n_alert": 3,
    "enabled": true
  }'
```

### 4. Watch logs

- BE logs: `[poll-cron] races=1 ok=1 ms=...` mỗi 30s tick
- Sim logs: `[sim] simTime=00:30:00 finished=0/7` mỗi 5s
- Khi sim time vượt threshold (~30 phút sim) → BE alerts trigger:
  ```
  [pollCourse] race=... course=42KM fetched=7 created=4 resolved=0 ms=...
  ```
- Tab admin Timing Alerts → SSE stream events `alert.created` realtime

## Scenarios

| File | Athletes | Duration | Purpose |
|------|----------|----------|---------|
| `bib-98898-replay.json` | 7 | 6h | Replay BIB 98898 case + 3 Top AG nam 40-49 finishers — verify CRITICAL severity |
| `synthetic-3500.json` | 3500 | 7h | Stress test với realistic pace distribution + ~70 misses (60% Finish + 40% intermediate) |

Tạo scenario mới: copy template + edit theo `_schema.md`.

## Sim endpoints

| Endpoint | Purpose |
|----------|---------|
| `GET /sim/status` | Sim state JSON (sim_seconds, ended, athlete count) |
| `POST /sim/reset` | Reset sim clock to 0 (re-run scenario without restart server) |
| `GET /{eventId}/{key}?course=42KM` | RR API mock — Timing Alert poll service hits this |

## Speed factor

| Speed | 6h race → real-time | Use case |
|-------|---------------------|----------|
| 1 | 6 giờ | Long-form test — race day rehearsal |
| 60 | 6 phút | Smoke test — verify alerts trigger correctly |
| 600 | 36 giây | Fast iteration — debug detection logic |

## Verify alert flow

1. Sim start, sim_seconds=0 → BE poll cycle returns 0 alerts (no athletes past threshold yet)
2. Sim seconds ≈ 30 phút (real-time với speed 60 = 30s wall-clock) → first alerts xuất hiện cho athletes có pace slow
3. Sim seconds ≈ 2-3h → BIB 98898 đạt TM3 nhưng KHÔNG có Finish → projected rank Nam 40-49 = 2 (sau 1 athlete đã Finish) → severity = CRITICAL
4. Telegram (nếu config TIMING_ALERT_TELEGRAM_CHAT_ID) → 1 message duy nhất per race per 15min
5. Sim seconds ≈ 5h → tất cả athletes đáng lẽ Finish → BIB 98898 vẫn miss → alert vẫn OPEN, KHÔNG auto-resolve
