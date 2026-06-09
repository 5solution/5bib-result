export { LogtoAuthGuard } from './logto-auth.guard';
export { LogtoAdminGuard } from './logto-admin.guard';
export { LogtoStaffGuard } from './logto-staff.guard';
// F-069 M1 — Merchant Portal guards (BR-MP-02 + BR-MP-03)
export { LogtoMerchantGuard } from './logto-merchant.guard';
export { LogtoMerchantFinanceGuard } from './logto-merchant-finance.guard';
// F-078 — Internal Finance role guards (BR-78-04 + BR-78-05)
export { LogtoFinanceGuard } from './logto-finance.guard';
export { LogtoStaffOrFinanceGuard } from './logto-staff-or-finance.guard';
export { OptionalLogtoAuthGuard } from './optional-logto-auth.guard';
export { LogtoAuthModule } from './logto-auth.module';
export { LogtoService, type LogtoUserInfo } from './logto.service';
export { CurrentUser } from './current-user.decorator';
export type { LogtoUser, AuthenticatedRequest } from './types';
// F-029 — pure permission helpers (no guard instantiation). Mirrors
// LogtoAdminGuard + LogtoStaffGuard dual-check (roles[] ∪ scopes[]) verbatim.
// F-078 extends: isFinanceOrAdmin + isStaffOrFinanceOrHigher.
export {
  hasUser,
  isAdminOrHigher,
  isStaffOrHigher,
  isFinanceOrAdmin,
  isStaffOrFinanceOrHigher,
} from './permissions.helper';
