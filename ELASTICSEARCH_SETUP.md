# Elasticsearch v8 Setup Guide

## Version Compatibility

- **Elasticsearch Server**: v8.11.0
- **Elasticsearch Client**: v8.11.0
- **NestJS Elasticsearch**: v10.0.1

## Quick Start

### 1. Start Elasticsearch with Docker Compose

```bash
# Start Elasticsearch and Kibana
docker-compose up -d

# Check if Elasticsearch is running
curl http://localhost:9200

# Expected response:
# {
#   "name" : "...",
#   "cluster_name" : "docker-cluster",
#   "version" : {
#     "number" : "8.11.0",
#     ...
#   }
# }
```

### 2. Start the Application

```bash
# Development mode
npm run start:dev

# The application will automatically:
# - Create the Elasticsearch index with correct mappings
# - Start the cron job (runs every 1 minute)
```

### 3. Manual Data Sync

```bash
# Trigger manual sync
curl -X POST http://localhost:3000/api/race-results/sync

# Expected response:
# {
#   "message": "Sync completed successfully",
#   "timestamp": "2025-12-23T..."
# }
```

### 4. Query the API

```bash
# Get all results for 100km race
curl "http://localhost:3000/api/race-results?course_id=100km&pageSize=20"

# Search by name
curl "http://localhost:3000/api/race-results?name=DƯƠNG&pageSize=10"

# Filter by gender and category
curl "http://localhost:3000/api/race-results?course_id=42km&gender=Female&category=Female+30-39"
```

## Useful Commands

### Docker Management

```bash
# View logs
docker-compose logs -f elasticsearch

# Stop services
docker-compose down

# Remove volumes (clears all data)
docker-compose down -v

# Restart services
docker-compose restart
```

### Elasticsearch Direct Queries

```bash
# Check index exists
curl http://localhost:9200/race-results

# Count documents
curl http://localhost:9200/race-results/_count

# Get sample documents
curl "http://localhost:9200/race-results/_search?size=5&pretty"

# Check index mapping
curl "http://localhost:9200/race-results/_mapping?pretty"

# Delete index (will be recreated on app restart)
curl -X DELETE http://localhost:9200/race-results
```

### Kibana (Optional)

Kibana is available at: http://localhost:5601

Use it to:
- Visualize data
- Run complex queries
- Monitor Elasticsearch health
- Create dashboards

## Troubleshooting

### Connection Refused
```bash
# Check if Elasticsearch is running
docker ps | grep elasticsearch

# Check Elasticsearch logs
docker logs elasticsearch_8
```

### Port Already in Use
```bash
# Check what's using port 9200
lsof -i :9200

# Kill the process or change the port in docker-compose.yml
```

### Index Mapping Issues
```bash
# Delete and recreate index
curl -X DELETE http://localhost:9200/race-results

# Restart app to recreate with correct mappings
npm run start:dev
```

### Data Not Syncing
```bash
# Check application logs for errors
# Look for messages from RaceResultService and RaceElasticsearchService

# Manually trigger sync and check response
curl -X POST http://localhost:3000/api/race-results/sync -v
```

## Important Notes

⚠️ **Development Mode**: The application automatically deletes and recreates the index on startup. This is for development only.

For production:
1. Remove the auto-delete logic in `elasticsearch.service.ts`
2. Use index versioning (e.g., `race-results-v1`, `race-results-v2`)
3. Perform zero-downtime reindexing when changing mappings

## Architecture

```
┌─────────────────┐
│   NestJS App    │
│                 │
│  ┌──────────┐   │
│  │  Cron    │───┼─── Runs every 1 minute
│  │  Job     │   │
│  └──────────┘   │
│                 │
│  ┌──────────┐   │
│  │   API    │───┼─── Manual sync endpoint
│  │  /sync   │   │
│  └──────────┘   │
│                 │
│       │         │
└───────┼─────────┘
        │
        ▼
┌─────────────────┐
│  Elasticsearch  │
│     v8.11.0     │
│                 │
│  Index:         │
│  race-results   │
│                 │
│  Alias:         │
│  race-results-  │
│  alias          │
└─────────────────┘
```

## Data Flow

1. **Cron Job** (every 1 minute):
   - Fetches data from 5 race APIs
   - Normalizes rank values (handles "DSQ", "DNF", etc.)
   - Bulk upserts to Elasticsearch

2. **Manual Sync**:
   - POST /api/race-results/sync
   - Same logic as cron job
   - Returns immediately after completion

3. **Query API**:
   - GET /api/race-results
   - Supports filters, pagination, sorting
   - Returns paginated results

## Performance

- **Index size**: ~1-5 MB per 1000 documents
- **Sync time**: ~1-3 seconds for all 5 races
- **Query time**: <100ms for most queries
- **Bulk insert**: ~500-1000 docs/second
