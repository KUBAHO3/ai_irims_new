import { ConflictException, Injectable, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import type { User } from '@prisma/client';
import type { UserDto } from '@rfda/shared';
import * as bcrypt from 'bcryptjs';
import { nextValue } from '../core/counters';
import { PrismaService } from '../core/prisma.service';
import { LoginDto, RegisterDto } from './dto';

export const toUserDto = (u: User): UserDto => ({ id: u.id, role: u.role, email: u.email, name: u.name, customerNo: u.customerNo, accountType: u.accountType, phone: u.phone });

@Injectable()
export class AuthService {
  constructor(private prisma: PrismaService, private jwt: JwtService) {}

  async login(dto: LoginDto) {
    const id = dto.identifier.trim();
    const user = await this.prisma.user.findFirst({ where: { OR: [{ email: id.toLowerCase() }, { customerNo: id }] } });
    // Compare even when the user is missing, so timing does not reveal which accounts exist.
    const ok = await bcrypt.compare(dto.password, user?.passwordHash ?? '$2a$10$invalidinvalidinvalidinvalidinvalidinvalidinvalidinv');
    if (!user || !ok) throw new UnauthorizedException('The customer number, email or password is not correct.');
    return { user: toUserDto(user), token: await this.sign(user) };
  }

  async register(dto: RegisterDto) {
    const email = dto.email.trim().toLowerCase();
    if (await this.prisma.user.findUnique({ where: { email } })) throw new ConflictException('An account with this email address already exists. Sign in instead.');
    const passwordHash = await bcrypt.hash(dto.password, 10);
    const user = await this.prisma.$transaction(async (tx) => {
      const customerNo = String(await nextValue(tx, 'customer', 40000));
      return tx.user.create({ data: { role: 'applicant', email, passwordHash, name: dto.name.trim(), customerNo, accountType: dto.accountType, tin: dto.tin, phone: dto.phone, address: dto.address } });
    });
    return { user: toUserDto(user), token: await this.sign(user) };
  }

  async me(id: string) {
    const user = await this.prisma.user.findUnique({ where: { id } });
    if (!user) throw new UnauthorizedException('Sign in to continue');
    return toUserDto(user);
  }

  private sign(user: User) { return this.jwt.signAsync({ sub: user.id, role: user.role }); }
}
