export { LogtoAuthGuard } from './logto-auth.guard';
export { LogtoAdminGuard } from './logto-admin.guard';
export { LogtoStaffGuard } from './logto-staff.guard';
export { OptionalLogtoAuthGuard } from './optional-logto-auth.guard';
export { LogtoAuthModule } from './logto-auth.module';
export { LogtoService } from './logto.service';
export { CurrentUser } from './current-user.decorator';
export type { LogtoUser, AuthenticatedRequest } from './types';
// F-029 — pure permission helpers (no guard instantiation). Mirrors
// LogtoAdminGuard + LogtoStaffGuard dual-check (roles[] ∪ scopes[]) verbatim.
export {
  hasUser,
  isAdminOrHigher,
  isStaffOrHigher,
} from './permissions.helper';
