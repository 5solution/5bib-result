# FEATURE-074: Coder — 🟠 READY_FOR_QC
Files: BE ➕yoy.util.ts(+spec 7) +dto/yoy.dto.ts; ✏️service(getRaceMeta+getYoyComparable+buildYoySeries+getYoyCurve) +controller(GET yoy/comparable + yoy/curve +YoyCurveQueryDto). FE ✏️page.tsx(YoYCard dropdown+MultiLineChart overlay, loadYoyCandidates+loadYoyCurve) +i18n(5 key×5) +SDK hand-add.
Logic: daysBefore align + cumulativeCurve (Node, testable). IDOR cả 2 race. comparable filtered to accessible set. cache 300s.
Tests: 7 util + 168 merchant-portal jest · BE tsc0 · FE tsc0/vitest13/build/no-Thai.
Self-review: ✅ IDOR both, no-PII, SQL param, scope-lock. SDK hand-add (reconcile).
