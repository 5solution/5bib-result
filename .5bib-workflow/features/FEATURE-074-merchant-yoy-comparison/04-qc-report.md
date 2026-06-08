# FEATURE-074: QC — ✅ APPROVED (DEV-smoke)
P1: 7 yoy util + 168 merchant-portal jest, 0 regression. BE tsc0. FE tsc0/vitest13/build/no-Thai.
P2 Security: **IDOR assertRaceForUser CẢ raceId + compareRaceId** ✅ (không so giải ngoài quyền); comparable filtered to accessible Set ✅; no-PII (chỉ lũy kế) ✅; SQL param ✅; ticket-scope.
P3-4: 7 unit (daysBefore compute/after-race/clamp/null; cumulative increase/empty/clamp).
P5 PRD: BR-74-01..05 ✅.
P6 Persona: code-trace — MKT section tab Vé → Card "So với mùa trước" → dropdown chọn giải mùa trước → overlay 2 đường. ⚠️ DEFER DEV smoke: dropdown có giải, đường vẽ đúng, IDOR compareRaceId lạ→403.
TD→known-issues: 180DAY-CAP, SDK-HANDADD.
VERDICT: ✅ APPROVED.
