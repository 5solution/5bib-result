# FEATURE-073: Capacity/Quota (Sức chứa từng cự ly) — 🟡 INITIATED → ✅ DONE
**Type:** EXTEND_EXISTING (merchant-portal BE + merchant FE). Why: BTC biết cự ly nào sắp full / ế → đóng sớm / cứu marketing.
**Schema verified:** quota THẬT ở `ticket_type.max_participate` + `remained_ticket`; `race_course.max_participate` = placeholder(1) → BỎ. Scope `rc.race_id` + `deleted=0`.
**Risk:** nhiều tt max=1000 default (pctFilled thấp — chấp nhận, data thật). No-PII, ticket-scope.
