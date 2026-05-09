# Timing Miss Alert v1.0 — Pilot Race Runbook

> **Audience:** 5BIB internal team race day
> **Pre-condition:** PR `5bib_racemonitor_v1` đã merge + DEV deploy verified

---

## A. Pre-race day (T-7 ngày)

### A1. Generate encryption key + deploy

```bash
# Local generate (anh chạy 1 lần)
node -e "console.log(require('crypto').randomBytes(32).toString('base64'))"

# Save vào secret manager + .env DEV/PROD
TIMING_ALERT_ENCRYPTION_KEY=<generated-base64>
TIMING_ALERT_DEFAULT_POLL_INTERVAL=90
TIMING_ALERT_TELEGRAM_CHAT_ID=<chat-id-5bib-internal>
```

CI auto-deploy sau push merge → verify backend container loaded:

```bash
ssh 5solution-vps "docker logs 5bib-result-backend --tail 50 | grep -i 'timing'"
# Expect: "Timing alert Telegram enabled — chat_id=...***"
```

### A2. Pre-race day rehearsal với simulator

```bash
# Terminal 1 — DEV BE pointing tới simulator (override RR base URL)
ssh 5solution-vps "docker exec 5bib-result-backend printenv | grep RACERESULT"
# Default: https://api.raceresult.com

# Local: chạy simulator + scenario stress test
cd backend
npx ts-node scripts/timing-alert-simulator/simulator.ts \
  --scenario=synthetic-3500.json --speed=600 --port=8090

# Open ngrok / cloudflare tunnel để DEV BE access localhost:8090
ngrok http 8090
# → https://abc123.ngrok.app

# Set DEV env override
ssh 5solution-vps "
  sed -i 's|RACERESULT_API_BASE_URL=.*|RACERESULT_API_BASE_URL=https://abc123.ngrok.app|' /opt/5bib-result/backend.env
  cd /opt/5bib-result && docker compose restart 5bib-result-backend
"

# Trên admin DEV → tạo race test → POST timing-alert config với rr_event_id="sim-event"
# Watch alerts trigger trong 6-10 phút wall-clock
```

**Verify checklist:**
- [ ] Cron tick mỗi 30s `[poll-cron] races=1 ok=1 ms=...`
- [ ] Alert CRITICAL xuất hiện trong admin Timing Alerts page
- [ ] Telegram nhận 1 message duy nhất per race per 15 phút
- [ ] Sound 880Hz trigger khi browser tab admin đang mở
- [ ] SSE stream realtime — không cần F5 refresh
- [ ] Resolve action → audit_log append + alert disappear khỏi OPEN list

### A3. Reset env về production sau rehearsal

```bash
ssh 5solution-vps "
  sed -i 's|RACERESULT_API_BASE_URL=.*|RACERESULT_API_BASE_URL=https://api.raceresult.com|' /opt/5bib-result/backend.env
  cd /opt/5bib-result && docker compose restart 5bib-result-backend
"
```

---

## B. T-1 ngày (race day eve)

### B1. Pre-race config

BTC chuẩn bị:
- RaceResult event ID + API keys per course
- Course checkpoints (key + distance_km, đặc biệt PHẢI có "Finish" cuối)
- Cutoff times per course (HH:MM:SS)
- Race start + end ISO datetime (cho TA-14 active window filter)

Vào admin: `https://admin.5bib.com/races/{raceId}/timing-alerts/config`

POST config:
```json
{
  "rr_event_id": "396207",
  "rr_api_keys": {
    "42KM": "NFSJ1OMPKSSU35EWUD8XR8NJQBOFAS1Q",
    "21KM": "L1OBQ5XKDQ5T358TMPZWS0B8QKW3X9WR"
  },
  "course_checkpoints": {
    "42KM": [
      { "key": "Start", "distance_km": 0 },
      { "key": "TM1", "distance_km": 10 },
      { "key": "TM2", "distance_km": 21 },
      { "key": "TM3", "distance_km": 32 },
      { "key": "Finish", "distance_km": 42.195 }
    ]
  },
  "cutoff_times": { "42KM": "08:00:00" },
  "event_start_iso": "2026-05-15T05:00:00+07:00",
  "event_end_iso": "2026-05-15T13:00:00+07:00",
  "poll_interval_seconds": 90,
  "overdue_threshold_minutes": 30,
  "top_n_alert": 3,
  "enabled": false
}
```

**KHÔNG enable=true ngay** — sẽ enable trước race start 30 phút.

