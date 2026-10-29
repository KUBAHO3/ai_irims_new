import { Body, Controller, Get, HttpCode, Post, Res } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type { Response } from 'express';
import { SESSION_COOKIE } from './auth.guard';
import { AuthService } from './auth.service';
import { CurrentUser, Public, SessionUser } from './decorators';
import { LoginDto, RegisterDto } from './dto';

const SESSION_HOURS = 8;

@Controller('auth')
export class AuthController {
  constructor(private auth: AuthService, private config: ConfigService) {}

  @Public() @Post('login') @HttpCode(200)
  async login(@Body() dto: LoginDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.login(dto);
    this.setCookie(res, token);
    return user;
  }

  @Public() @Post('register')
  async register(@Body() dto: RegisterDto, @Res({ passthrough: true }) res: Response) {
    const { user, token } = await this.auth.register(dto);
    this.setCookie(res, token);
    return user;
  }

  @Public() @Post('logout') @HttpCode(204)
  logout(@Res({ passthrough: true }) res: Response) {
    res.clearCookie(SESSION_COOKIE, { path: '/' });
  }

  @Get('me')
  me(@CurrentUser() user: SessionUser) { return this.auth.me(user.id); }

  private setCookie(res: Response, token: string) {
    res.cookie(SESSION_COOKIE, token, {
      httpOnly: true, sameSite: 'lax', path: '/', maxAge: SESSION_HOURS * 3600 * 1000,
      secure: this.config.get('COOKIE_SECURE') === 'true',
    });
  }
}
