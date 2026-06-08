# FEATURE-073: Plan — ✅ APPROVED
Spot-check: ticket_type.max_participate/remained_ticket verified DB; rc.race_id+deleted confirmed. race_course.max_participate=placeholder → ignore (đúng).
**Scope Lock:** BE utils/capacity.util.ts(+spec) + dto/capacity.dto.ts + service getCapacity + controller GET capacity. FE races/[raceId]/page.tsx (CapacityCard + loadCore fetch) + i18n.ts (6 key) + SDK hand-add.
Unit test bắt buộc: 7 TC capacity util. Cache 300s. Ticket-scope guard.
