# Troubleshooting Cheatsheet — Chip Verification

**Cho ai:** BTC + 5BIB on-call team ngày race
**In khổ A4 dán bàn BTC**

---

## 🔥 Top 10 Vấn Đề Thường Gặp

### 1. Kiosk URL trả 401 "Invalid or revoked token"

**Nguyên nhân:** Token đã bị ROTATE / DISABLE bởi BTC khác, hoặc URL gõ sai.
**Fix:**
1. BTC vào admin → section "Verify token & kiosk URL"
2. Nếu Disabled → click **GENERATE token** sinh URL mới
3. Nếu Enabled → click **ROTATE** để tạo token mới
4. Copy URL mới → share lại NV Bàn 2

---

### 2. Kiosk URL trả 429 "Too Many Requests"

**Nguyên nhân:** Throttle 60 req/phút/(token, IP). 1 station quẹt > 60 chip/phút.
**Fix tạm:** chờ 1 phút → throttle reset.
**Fix lâu dài:** dev tăng limit qua env (race day pilot có thể bump 60 → 300).
- Liên hệ: `dev1@5bib.com`

---

### 3. Kiosk hiện đầy chữ trắng / không load

**Nguyên nhân:**
- Frontend lỗi compile (rare ở prod)
- Cache browser stale
- Mạng đang chậm

**Fix:**
1. **Hard refresh:** `Cmd+Shift+R` (Mac) hoặc `Ctrl+F5` (Windows)
2. Clear cookies cho domain `result.5bib.com`
3. Thử browser khác (Chrome → Safari)
4. Check DevTools (F12) → Console → tìm error đỏ → screenshot gửi dev

---

### 4. CSV import báo "X dòng bị block"

**Nguyên nhân:** Rows lỗi format theo dạng đỏ (chip_id sai format, formula injection, duplicate trong file).

**Fix:**
1. Mở table errors trên admin → **đọc cột "Reason"** từng dòng
2. Excel sửa từng dòng theo hướng dẫn:
   | Reason | Action |
   |--------|--------|
   | `Invalid chip_id format` | Xóa khoảng trắng, dấu đặc biệt — chỉ giữ A-Z 0-9 - _ |
   | `Formula injection` | chip_id KHÔNG bắt đầu = + - @ ' tab |
   | `Duplicate chip_id` | Xóa dòng trùng |
   | `Duplicate bib_number` | 1 BIB = 1 chip, sửa lại |
3. Save CSV → upload lại

---

### 5. Athlete card hiện course_name = `—` (trống)

**Nguyên nhân:** Athlete trên MySQL chưa được gán race_course / ticket_type.
**Impact:** UI hiển thị "—" thay tên cự ly. KHÔNG ảnh hưởng giao racekit.
**Fix dev side:** kiểm tra MySQL `athlete_subinfo → order_line_item → ticket_type → race_course` chain có đầy đủ.
**Hành động ngày race:** kệ, tiếp tục giao racekit. BIB + tên hiển thị đủ là OK.

---

### 6. RFID reader quẹt nhưng kiosk không phản hồi

**Diagnosis:**
- ✅ Badge "🔊 Sẵn sàng" có hiển thị?
- ✅ Browser ở chế độ active tab (không bị Window khác cover)?
- ✅ Reader test với Notepad có xuất ra ký tự không?

**Fix:**
1. Click **"Bắt đầu"** lại để re-unlock audio
2. Click bất kỳ chỗ nào trên page → page có focus
3. Test reader trong Notepad — nếu Notepad cũng không nhận → reader hỏng vật lý
4. Backup: gõ tay chip ID vào ô input

---

### 7. Cron delta sync log 22+ giây (BE log)

**Nguyên nhân:** Query MySQL athletes với JOIN 4 cấp + over network/SSH tunnel.
**Impact:**
- Cron lock window 25s — gần overlap risk
- Không ảnh hưởng UI race day (lookup vẫn nhanh, cron chạy ngầm)

**Fix dev side (post-pilot):**
1. Cache `bibsWithChip` trong service Redis 60s TTL
2. Simplify TypeORM relations — JOIN 1 lần thay 4 cấp
3. MySQL index `(race_id, modified_on)` nếu chưa có

---

### 8. Race admin chưa thấy button "Chip Verify"

**Nguyên nhân:** Branch deploy chưa lên prod / cache CDN.
**Fix:**
1. Hard refresh `Cmd+Shift+R`
2. Check `https://result-admin.5bib.com` đã pull latest:
   ```bash
   ssh 5solution-vps "docker compose ls | grep admin"
   ```
3. Nếu admin chạy code cũ → manual deploy:
   ```bash
   ssh 5solution-vps "cd /opt/5bib-result && docker compose pull admin && docker compose up -d admin"
   ```

---

### 9. Race chưa link MySQL race_id

**Triệu chứng:** Trang chip-mappings chỉ hiện form "Link race admin sang MySQL platform"
**Fix:**
1. Lấy `mysql_race_id` từ team kỹ thuật / dev / 5bib platform admin
2. Nhập số → click **Link race**
3. Nếu báo "đã link tới race khác (mongo=...)" → có người đã link nhầm → liên hệ dev để clear

---

### 10. `is_first_verify=true` không match số athlete thực tế

