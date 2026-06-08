# F-074 Implementation Notes
## Deviations: YoY = Card trong MKT section tab Vé (không tab riêng) — là MKT analytic. Trục x = daysBefore (0=ngày đua bên phải, sớm bên trái), trim leading-zero stretch để chart gọn.
## Forced: title races lộn xộn ("Test"/"demo") → Danny chốt BTC tự chọn dropdown (không auto). payment_on VN-local nhưng daysBefore=diff nên tz cancel.
## Tradeoffs: align days-before (so 2 giải khác ngày) vs calendar; aggregate Node; cache by (raceId,compareRaceId).
## Reviewer: yoy.util (daysBefore clamp/after-race→0; cumulative maxDays..0); service IDOR assertRaceForUser CẢ 2 race + comparable filtered accessible (no cross-tenant leak); buildYoySeries paid-only. no-PII.
## TD: TD-F074-180DAY-CAP (orders >180 ngày trước gộp tại 180); TD-F074-SDK-HANDADD.