### B2. Verify config

- [ ] GET config → response có masked API keys (`LE2K...7VWA (32 chars)`), KHÔNG plaintext
- [ ] Race document Mongo `_id` khớp URL
- [ ] Course checkpoints distances strictly increasing với "Finish" cuối
- [ ] Cutoff times set cho mỗi course

---

## C. Race day

### C1. T-30 phút trước race start

```bash
# Enable monitoring
PATCH /api/admin/races/{raceId}/timing-alert/config với enabled=true

# Verify cron picked up
ssh 5solution-vps "docker logs 5bib-result-backend --tail 100 | grep poll-cron"
# Expect: [poll-cron] races=1 ok=1 ms=... cứ 30s
```

### C2. T+30 phút (alerts đầu tiên expected)

- Mở 2 admin tab (timing operator + 5BIB on-call dev)
- Sound enabled cho cả 2
- Browser notification permission granted

Nếu KHÔNG thấy alerts trong 60 phút sau khi athletes pass điểm đầu tiên:
- Check `/poll-logs` → status=FAILED nào không?
- SSH check `docker logs ... | grep timing-alert` → error?
- Force poll: `POST /timing-alert/poll`

### C3. Critical alert handling

Khi nhận CRITICAL alert:
1. **Verify ngay** với BTC bằng radio/Zalo (chip có thật miss hay vendor lag?)
2. **Cross-check camera/photo** finish area → athlete đã about chưa?
3. **Quyết định:**
   - Confirmed miss thật → mark RESOLVE với note "Manual add Finish time vào RR + radio confirm BTC trao giải đúng"
   - Vendor lag (chip xuất hiện sau) → mark RESOLVE với note "RR API delay, athlete actually finished"
   - DNF confirmed → mark FALSE_ALARM với note "DNF tại checkpoint X verified by camera/operator"

### C4. Mass mat failure (Phase 2 future, manual handle Phase 1)

Nếu thấy >10 alerts cùng `missing_point` trong 5 phút:
- Likely mat failure tại điểm đó
- Telegram channel ping team timing partner
- Bulk action (Phase 2) chưa có → resolve từng alert với note "Mat failure point X — re-import sau race"

---

## D. Post-race

### D1. Disable monitoring

T+1h sau Finish closed:
```
PATCH config với enabled=false
```

### D2. Export poll logs

```bash
GET /api/admin/races/{raceId}/timing-alert/poll-logs?limit=200
```

Save JSON cho post-mortem analysis. TTL 90 ngày, sau đó tự DELETE.

### D3. Retrospective questionnaire

Fill trong vòng 24h:

| Metric | Value |
|--------|-------|
| Total alerts triggered | |
| Breakdown CRITICAL/HIGH/WARNING/INFO | |
| Auto-resolved % | |
| Manual RESOLVE % | |
| FALSE_ALARM % | |
| Average detect→resolve time | |
| Pain points race day | |
| Phase 2 priorities | |

---

## E. Emergency rollback

### E1. Disable feature flag

```bash
ssh 5solution-vps "
  sed -i 's|TIMING_ALERT_ENCRYPTION_KEY=.*|TIMING_ALERT_ENCRYPTION_KEY=|' /opt/5bib-result/backend.env
  cd /opt/5bib-result && docker compose restart 5bib-result-backend
"
```

→ Module conditional skip → endpoint 404 → KHÔNG poll RR API → KHÔNG ảnh hưởng RaceSyncCron normal sync.

### E2. Revert deploy

```bash
ssh 5solution-vps "cd /opt/5bib-result && \
  sed -i 's|backend:[a-f0-9]*|backend:<previous-sha>|' docker-compose.yml && \
  docker compose pull 5bib-result-backend && \
  docker compose up -d --force-recreate 5bib-result-backend"
```

### E3. Mongo collection cleanup (chỉ nếu cần)

```bash
# CẨN THẬN — drop config + alerts collection
ssh 5solution-vps "docker exec 5bib-result-backend node -e \"
  require('mongoose').connect(process.env.MONGODB_URL).then(async () => {
    await require('mongoose').connection.db.dropCollection('timing_alert_configs').catch(()=>{});
    await require('mongoose').connection.db.dropCollection('timing_alerts').catch(()=>{});
    await require('mongoose').connection.db.dropCollection('timing_alert_polls').catch(()=>{});
    process.exit(0);
  });
\""
```

→ Sau khi re-enable, full sync sẽ rebuild collections.
