import { CanActivate, ExecutionContext, ForbiddenException, Injectable, UnauthorizedException } from '@nestjs/common';
import { Reflector } from '@nestjs/core';
import { JwtService } from '@nestjs/jwt';
import type { Role } from '@rfda/shared';
import { IS_PUBLIC, ROLES, SessionUser } from './decorators';

export const SESSION_COOKIE = 'rfda_session';

@Injectable()
export class AuthGuard implements CanActivate {
  constructor(private jwt: JwtService, private reflector: Reflector) {}

  async canActivate(ctx: ExecutionContext): Promise<boolean> {
    const req = ctx.switchToHttp().getRequest();
    const targets = [ctx.getHandler(), ctx.getClass()];
    const token: string | undefined = req.cookies?.[SESSION_COOKIE];
    if (token) {
      try {
        const p = await this.jwt.verifyAsync<{ sub: string; role: Role }>(token);
        req.user = { id: p.sub, role: p.role } satisfies SessionUser;
      } catch { /* expired or tampered: treated as signed out */ }
    }
    if (this.reflector.getAllAndOverride<boolean>(IS_PUBLIC, targets)) return true;
    if (!req.user) throw new UnauthorizedException('Sign in to continue');
    const roles = this.reflector.getAllAndOverride<Role[]>(ROLES, targets);
    if (roles && !roles.includes(req.user.role)) throw new ForbiddenException('Your account cannot do this');
    return true;
  }
}
