import {
  Body,
  Controller,
  Delete,
  Get,
  Headers,
  Ip,
  Param,
  Patch,
  Post,
  Req,
  Res,
} from '@nestjs/common';
import type { CookieOptions, Request, Response } from 'express';

import { GetUser } from './decorators/get-user.decorator';
import { Public } from './decorators/public.decorator';
import { SendOtpDto, SignUpDto } from './dto';
import { LoginDto } from './dto/login.dto';
import { UpdateUserDto } from './dto/update-user.dto';
import { VerifyEmailDto } from './dto/verify-email.dto';
import { AuthService } from './services';
import { ForgotPasswordDto } from './dto/forgot-password.dto';

const COOKIE_EXPIRE_TIME = 15 * 24 * 60 * 60 * 1000; // 15 days
const COOKIE_OPTIONS: CookieOptions = {
  httpOnly: true,
  secure: true,
  sameSite: 'strict',
  maxAge: COOKIE_EXPIRE_TIME,
};

@Controller('auth')
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

    return { accessToken };
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

    return { accessToken };
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

  @Get('user')
  public async getUser(@GetUser('id') userId: string) {
    return this.authService.getUser(userId);
  }

  @Public()
  @Post('send-otp')
  public async sendOtp(@Body() sendOtpDto: SendOtpDto) {
    return this.authService.sendOtp(sendOtpDto);
  }

  @Patch('user/:id')
  public async updateUser(
    @Body() updateUserDto: UpdateUserDto,
    @Param('id') id: string,
  ) {
    return this.authService.updateUser(id, updateUserDto);
  }

  @Delete('user/:id')
  public async deleteUser(@Param('id') id: string) {
    return this.authService.deleteUser(id);
  }

  @Post('forgot-password')
  @Public()
  public async forgotPassword(@Body() forgotPasswordDto: ForgotPasswordDto) {
    return this.authService.forgotPassword(forgotPasswordDto);
  }
}
