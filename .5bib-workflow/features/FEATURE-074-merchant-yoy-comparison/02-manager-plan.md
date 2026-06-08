# FEATURE-074: Plan — ✅ APPROVED
Spot-check: races.tenant_id/event_start_date/title + order_metadata.payment_on verified. resolveAccessibleRaces→Set<number> for IDOR-safe candidates.
Scope Lock: BE utils/yoy.util.ts(+spec) +dto/yoy.dto.ts +service(getRaceMeta/getYoyComparable/buildYoySeries/getYoyCurve) +controller(2 GET). FE page.tsx(YoYCard+load) +i18n(5 key) +SDK hand-add.
Unit: 7 yoy.util TC. IDOR both races. cache 300s curve.
