# FEATURE-069 M3b: Deploy & Memory Sync — Auto-provision Merchant (magic-link)

**Status:** ✅ DONE (M3b code-complete; UAT provision THẬT gated on G1. F-069 stays IN-FLIGHT)
**Deployed:** 2026-06-06 · **Branch:** `5bib_merchant_v1`
**Combined Coder log + QC + Manager deploy (Manager orchestrating all roles per Danny mandate)**

## Coder summary (03)
- `LogtoService`: +`createUser`/`resolveRoleIdsByNames`/`assignUserRoles` (reuse `managementApi`, throw-on-fail).
- `merchant-portal-access.service.create()`: `resolveOrProvisionUser()` — userId path | email-lookup (idempotent) | provision (create+role+invite email). Email fail → no rollback (flag). Logto 403/unconfigured → 400 VN.
- DTO: `userId` optional + response `provisioned`/`inviteEmailSent`. Config `MERCHANT_PORTAL_LOGIN_URL`. Module +NotificationModule.
- FE dialog: userId optional, "Sẽ gửi lời mời" badge, provision toast (email sent / not), regen SDK.
- Tests: 25/25 access spec (6 M3b: provision/role-map/idempotent/no-scope-400/email-fail/userId-path). tsc backend+admin clean. Backend rebuilt + relaunched (8081, swagger has flags).

## QC (04) — Independent verify
- ✅ Security: provision CHỈ qua `LogtoAdminGuard` admin endpoint. Magic-link — **NO plaintext password** (Danny chốt). MailService.sendCustomHtml graceful.
- ✅ Idempotency: email đã có Logto → KHÔNG create trùng (test). 
- ✅ Role map: revenue_report→`merchant_finance`, else `merchant_viewer` (test).
- ✅ Failure modes: Logto no-scope → 400 VN, KHÔNG tạo record; email fail → user vẫn tạo, `inviteEmailSent:false` (test).
- ⚠️ Orphan risk (LOW): createUser OK nhưng Mongo.create fail non-dup → user Logto mồ côi. Idempotent lookup nhặt lại lần sau. → TD-F069-M3b-ORPHAN-USER.
- ⛔ **Gate G1:** UAT provision thật chặn tới khi Danny bật M2M scope (create users + roles). Đến lúc đó test mock đã cover logic; provision thật trả 400 đúng-thiết-kế.

## Manager Code Review (independent, 0 red flag)
1. `LogtoService` provision methods — ✅ managementApi reuse, throw on fail, `isConfigured` gate.
2. `resolveOrProvisionUser` — ✅ 3 path đúng; role map đúng; email try/catch không throw.
3. `create()` — ✅ thread `resolved.userId` qua lock+dup+create+audit+invalidate (không sót `dto.userId`).
4. DTO userId optional + flags — ✅ FE gửi `userId || undefined`.
5. FE dialog — ✅ provision badge + toast + typecheck data.provisioned.
**APPROVED.**

## Memory diff (applied)
- feature-log: F-069 row +M3b shipped.
- change-history: M3b entry.
- known-issues: +TD-F069-M3b-ORPHAN-USER (LOW); G1 prerequisite reaffirmed.
- conventions: provision pattern (managementApi reuse + magic-link invite, no plaintext pw).

## Follow-up
- G1 bật → UAT: gán email mới qua M3 UI → user tạo trên Logto + email mời + role assigned. Đóng cùng auth-smoke (G3).
- Next: **M4 merchant.5bib.com frontend**.

🟠 **M3b DONE (code) — F-069 IN-FLIGHT. Tiếp M4.**
