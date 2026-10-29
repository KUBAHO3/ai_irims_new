import { createParamDecorator, ExecutionContext, SetMetadata } from '@nestjs/common';
import type { Role } from '@rfda/shared';

export interface SessionUser { id: string; role: Role }

export const IS_PUBLIC = 'isPublic';
/** Route needs no session (a session is still read if present). */
export const Public = () => SetMetadata(IS_PUBLIC, true);

export const ROLES = 'roles';
export const Roles = (...roles: Role[]) => SetMetadata(ROLES, roles);

export const CurrentUser = createParamDecorator((_data: unknown, ctx: ExecutionContext): SessionUser => ctx.switchToHttp().getRequest().user);
