# Race Result API Implementation

## Overview

This implementation provides a complete Race Result API + Cron Job system with Elasticsearch integration for efficient searching and filtering of race results.

## Features Implemented

### 1. Elasticsearch Configuration
- Added Elasticsearch configuration in [src/config/index.ts](src/config/index.ts:14-16)
- Configured environment variables for Elasticsearch node URL and optional authentication
- Auto-creates index with proper mappings on application startup

### 2. API Endpoint: GET /api/race-results

**Features:**
- Search by `course_id` (e.g., "100km", "70km", "42km", "25km", "10km")
- Search by `name` (with fuzzy matching for better search results)
- Filter by `gender` ("Male" or "Female")
- Filter by `category` (e.g., "Female 30-39")
- Pagination support with `pageNo` and `pageSize`
- Sorting with `sortField` and `sortDirection` (ASC/DESC)

**Example Request:**
```
GET /api/race-results?course_id=100km&pageSize=10&pageNo=1&sortField=OverallRank&sortDirection=ASC&gender=Female&category=Female+30-39
```

**Example Response:**
```json
{
  "data": [
    {
      "Bib": 8065,
      "Name": "DƯƠNG THỊ HOA",
      "OverallRank": 6,
      "GenderRank": 1,
      "CatRank": 1,
      "Gender": "Female",
      "Category": "Female 30-39",
      "ChipTime": "18:41:32",
      "GunTime": "18:41:36",
      "race_id": 373872,
      "course_id": "100km",
      "distance": "100km",
      "synced_at": "2025-12-23T16:30:00.000Z"
    }
  ],
  "pagination": {
    "pageNo": 1,
    "pageSize": 10,
    "total": 100,
    "totalPages": 10
  }
}
```

### 3. Cron Job: Automatic Data Sync

**Features:**
- Runs **every 1 minute** automatically
- Fetches data from all race distance APIs:
  - 100km: `https://api.raceresult.com/373872/DRUJ4JZIAZVR9HL3Z95VMT3N1EOUYRX6`
  - 70km: `https://api.raceresult.com/373872/L4OGZSDRG90JJB34CWIAM6I5BBQS744E`
  - 42km: `https://api.raceresult.com/373872/XNMXT8815X4PMOH8PIQJU9BMOILKSR7Q`
  - 25km: `https://api.raceresult.com/373872/OBZ7O5A02PGVHAOTJ2F7Y9QGE6VXDIZK`
  - 10km: `https://api.raceresult.com/373872/WKI4EML9T6R7Z582HRKDXOF2188697KX`
- Uses **bulk upsert** operations to prevent duplicates
- **Zero-downtime updates** - uses Elasticsearch alias for seamless data updates
- Prevents concurrent syncs with lock mechanism
- Comprehensive error handling and logging

### 4. Data Storage

**Elasticsearch Index:**
- Index: `race-results`
- Alias: `race-results-alias` (for zero-downtime updates)
- Document ID: `{race_id}-{course_id}-{bib}` (ensures uniqueness)

**Field Mappings:**
- Integer fields: `Bib`, `OverallRank`, `GenderRank`, `CatRank`, `OverrankLive`, `race_id`
- Keyword fields: `Gender`, `Category`, `course_id`, `distance`, time fields
- Text fields with keyword subfields: `Name` (enables both fuzzy search and exact matching)
- Date field: `synced_at`

## File Structure

```
src/modules/race-result/
├── dto/
│   └── get-race-results.dto.ts       # Query parameters DTO
├── interfaces/
│   └── race-result.interface.ts      # TypeScript interfaces
├── services/
│   ├── elasticsearch.service.ts      # Elasticsearch wrapper service
│   ├── race-result.service.ts        # Main business logic
│   └── race-sync.cron.ts             # Cron job scheduler
├── race-result.controller.ts         # REST API controller
└── race-result.module.ts             # NestJS module definition
```

## Setup Instructions

### 1. Install Dependencies
Already installed:
- `@elastic/elasticsearch`
- `@nestjs/elasticsearch`

