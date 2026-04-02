# Progress Report — 2026-04-02

## Completed Tasks (4/4)

### 1. [HIGH] Claim / Appeal Feature
- **Backend**: Added `phone` (required) and `attachments` (S3 URLs) to `ResultClaim` schema
- **Backend**: New public endpoint `POST /race-results/claims/upload` for tracklog files (GPX, KML, FIT, images, up to 20MB)
- **Frontend**: Claim form on athlete detail page with name, phone, email, description, and file upload
- **Admin**: Claims page shows phone number and attachment links in resolve dialog
- **Files changed**: 8 files across backend/frontend/admin

### 2. [HIGH] Per-Race Sponsor Management
- **Backend**: Added optional `raceId` field to Sponsor schema; `GET /sponsors/race/:raceId` endpoint
- **Backend**: Global sponsors (`GET /sponsors`) now exclude race-specific ones
- **Admin**: New "Nha tai tro" tab on race detail page with full CRUD (add/edit/delete sponsors per race)
- **Frontend**: Ranking page fetches race-specific sponsors, displays by tier (diamond=h-28, gold=h-20, silver=h-14)
- **Files changed**: 7 files

### 3. [NORMAL] Pre-Race Event Page
- **Frontend**: Upcoming races show course details (start time, COT, elevation, start location) instead of results table
- **Frontend**: Organizer + description info block when available
- **Frontend**: CTA changes to "Xem chi tiet" for upcoming races; "Sap dien ra" badge in hero
- **Files changed**: 2 files

### 4. [NORMAL] Live Race Timer
- **Frontend**: New reusable `LiveTimer` component with badge and hero variants
- **Frontend**: Shows elapsed time since race start, updates every second
- **Frontend**: Displayed on race detail hero section and ranking page status bar
- **Files changed**: 4 files

## Build Status
- Backend: PASS
- Frontend: PASS
- Admin: PASS

## Commits
1. `feat: add claim form with phone + tracklog upload on athlete detail page`
2. `feat: add per-race sponsor management with tiered display on ranking page`
3. `feat: show course info instead of results for upcoming races`
4. `feat: add live elapsed timer for ongoing races`

---

## Suggested Improvements for Next Sprint

### HIGH Priority
- [ ] [HIGH] Email notifications when claim status changes (notify user via email/SMS when admin resolves/rejects their claim)
- [ ] [HIGH] Search functionality on homepage — search by BIB or name across all races
- [ ] [HIGH] Race comparison — let users compare 2+ athletes side by side on same course

### NORMAL Priority
- [ ] [NORMAL] Admin claim detail page — expandable row or separate page for full claim review with tracklog preview
- [ ] [NORMAL] Sponsor analytics — track impressions/clicks on sponsor logos
- [ ] [NORMAL] Course map display — render GPX track on map (Mapbox/Leaflet) on course detail
- [ ] [NORMAL] Auto-refresh ranking page when race is live (poll every 30s)
- [ ] [NORMAL] Share result as image — generate OG image card for social media sharing
- [ ] [NORMAL] Mobile app deep links — support opening specific athlete pages from mobile apps
- [ ] [NORMAL] PWA support — offline viewing of previously loaded results

### LOW Priority
- [ ] [LOW] Dark mode toggle for frontend
- [ ] [LOW] Multi-language support (Vietnamese/English) — i18n infrastructure exists but not fully used
- [ ] [LOW] Export race results to CSV/Excel from admin
- [ ] [LOW] Bulk sponsor import from CSV
- [ ] [LOW] Race photo gallery integration (link with 5Pix)
