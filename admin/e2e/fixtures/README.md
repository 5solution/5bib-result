# F-006 Course Map e2e fixtures

- `sample.gpx` — small valid GPX (10 waypoints, 12 trkpts).
- `sample.kml` — small valid KML with 3 waypoints + 1 LineString.
- `corrupted.gpx` — malformed XML (used to assert parse-error banner).
- `large-15mb.gpx` — generated on demand at >10MB to assert size guard.
  Generate locally with:
  ```bash
  node -e 'const fs=require("fs");let s=`<?xml version="1.0"?><gpx xmlns="http://www.topografix.com/GPX/1/1"><trk><trkseg>`;for(let i=0;i<300000;i++){s+=`<trkpt lat="${(11.9+i*1e-6).toFixed(6)}" lon="${(108.4+i*1e-6).toFixed(6)}"><ele>1500</ele></trkpt>`;}s+=`</trkseg></trk></gpx>`;fs.writeFileSync("admin/e2e/fixtures/large-15mb.gpx",s);'
  ```