### 2. Configure Environment Variables

Add to your `.env` file:

```env
# Elasticsearch Configuration
ELASTICSEARCH_NODE=http://localhost:9200
ELASTICSEARCH_USERNAME=              # Optional
ELASTICSEARCH_PASSWORD=              # Optional
```

### 3. Start Elasticsearch

**Option A: Using Docker**
```bash
docker run -d \
  --name elasticsearch \
  -p 9200:9200 \
  -p 9300:9300 \
  -e "discovery.type=single-node" \
  -e "xpack.security.enabled=false" \
  docker.elastic.co/elasticsearch/elasticsearch:8.11.0
```

**Option B: Using Docker Compose**
```yaml
version: '3.8'
services:
  elasticsearch:
    image: docker.elastic.co/elasticsearch/elasticsearch:8.11.0
    environment:
      - discovery.type=single-node
      - xpack.security.enabled=false
    ports:
      - "9200:9200"
      - "9300:9300"
```

### 4. Run the Application

```bash
# Development mode
npm run start:dev

# Production mode
npm run build
npm run start:prod
```

## API Usage Examples

### 1. Get all results for 100km race
```bash
curl "http://localhost:3000/api/race-results?course_id=100km&pageSize=20&pageNo=1"
```

### 2. Search by name
```bash
curl "http://localhost:3000/api/race-results?name=DƯƠNG&pageSize=10"
```

### 3. Filter by gender
```bash
curl "http://localhost:3000/api/race-results?course_id=42km&gender=Female&pageSize=10"
```

### 4. Filter by category
```bash
curl "http://localhost:3000/api/race-results?course_id=100km&category=Female+30-39&pageSize=10"
```

### 5. Combined filters with sorting
```bash
curl "http://localhost:3000/api/race-results?course_id=70km&gender=Male&sortField=OverallRank&sortDirection=ASC&pageSize=50&pageNo=1"
```

## Key Implementation Details

### Duplicate Prevention
- Uses composite document ID: `{race_id}-{course_id}-{bib}`
- Bulk upsert operation ensures records are updated if they already exist
- No duplicate records even with multiple syncs

### Zero-Downtime Updates
- Uses Elasticsearch alias pattern
- Queries always use alias name
- Index can be swapped without downtime if needed

### Performance Optimizations
- Bulk operations instead of individual inserts
- Efficient Elasticsearch queries with proper field types
- Pagination to handle large result sets
- Fuzzy name matching for better user experience

### Error Handling
- Comprehensive try-catch blocks
- Detailed logging for debugging
- Cron lock to prevent concurrent executions
- Graceful handling of API failures

## Monitoring

The application logs include:
- Cron job execution status
- Number of documents synced per race
- Elasticsearch index creation/update status
- Any errors during sync or search operations

Check logs with:
```bash
# Development
npm run start:dev

# Production logs
pm2 logs
```

## Testing

You can test the API using:
- Swagger UI: `http://localhost:3000/swagger`
- cURL commands (examples above)
- Postman/Insomnia

To verify cron job is working:
- Check application logs every minute
- Query the API and verify `synced_at` timestamp is recent
- Monitor Elasticsearch: `curl http://localhost:9200/race-results/_count`

## Troubleshooting

### Elasticsearch connection issues
```bash
# Check if Elasticsearch is running
curl http://localhost:9200

# Check index exists
curl http://localhost:9200/race-results
```

### No data appearing
- Check cron job logs
- Verify external APIs are accessible
- Check ELASTICSEARCH_NODE URL in .env

### Search not returning results
- Verify data was synced (check logs)
- Try without filters first
- Check Elasticsearch index: `curl http://localhost:9200/race-results/_search`

## Architecture Benefits

1. **Scalability**: Elasticsearch handles millions of documents efficiently
2. **Performance**: Fast search with indexes and proper field types
3. **Reliability**: Automatic retries and error handling
4. **Maintainability**: Clean separation of concerns with NestJS modules
5. **Flexibility**: Easy to add new race sources or modify sync frequency
