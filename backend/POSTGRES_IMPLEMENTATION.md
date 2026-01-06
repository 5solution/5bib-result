# Race Result API - PostgreSQL Implementation

## Overview

Refactored the Race Result system to use **PostgreSQL** instead of Elasticsearch. This provides a simpler, more maintainable solution using the existing database infrastructure.

## Architecture

```
┌─────────────────────┐
│   NestJS App        │
│                     │
│  ┌──────────────┐   │
│  │  Cron Job    │───┼─── Runs every 1 minute
│  │  (Every 1m)  │   │
│  └──────────────┘   │
│                     │
│  ┌──────────────┐   │
│  │  POST /sync  │───┼─── Manual sync endpoint
│  └──────────────┘   │
│                     │
│  ┌──────────────┐   │
│  │ GET /results │───┼─── Query with filters
│  └──────────────┘   │
│                     │
└──────────┬──────────┘
           │
           ▼
┌─────────────────────┐
│   PostgreSQL DB     │
│                     │
│  Table:             │
│  race_results       │
│                     │
│  Indexes:           │
│  - course_id        │
│  - gender           │
│  - category         │
│  - overall_rank     │
│  - unique(race_id,  │
│    course_id, bib)  │
└─────────────────────┘
```

## What Was Changed

### Removed
- ❌ Elasticsearch dependencies (`@elastic/elasticsearch`, `@nestjs/elasticsearch`)
- ❌ Elasticsearch service (`elasticsearch.service.ts`)
- ❌ Elasticsearch configuration in `.env` and `config/index.ts`
- ❌ Docker Compose Elasticsearch setup

### Added
- ✅ PostgreSQL entity (`race-result.entity.ts`)
- ✅ TypeORM repository integration
- ✅ Database indexes for performance
- ✅ PostgreSQL UPSERT logic

## Database Schema

### Table: `race_results`

```sql
CREATE TABLE race_results (
  -- Primary key
  id SERIAL PRIMARY KEY,

  -- Race data
  bib INTEGER NOT NULL,
  name VARCHAR(255) NOT NULL,

  -- Rank fields (support both DSQ/DNF and numeric values)
  overall_rank VARCHAR(50),
  overall_rank_numeric INTEGER,
  gender_rank VARCHAR(50),
  gender_rank_numeric INTEGER,
  cat_rank VARCHAR(50),
  cat_rank_numeric INTEGER,

  -- Categories
  gender VARCHAR(50),
  category VARCHAR(100),

  -- Timing
  chip_time VARCHAR(50),
  gun_time VARCHAR(50),
  timing_point VARCHAR(255),
  pace VARCHAR(50),

  -- Certificate
  certi VARCHAR(255),
  certificate VARCHAR(255),

  -- Detailed data (JSON-like text)
  overall_ranks TEXT,
  gender_ranks TEXT,
  chiptimes TEXT,
  guntimes TEXT,
  paces TEXT,
  tods TEXT,
  sectors TEXT,

  -- Live rank
  overrank_live VARCHAR(50),
  overrank_live_numeric INTEGER,

  -- Other
  gap VARCHAR(50),
  nationality VARCHAR(100),
  nation VARCHAR(100),

  -- Race info
  race_id INTEGER NOT NULL,
  course_id VARCHAR(50) NOT NULL,
  distance VARCHAR(50) NOT NULL,

  -- Timestamps
  synced_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
  updated_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,

  -- Unique constraint
  UNIQUE(race_id, course_id, bib)
);

-- Indexes for performance
CREATE INDEX idx_race_results_course_id ON race_results(course_id);
CREATE INDEX idx_race_results_gender ON race_results(gender);
CREATE INDEX idx_race_results_category ON race_results(category);
CREATE INDEX idx_race_results_overall_rank ON race_results(overall_rank_numeric);
```

## Features

### 1. Automatic Sync (Cron Job)
- Runs every 1 minute
- Fetches data from 5 race APIs
- Upserts into PostgreSQL (no duplicates)
- Handles "DSQ", "DNF" values gracefully

