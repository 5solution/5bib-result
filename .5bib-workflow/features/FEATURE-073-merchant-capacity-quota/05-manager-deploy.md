# FEATURE-073: Deploy — ✅ DONE (DEV)
Manager review 4 hotspot CLEAN: capacity.util (clamp/unlimited), service getCapacity (IDOR+scope rc.race_id+deleted+cache300s), controller (ticket-scope guard+ApiResponse), FE CapacityCard (color thresholds, additive-error-tolerant in loadCore). 0 red flag, no-PII.
BE+FE gộp 1 commit/push (né concurrency-cancel — bài học F-072). 7 util+161 jest.
Memory: feature-log shipped+counter→074, change-history, known-issues (3 TD).
DEV smoke (Danny): tab Vé → "Sức chứa theo cự ly" bar/course; verify số khớp + sold ý nghĩa.
