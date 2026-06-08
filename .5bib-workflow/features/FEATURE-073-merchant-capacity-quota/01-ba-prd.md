# FEATURE-073: PRD — 🔵 READY
**Goal:** Sức chứa/quota từng cự ly (sold/quota/remaining/%filled), ticket-scope, no-PII.
**BR-73-01** quota=ticket_type.max_participate, remaining=remained_ticket, sold=quota-remaining (clamp≥0). **BR-73-02** quota 0/null → "Không giới hạn" (no bar). **BR-73-03** aggregate per course = Σ ticket_type. **BR-73-04** sort %filled DESC. **BR-73-05** scope rc.race_id + rc.deleted=0 + tt.deleted=0. **BR-73-06** assertRaceForUser (IDOR). cache 300s.
**Endpoint:** GET /api/merchant-portal/capacity?raceId → RaceCapacityDto. Guard LogtoMerchantGuard (ticket-scope).
**UI:** Section "Sức chứa theo cự ly" trong tab Vé (progress bar/course, màu: <70 xanh, 70-90 cam, ≥90 đỏ). i18n 6 key×5.
**TC:** sold=quota-remaining, aggregate, unlimited, course-unlimited-if-all, clamp, sort, empty.