### 2. Manual Sync API
```bash
POST /api/race-results/sync
```

**Response:**
```json
{
  "message": "Sync completed successfully",
  "timestamp": "2025-12-23T17:00:00.000Z"
}
```

### 3. Query API with Filters
```bash
GET /api/race-results?course_id=100km&gender=Female&pageSize=20
```

**Supported Filters:**
- `course_id` - Filter by distance (100km, 70km, 42km, 25km, 10km)
- `name` - Search by name (case-insensitive, partial match)
- `gender` - Filter by gender (Male, Female)
- `category` - Filter by category (e.g., "Female 30-39")
- `pageNo` - Page number (default: 1)
- `pageSize` - Items per page (default: 10)
- `sortField` - Sort by field (default: OverallRank)
- `sortDirection` - ASC or DESC (default: ASC)

**Response:**
```json
{
  "data": [
    {
      "Bib": 8065,
      "Name": "DƯƠNG THỊ HOA",
      "OverallRank": "6",
      "GenderRank": "1",
      "CatRank": "1",
      "Gender": "Female",
      "Category": "Female 30-39",
      "ChipTime": "18:41:32",
      "race_id": 373872,
      "course_id": "100km",
      "distance": "100km",
      "synced_at": "2025-12-23T17:00:00.000Z"
    }
  ],
  "pagination": {
    "pageNo": 1,
    "pageSize": 10,
    "total": 150,
    "totalPages": 15
  }
}
```

## How It Works

### Data Flow

1. **Cron Job Triggers** (every 1 minute)
   - Fetches data from each race API
   - Normalizes rank values (converts "DSQ" → null for numeric field)
   - Maps API response to entity objects

2. **PostgreSQL Upsert**
   - Uses `UPSERT` with conflict resolution on `(race_id, course_id, bib)`
   - Updates existing records or inserts new ones
   - No duplicate records

3. **Query Execution**
   - Filters applied via TypeORM `WHERE` clause
   - Name search uses `ILIKE` (case-insensitive pattern matching)
   - Sorting uses numeric rank fields for proper ordering
   - Pagination with `LIMIT` and `OFFSET`

### Handling Special Rank Values

Some athletes have non-numeric ranks like "DSQ" (disqualified) or "DNF" (did not finish).

**Solution:**
- Store original value in `overall_rank` (VARCHAR)
- Store parsed numeric in `overall_rank_numeric` (INTEGER, NULL for DSQ/DNF)
- Sort by numeric field (DSQ/DNF appear at end due to NULL)

## Files Structure

```
src/modules/race-result/
├── dto/
│   └── get-race-results.dto.ts       # Query parameters validation
├── entities/
│   └── race-result.entity.ts         # TypeORM entity (NEW)
├── interfaces/
│   └── race-result.interface.ts      # TypeScript interfaces
├── services/
│   ├── race-result.service.ts        # Main service (UPDATED)
│   └── race-sync.cron.ts             # Cron job scheduler
├── race-result.controller.ts         # REST API endpoints
└── race-result.module.ts             # Module definition (UPDATED)
```

## Setup & Usage

### 1. Run Migrations (if needed)

If using migrations:
```bash
npm run migration:generate
npm run migration:up
```

Or let TypeORM auto-create the table (synchronize: true in development).

### 2. Start the Application

```bash
npm run start:dev
```

The cron job will start automatically and sync data every minute.

### 3. Manual Sync (Optional)

Trigger immediate sync:
```bash
curl -X POST http://localhost:3000/api/race-results/sync
```

### 4. Query Results

```bash
# Get all 100km results
curl "http://localhost:3000/api/race-results?course_id=100km&pageSize=20"

# Search by name
curl "http://localhost:3000/api/race-results?name=DƯƠNG"

# Filter by gender and category
curl "http://localhost:3000/api/race-results?gender=Female&category=Female+30-39"
```

## Performance Optimizations

