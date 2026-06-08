# FEATURE-074: PRD — 🔵 READY
**BR-74-01** comparable = cùng tenant, event_start_date < hiện tại, user có quyền (IDOR), non-draft/deleted. **BR-74-02** curve = lũy kế paid theo daysBefore (0=ngày đua, lớn=sớm), clamp [0,180]. **BR-74-03** overlay current vs compare cùng trục daysBefore. **BR-74-04** IDOR assertRaceForUser CẢ raceId + compareRaceId. **BR-74-05** no-PII (chỉ lũy kế). cache 300s.
Endpoints: GET yoy/comparable?raceId (dropdown), GET yoy/curve?raceId&compareRaceId. Ticket-scope.
UI: Card "So với mùa trước" trong MKT section tab Vé — dropdown chọn giải + MultiLineChart 2 series. i18n 5 key×5.
TC: daysBefore (compute/after-race→0/clamp/null), cumulative (increase/empty/clamp-negative).
