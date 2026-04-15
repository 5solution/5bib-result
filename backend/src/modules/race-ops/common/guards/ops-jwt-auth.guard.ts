import { Injectable } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';

/**
 * JWT auth guard cho ops endpoints. Dùng passport strategy 'jwt-ops'.
 * Không overlap với admin `JwtAuthGuard` ('jwt') → zero impact admin flow.
 */
@Injectable()
export class OpsJwtAuthGuard extends AuthGuard('jwt-ops') {}