### 1. Database Indexes
```sql
-- Speeds up filtering
CREATE INDEX idx_race_results_course_id ON race_results(course_id);
CREATE INDEX idx_race_results_gender ON race_results(gender);
CREATE INDEX idx_race_results_category ON race_results(category);

-- Speeds up sorting
CREATE INDEX idx_race_results_overall_rank ON race_results(overall_rank_numeric);
```

### 2. UPSERT Instead of Delete+Insert
```typescript
await this.raceResultRepo.upsert(entities, {
  conflictPaths: ['race_id', 'course_id', 'bib'],
  skipUpdateIfNoValuesChanged: true,
});
```

Benefits:
- ✅ No duplicate records
- ✅ Preserves `created_at` timestamp
- ✅ Faster than delete + insert
- ✅ Avoids race conditions

### 3. Pagination
- Prevents loading large datasets into memory
- Uses efficient `LIMIT` and `OFFSET`

### 4. Partial Indexes (Optional)
For production, consider:
```sql
-- Index only active races
CREATE INDEX idx_active_races ON race_results(course_id)
WHERE synced_at > NOW() - INTERVAL '1 day';
```

## API Examples

### Search by Name (Case-Insensitive)
```bash
curl "http://localhost:3000/api/race-results?name=duong&pageSize=10"
```

### Filter by Multiple Criteria
```bash
curl "http://localhost:3000/api/race-results?course_id=42km&gender=Male&category=Male+40-49&sortField=OverallRank&sortDirection=ASC&pageSize=50"
```

### Get All Results for a Race
```bash
curl "http://localhost:3000/api/race-results?course_id=70km&pageSize=1000"
```

## Monitoring

### Check Sync Status
Look for these logs:
```
[RaceResultService] Syncing 100km race results...
[RaceResultService] Successfully synced 234 results for 100km
[RaceResultService] Race results sync completed
```

### Check Database
```sql
-- Count total records
SELECT COUNT(*) FROM race_results;

-- Check recent syncs
SELECT course_id, COUNT(*), MAX(synced_at)
FROM race_results
GROUP BY course_id;

-- Check for DSQ athletes
SELECT course_id, COUNT(*)
FROM race_results
WHERE overall_rank_numeric IS NULL
GROUP BY course_id;
```

## Benefits Over Elasticsearch

✅ **Simpler** - No extra infrastructure to maintain
✅ **Cheaper** - Uses existing PostgreSQL database
✅ **Reliable** - ACID transactions, data consistency
✅ **Familiar** - SQL queries, standard tooling
✅ **Integrated** - Same database as rest of app
✅ **Performant** - Indexes provide fast queries
✅ **Easier Deployment** - One less service to deploy

## Production Checklist

- [ ] Enable database indexes in production
- [ ] Set up database backups
- [ ] Monitor sync job logs
- [ ] Set up alerting for sync failures
- [ ] Consider read replicas for heavy query load
- [ ] Add database connection pooling
- [ ] Enable query logging for slow queries
- [ ] Consider partitioning table by race_id for very large datasets

## Troubleshooting

### Sync Not Working
```bash
# Check logs
railway logs

# Manually trigger sync
curl -X POST http://localhost:3000/api/race-results/sync

# Check database
SELECT * FROM race_results LIMIT 10;
```

### Slow Queries
```sql
-- Check if indexes exist
SELECT * FROM pg_indexes WHERE tablename = 'race_results';

-- Analyze query performance
EXPLAIN ANALYZE
SELECT * FROM race_results
WHERE course_id = '100km'
ORDER BY overall_rank_numeric ASC
LIMIT 20;
```

### Duplicate Records
Should not happen due to unique constraint, but if it does:
```sql
-- Find duplicates
SELECT race_id, course_id, bib, COUNT(*)
FROM race_results
GROUP BY race_id, course_id, bib
HAVING COUNT(*) > 1;
```

## Next Steps

1. ✅ PostgreSQL implementation complete
2. ⏭️ Deploy and test in production
3. ⏭️ Monitor performance and optimize indexes
4. ⏭️ Add more filters if needed (by nationality, pace, etc.)
5. ⏭️ Consider caching frequently accessed queries
