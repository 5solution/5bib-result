# FEATURE-069 M3b: Plan — Auto-provision Merchant User (magic-link)

**Status:** ✅ APPROVED (Manager init+plan combined, skip BA — Danny chốt magic-link 2026-06-06)
**Type:** EXTEND_EXISTING (backend LogtoService + merchant-portal access + frontend dialog)
**Branch:** `5bib_merchant_v1`

## 🎯 Why
M3 chỉ gán quyền cho user ĐÃ có trên Logto. Thực tế admin chỉ có **email** BTC chưa có account. M3b: gán quyền bằng email → nếu chưa có account → hệ thống tự tạo user Logto (no password) + assign role merchant + gửi **email magic-link** (passwordless, KHÔNG gửi mật khẩu plaintext — Danny chốt).

## 🔑 Mechanism (chốt)
1. `provisionMerchantUser(email, name, permissions)`:
   - `lookupByEmail(email)` → nếu CÓ → trả `userId` cũ (idempotent, KHÔNG tạo trùng).
   - nếu KHÔNG → `POST /api/users {primaryEmail, name}` → `userId` mới.
   - Resolve role id: `GET /api/roles` → map name→id; assign `merchant_finance` nếu permissions có `revenue_report`, else `merchant_viewer`. `POST /api/users/{id}/roles`.
   - Gửi email mời qua `MailService` → link tới merchant login URL (`MERCHANT_PORTAL_LOGIN_URL` env). Passwordless dựa vào Logto Sign-in Experience email-code (G1). Email-send fail → KHÔNG rollback user (log warn, trả flag `inviteEmailSent:false`).
2. Tạo record `merchant_portal_access` như M3 (keyed by userId vừa có).

## ⚠️ PREREQUISITE G1 (Danny bật trên Logto — KHÔNG code được)
- M2M app (`LOGTO_M2M_APP_ID`) phải có Management API role với quyền **create users + read roles + assign user roles** (hiện chỉ cần read cho lookup).
- Logto **Sign-in Experience** bật **email verification-code** (passwordless) để magic-link không cần password.
- (nếu dùng MailService) cấu hình SMTP đã có; nếu dùng Logto email connector thì set trong Logto.
→ Code M3b chạy được nhưng **UAT provision thật chặn tại G1**. Unit test mock Logto API.

## 📋 Scope Lock
**Backend:**
- ✏️ `backend/src/modules/logto-auth/logto.service.ts` — +`createUser`, +`listRoles`/`resolveRoleIdsByNames`, +`assignUserRoles`
- ✏️ `backend/src/modules/merchant-portal/services/merchant-portal-access.service.ts` — provision path trong `create()` (email-or-userId)
- ✏️ `backend/src/modules/merchant-portal/dto/access-config.dto.ts` — `userId` optional + `email` required + response flags `provisioned`/`inviteEmailSent`
- ✏️ `backend/src/modules/merchant-portal/merchant-portal-admin.controller.ts` — @ApiResponse update nếu cần
- ✏️ module wiring nếu cần import MailService (NotificationModule)
- ✏️ specs: access service + adversarial
- ✏️ `backend/src/config/index.ts` — +`MERCHANT_PORTAL_LOGIN_URL` env (default `https://merchant.5bib.com`)

**Frontend:**
- ✏️ `admin/.../access-form-dialog.tsx` — cho phép submit khi chỉ có email (userId optional); badge "Sẽ gửi lời mời" khi user chưa tồn tại; hiện toast "Đã gửi email mời" theo `inviteEmailSent`
- 🔄 regenerate SDK

## 🛑 PAUSE/Gate
- 🛑 KHÔNG `pnpm install` dep mới (MailService + fetch đủ).
- 🛑 G1 chưa bật → provision endpoint sẽ 500 từ Logto (create user 403). Code phải catch + trả lỗi VN rõ "M2M app chưa đủ quyền tạo user — bật scope trên Logto".

## 🧪 Tests (Coder unit + QC)
- provision: email mới → create+assign+email called (mock); email cũ → KHÔNG create (idempotent); email-send fail → user vẫn tạo + flag false; role map đúng theo permissions; Logto 403 → Conflict/BadRequest VN message.

## Verdict: ✅ APPROVED — Coder bắt đầu BE trước.
