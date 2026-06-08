# FEATURE-073: Coder — 🟠 READY_FOR_QC
Files: BE ➕capacity.util.ts(+spec 7) +dto/capacity.dto.ts; ✏️service (getCapacity) +controller (GET capacity). FE ✏️page.tsx (CapacityCard + loadCore +capacity fetch, additive-error-tolerant) +i18n (6 key×5) +SDK hand-add.
Logic: pull ticket_type×race_course (rc.race_id, deleted=0) → aggregateCapacity in Node (sold=quota-remaining, per-course Σ, sort %desc). cache 300s.
Tests: 7 util + 161 merchant-portal jest PASS · backend tsc 0 · FE tsc 0 + vitest 13 + build OK + no-Thai.
Self-review: ✅ tsc/lint, anti-pattern clean, IDOR assertRaceForUser, no-PII, scope-lock match. SDK hand-add (reconcile generate:api).
