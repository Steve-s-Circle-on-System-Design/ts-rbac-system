import {
  Body,
  Controller,
  Get,
  Post,
  Query,
  Req,
  UseGuards,
} from '@nestjs/common';

import { Roles } from '../../../common/decorators/roles.decorator';
import { RolesGuard } from '../../../common/guards/roles/roles.guard';
import { UserRole } from '../../users/enums/user.enum';
import { LoginAuthDto } from '../dto/login.dto';
import { RefreshTokenDto } from '../dto/refresh-token.dto';
import { RegisterAuthDto } from '../dto/register.dto';
import { GoogleAuthGuard } from '../guards/google-auth.guard';
import { JwtAuthGuard } from '../guards/jwt-auth.guard';
import { AuthService } from '../services/auth.service';
import { EmailVerificationService } from '../services/email-verification.service';
import { PasswordResetService } from '../services/password-reset.service';
import { TokenService } from '../services/token.service';
import { GoogleProfile } from '../strategies/google.strategy';
import { LoginResponse } from '../types/auth-response.type';

export interface RequestWithGoogleUser extends Request {
  user: GoogleProfile;
}
@Controller('auth')
export class AuthController {
  constructor(
    private readonly authService: AuthService,
    private readonly tokenService: TokenService,
    private readonly emailVerificationService: EmailVerificationService,
    private readonly passwordResetService: PasswordResetService,
  ) {}

  @Post('login')
  login(@Body() loginAuthDto: LoginAuthDto): Promise<LoginResponse> {
    return this.authService.login(loginAuthDto);
  }

  @Post('register')
  async register(
    @Body() registerAuthDto: RegisterAuthDto,
  ): Promise<{ message: string }> {
    await this.authService.register(registerAuthDto);
    return { message: 'Sign Up successful, verify Email.' };
  }

  @Get('verify-email')
  verifyEmail(@Query('token') token: string): Promise<{ verified: boolean }> {
    return this.emailVerificationService.verifyEmail(token);
  }

  @Post('forgot-password')
  async forgotPassword(
    @Body() dto: { email: string },
  ): Promise<{ message: string }> {
    await this.passwordResetService.forgotPassword(dto.email);
    return {
      message:
        'If an account with that email exists, a password reset link has been sent.',
    };
  }

  @Post('reset-password')
  async resetPassword(
    @Body() dto: { newPassword: string },
    @Query('token') token: string,
  ): Promise<{ message: string }> {
    await this.passwordResetService.resetPassword(token, dto.newPassword);
    return { message: 'Your password has been reset successfully.' };
  }
  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponse> {
    return this.tokenService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    return this.tokenService.logout(dto.refreshToken);
  }

  @Get('admin-test')
  @UseGuards(JwtAuthGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminTest(): { message: string } {
    return {
      message: 'You have admin access',
    };
  }

  @Get('google')
  @UseGuards(GoogleAuthGuard)
  googleAuth(): void {
    // Guard triggers the redirect to Google; nothing to do here.
  }

  @Get('google/callback')
  @UseGuards(GoogleAuthGuard)
  googleAuthCallback(
    @Req() req: RequestWithGoogleUser,
  ): Promise<LoginResponse> {
    return this.authService.loginWithGoogle(req.user);
  }
}
