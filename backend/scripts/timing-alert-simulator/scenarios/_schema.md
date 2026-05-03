# Simulator Scenario Schema

## JSON shape

```json
{
  "name": "Tên scenario hiển thị log",
  "description": "Mô tả ngắn",
  "raceStartIso": "2026-05-15T05:00:00+07:00",
  "raceDurationSeconds": 21600,
  "courses": {
    "42KM": ["Start", "TM1", "TM2", "TM3", "Finish"],
    "21KM": ["Start", "TM1", "Finish"]
  },
  "athletes": [
    {
      "bib": "1001",
      "firstname": "Đặng",
      "lastname": "Đức",
      "contest": "42KM",
      "category": "Nam 40-49",
      "gender": "Male",
      "plannedElapsed": {
        "Start": 0,
        "TM1": 3600,
        "TM2": 7800,
        "TM3": 12000,
        "Finish": 16200
      }
    },
    {
      "bib": "98898",
      "firstname": "BIB 98898",
      "lastname": "Synthetic Miss",
      "contest": "42KM",
      "category": "Nam 40-49",
      "gender": "Male",
      "plannedElapsed": {
        "Start": 0,
        "TM1": 3000,
        "TM2": 6900,
        "TM3": 12600,
        "Finish": null
      }
    }
  ]
}
```

## Field semantics

| Field | Meaning |
|-------|---------|
| `raceDurationSeconds` | Sim clock tự stop khi vượt qua. VD 21600s = 6 giờ |
| `courses[name]` | Ordered checkpoint keys — match Timing Alert config `course_checkpoints` |
| `plannedElapsed[cpKey]` | Seconds elapsed from race start tới khi athlete pass checkpoint đó |
| `plannedElapsed[cpKey] = null` | Athlete **MISS** point đó (DNF / mat failure) — Chiptimes JSON sẽ trả `""` empty cho point này |

## Sim behavior

- Sim clock tăng theo wall-clock × speed factor
- Khi sim seconds ≥ planned[cpKey] → checkpoint xuất hiện trong RR API response
- Athlete với `plannedElapsed[X] = null` → **never** xuất hiện time tại X → BE timing-alert flag phantom/missing finish

## Speed factor cheat sheet

| Speed | 6h race → wall-clock | Use case |
|-------|----------------------|----------|
| 1 | 6 giờ | Real-time test (long) |
| 60 | 6 phút | Smoke test alert flow |
| 600 | 36 giây | Stress test (CRITICAL escalation phải trigger) |
| 3600 | 6 giây | Sanity check sim+ poll cycle |
