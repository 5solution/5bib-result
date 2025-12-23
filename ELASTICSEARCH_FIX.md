# Elasticsearch Rank Field Fix

## Problem
The bulk insert was failing with error:
```
failed to parse field [OverallRank] of type [long] in document with id '373872-10km-1181'.
Preview of field's value: 'DSQ'
```

**Root Cause:** Some athletes are disqualified (DSQ) or have non-numeric rank values, but we were trying to store them as integers.

## Solution

### 1. Dual Field Mapping
Created two fields for each rank value:
- **Original field** (keyword): Stores the raw value including "DSQ", "DNF", etc.
- **Numeric field** (integer): Stores only numeric values for sorting

**Example:**
```javascript
OverallRank: { type: 'keyword' }        // "1", "2", "DSQ", etc.
OverallRankNumeric: { type: 'integer' }  // 1, 2, null
```

### 2. Data Normalization
Added `normalizeRankValue()` function to process rank fields:

```typescript
private normalizeRankValue(value: any): {
  original: string;
  numeric: number | null;
} {
  const strValue = String(value);
  const numValue = parseInt(strValue, 10);
  return {
    original: strValue,
    numeric: isNaN(numValue) ? null : numValue,
  };
}
```

### 3. Smart Sorting
When sorting by rank fields, the API automatically uses the numeric version:

```typescript
const sortFieldMap: Record<string, string> = {
  OverallRank: 'OverallRankNumeric',
  GenderRank: 'GenderRankNumeric',
  CatRank: 'CatRankNumeric',
  OverrankLive: 'OverrankLiveNumeric',
};
```

## Updated Field Mappings

| Original Field | Type    | Numeric Field         | Type    | Notes                        |
|----------------|---------|----------------------|---------|------------------------------|
| OverallRank    | keyword | OverallRankNumeric   | integer | Can be "DSQ", "DNF", etc.   |
| GenderRank     | keyword | GenderRankNumeric    | integer | Can be "DSQ", "DNF", etc.   |
| CatRank        | keyword | CatRankNumeric       | integer | Can be "DSQ", "DNF", etc.   |
| OverrankLive   | keyword | OverrankLiveNumeric  | integer | Can be "DSQ", "DNF", etc.   |

## Index Recreation

The index is automatically deleted and recreated on application startup (for development) to ensure the correct mappings are applied.

**Production Note:** In production, you should:
1. Remove the auto-delete logic in `createIndexIfNotExists()`
2. Use index versioning (e.g., `race-results-v2`)
3. Perform zero-downtime reindexing

## API Behavior

### Data Storage
```json
{
  "Bib": 1181,
  "Name": "John Doe",
  "OverallRank": "DSQ",
  "OverallRankNumeric": null,
  "GenderRank": "1",
  "GenderRankNumeric": 1
}
```

### Sorting
```bash
# Sort by overall rank (automatically uses OverallRankNumeric)
GET /api/race-results?sortField=OverallRank&sortDirection=ASC

# DSQ/DNF athletes will appear at the end (null values sorted last)
```

### Display
- Frontend should display the **original field** (OverallRank) to show "DSQ"
- Sorting uses the **numeric field** for correct ordering
- Disqualified athletes (rank = null) appear at the end of sorted results

## Testing

1. **Restart the application** to recreate the index with new mappings
2. **Run manual sync** to populate data with normalized values:
   ```bash
   curl -X POST http://localhost:3000/api/race-results/sync
   ```
3. **Query the results** to verify:
   ```bash
   curl "http://localhost:3000/api/race-results?course_id=10km&pageSize=20"
   ```

## Files Modified

1. [src/modules/race-result/services/elasticsearch.service.ts](src/modules/race-result/services/elasticsearch.service.ts)
   - Updated field mappings to use keyword + integer pairs
   - Added auto-delete and recreate for development
   - Added smart sorting with field mapping

2. [src/modules/race-result/services/race-result.service.ts](src/modules/race-result/services/race-result.service.ts)
   - Added `normalizeRankValue()` helper function
   - Updated sync logic to create both original and numeric fields

## Benefits

✅ **Handles all edge cases:** DSQ, DNF, DNS, and any text values
✅ **Proper sorting:** Numeric sorting works correctly
✅ **No data loss:** Original values preserved for display
✅ **Future-proof:** Can handle any rank format the API returns
✅ **Clean queries:** Frontend doesn't need to handle special cases
