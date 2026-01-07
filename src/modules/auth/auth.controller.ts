import { Body, Post, Headers, Ip, Res, Delete, Get, Req } from '@nestjs/common';
import { AuthService } from './services';
import { SignUpDto } from './dto';
import { LoginDto } from './dto/login.dto';
import type { CookieOptions, Response, Request } from 'express';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { Public } from './decorators/public.decorator';

const COOKIE_EXPIRE_TIME = 15 * 24 * 60 * 60 * 1000; // 15 days
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: COOKIE_EXPIRE_TIME,
};

export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('signup')
  @Public()
  async signup(@Body() signupDto: SignUpDto) {
    return this.authService.signUp(signupDto);
  }

  @Post('login')
  @Public()
  async login(
    @Body() loginDto: LoginDto,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } = await this.authService.login(
      loginDto,
      ip,
      userAgent,
    );

    response.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return { accessToken, refreshToken };
  }

  @Post('verify-email')
  @Public()
  async verifyEmail(
    @Body() verifyEmailDto: VerifyEmailDto,
    @Headers('user-agent') userAgent: string,
    @Ip() ip: string,
    @Res({ passthrough: true }) response: Response,
  ) {
    const { accessToken, refreshToken } =
      await this.authService.verifyEmailAndLogin(verifyEmailDto, ip, userAgent);

    response.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return { accessToken, refreshToken };
  }

  @Delete('logout')
  public logout(@Res({ passthrough: true }) res: Response): void {
    res.cookie('refreshToken', '', {
      ...COOKIE_OPTIONS,
      maxAge: 0,
    });
  }

  @Get('refresh')
  @Public()
  public async refresh(
    @Req() req: Request,
    @Res({ passthrough: true }) res: Response,
  ): Promise<{ accessToken: string }> {
    const refreshTokenFromCookie = req.cookies.refreshToken || '';
    const { accessToken, refreshToken } = await this.authService.refresh(
      refreshTokenFromCookie as string,
    );

    res.cookie('refreshToken', refreshToken, COOKIE_OPTIONS);

    return { accessToken };
  }
}
