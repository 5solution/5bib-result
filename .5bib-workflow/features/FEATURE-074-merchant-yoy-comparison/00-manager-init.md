# FEATURE-074: YoY (So với mùa trước) — 🟡→✅
Why: BTC biết bán nhanh/chậm hơn mùa trước. Danny chốt: **BTC tự chọn giải so sánh (dropdown)**.
Data: races(tenant_id,event_start_date,title) + order_metadata.payment_on. Align theo days-before-race. Schema verified.
Risk: title lộn xộn → BTC tự chọn đúng. IDOR cả 2 giải. payment_on VN-local (diff cancel tz).
