import { Injectable, ExecutionContext } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

@Injectable()
export class OptionalJwtAuthGuard extends AuthGuard('jwt') {
  // Never throw 401 — if no/invalid token, just leave req.user undefined
  override handleRequest<TUser>(_err: unknown, user: TUser): TUser {
    return user;
  }

  override canActivate(context: ExecutionContext) {
    return super.canActivate(context);
  }
}
