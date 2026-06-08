# FEATURE-073: QC — ✅ APPROVED (DEV-smoke conditions)
P1 Regression: 7 capacity util + 161 merchant-portal jest PASS, 0 regression. BE tsc 0. FE tsc 0+vitest 13+build OK+no-Thai.
P2 Security: IDOR assertRaceForUser ✅; no-PII (chỉ quota/sold/count) ✅; SQL param `?` ✅; ticket-scope guard ✅.
P3-4: 7 unit TC (sold/aggregate/unlimited/clamp/sort/empty). 
P5 PRD: BR-73-01..06 ✅ (quota model, unlimited, per-course, sort, scope, IDOR, cache).
P6 Persona: code-trace — tab Vé → section "Sức chứa" progress bar/course màu theo %. ⚠️ DEFER DEV smoke: render thật + số khớp + sold-semantics (remained vs paid) verify.
TD→known-issues: SOLD-SEMANTICS, DEFAULT-1000, SDK-HANDADD.
VERDICT: ✅ APPROVED.
