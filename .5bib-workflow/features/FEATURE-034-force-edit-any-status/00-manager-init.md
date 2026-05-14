# FEATURE-034: Force Edit Contract Any Status

**Status:** 🟢 SHIPPED (combined Manager/Coder mode)
**Created:** 2026-05-14
**Owner:** Danny ("tao muốn hợp đồng có thể sửa đc trong mọi trường hợp, vì cơ bản thật ra cũng lắm chuyện phết")
**Type:** EXTEND_EXISTING (F-024 Contract Management lifecycle)

## 🎯 Why this feature

Pre-F-034: chỉ DRAFT mới sửa được. Admin muốn sửa HĐ ACTIVE/COMPLETED/CANCELLED phải CANCEL HĐ rồi tạo HĐ mới — lằng nhằng, mất continuity số HĐ, sai logic business (đối tác đôi khi yêu cầu sửa sau khi sign).

Post-F-034: edit unlocked cho mọi status. Audit emit `contract.update.force` track accountability. Frontend confirm dialog cảnh báo legal implication.

## 📂 Impact Map

### Module sẽ chạm
- `backend/src/modules/contracts/services/contracts.service.ts` — remove DRAFT-only + TERMINAL_STATES block trong `update()`; add force_edit audit + P&L cache flush
- `backend/src/modules/contracts/services/contracts.update.spec.ts` — replace BadRequestException tests với force-edit + audit assertions (TC-F034-01..05)
- `admin/src/app/(dashboard)/contracts/[id]/page.tsx` — enable "Chỉnh sửa" button non-DRAFT + confirm dialog status-aware warning
- `admin/src/app/(dashboard)/contracts/_components/contract-edit-dialog.tsx` — remove link-only fast-path block trong save(), allow full edit path; banner cảnh báo trong dialog header; toast follow-up

### Backend logic
- Remove explicit blocks ở line 631-648 (DRAFT-only + TERMINAL_STATES)
- KEEP status manipulation block (status update qua endpoint khác): allow `status=CANCELLED` single-field, reject other status changes via update
- Audit emit `contract.update.force` thay `contract.update` cho non-DRAFT edits (metadata: previousStatus + editedFields)
- Flush P&L cache (detail + dashboard) sau force-edit

### Admin UX
- Detail page: bấm "Chỉnh sửa" → status-aware confirm dialog (4 messages khác nhau cho ACTIVE / COMPLETED / CANCELLED+REJECTED / other)
- Edit dialog: banner amber cảnh báo cho non-DRAFT trong DialogHeader
- Save success toast: nhắc admin regenerate DOCX + re-send đối tác

## ⚠️ Risk Flags
- 🔴 HIGH: Legal mismatch giữa HĐ DOCX physical đã sign vs DB sau force-edit → admin tự responsibility (audit log track accountability)
- 🟡 MED: Acceptance report + payment request KHÔNG auto-recompute khi sửa line items COMPLETED → admin phải check manual
- 🟢 LOW backend: Audit logging tăng tải, P&L cache invalidate thêm — negligible
- 🟢 LOW frontend: Confirm dialog UX friction prevents accidental edits

## 🚧 PAUSE Conditions
- Danny đã explicit approve risk: "lắm chuyện phết" = business reality cần unlock
- KHÔNG cần PRD (BA gate SKIP — Manager Plan + Coder combined)

## ✅ Shipped
- Backend: 1 file modified + 1 spec updated với 5 NEW TC-F034-*
- Admin: 2 file modified
- Commit + push + PROD verify