**Nguyên nhân:** Một số athlete bị quẹt nhiều station khác nhau hoặc cron sync muộn.
**Diagnosis:**
```bash
# Đếm distinct first verify trong Mongo
ssh 5solution-vps "docker exec 5bib-result-backend mongo 5bib_result --eval '
  db.chip_verifications.aggregate([
    { \$match: { mysql_race_id: 192, result: \"FOUND\", is_first_verify: true } },
    { \$count: \"count\" }
  ])
'"
```

**Fix:** số liệu khớp Redis SETNX → an toàn. Nếu mismatch nghiêm trọng (> 5%) → escalate.

---

## 🚨 Rollback Khẩn Cấp Race Day

### Mức 1 — DISABLE token (admin click button)

```
Admin → Chip Mappings → "DISABLE" → Confirm
```

→ Tất cả kiosk Bàn 2 trả 401 trong < 1ms. NV chuyển sang manual check-in.

### Mức 2 — Force flush Redis tokens (BE Dev 1)

```bash
ssh 5solution-vps "docker exec 5bib-result-backend node -e \"
  const r = require('ioredis').createClient(process.env.REDIS_URL);
  r.keys('chip:token:*').then(k => k.length && r.del(...k))
   .then(() => console.log('All chip tokens flushed'));
\""
```

### Mức 3 — Disable module (dev only)

Set `PLATFORM_DB_HOST=` empty + restart BE. Toàn bộ chip-verification module tắt → endpoint 404. Reconciliation/Merchant vẫn chạy bình thường.

### Mức 4 — Toàn bộ rollback git

```bash
ssh 5solution-vps "cd /opt/5bib-result && \
  docker compose pull backend:abc123-prev && \
  docker compose up -d backend"
```

→ Revert backend image về commit trước khi merge chip-verification.

---

## 🔍 Debug Commands Quick Reference

### Check BE đang chạy version nào
```bash
ssh 5solution-vps "docker compose ls"
ssh 5solution-vps "docker exec 5bib-result-backend cat dist/version.txt 2>/dev/null || echo 'no version'"
```

### Tail BE log real-time
```bash
ssh 5solution-vps "docker logs -f --tail 50 5bib-result-backend 2>&1 | grep -E 'ChipVerify|chip-verif|Error'"
```

### Check cache state cho race
```bash
ssh 5solution-vps "docker exec 5bib-result-backend redis-cli HLEN chip:athlete:192"
ssh 5solution-vps "docker exec 5bib-result-backend redis-cli GET chip:cache:ready:192"
ssh 5solution-vps "docker exec 5bib-result-backend redis-cli KEYS 'chip:firstverify:192:*' | wc -l"
```

### Check MySQL race có đúng athletes
```bash
ssh 5solution-vps "mysql --protocol=tcp -h localhost -uroot 5bib_platform_live -e '
  SELECT race_id, COUNT(*) as athletes
  FROM athletes WHERE race_id=192 AND deleted=0
  GROUP BY race_id'"
```

### Force re-preload cache
Admin UI → Cache panel → click **🔄 Refresh cache**

Hoặc API direct:
```bash
curl -X POST -H "Authorization: Bearer $TOKEN" \
  https://result.5bib.com/api/admin/races/192/chip-verify/cache \
  -d '{"action":"REFRESH"}'
```

---

## 📞 On-Call Escalation Race Day

```
P0 — Kiosk down > 2 min, hoặc data sai diện rộng
   ↓
   📞 BE Dev 1: 0901-XXX-XXX
   📞 DevOps: 0902-XXX-XXX
   ↓
P1 — Kiosk lag, error rate > 5%
   ↓
   💬 Slack #race-day mention @here
   ↓
P2 — UX issue, NV phàn nàn
   ↓
   💬 Slack #race-day, log lại post-race
```

---

## 🩺 Health Check Trước Race Day (H-18h Rehearsal)

Checklist:

- [ ] Admin GENERATE token thành công, copy URL OK
- [ ] Kiosk URL mở được, click "Bắt đầu" → "Sẵn sàng" hiện
- [ ] RFID reader cắm laptop → quẹt 1 chip thật → athlete card xanh < 3s
- [ ] 4 sound types đều phát rõ (test bằng 4 chip khác nhau cho mỗi state)
- [ ] Stats card update mỗi 30s
- [ ] History list update mỗi 5s
- [ ] Test 100 chip liên tiếp trong 5 phút → không có 429, không lag
- [ ] Test ROTATE token → kiosk cũ trả 401 ngay → kiosk mới hoạt động
- [ ] Reconciliation export chạy bình thường (regression check)
- [ ] MySQL replica lag < 5s (`SHOW SLAVE STATUS\G`)
- [ ] Redis memory < 500MB (`docker exec redis redis-cli INFO memory`)

✅ Tất cả tick → race day green-light.
❌ Một item fail → escalate dev / hoãn pilot.

---

## 📌 Liên Hệ Race Day

| Role | Tên | Liên hệ |
|------|-----|---------|
| BE Dev 1 (on-call) | TBD | dev1@5bib.com / 0901-XXX-XXX |
| FE Dev | TBD | fe@5bib.com |
| DevOps | TBD | devops@5bib.com / 0902-XXX-XXX |
| BTC chính | TBD | btc@5bib.com |
| PO / Danny | Danny Nguyễn | danny@5bib.com (escalation only) |

**Slack channel:** `#race-day` (alerts) · `#chip-verify-pilot` (discussion)

---

*Cheatsheet này in 2 mặt giấy A4 → cuộn dán bên cạnh laptop Bàn 2 chính. Cập nhật mỗi pilot.*
