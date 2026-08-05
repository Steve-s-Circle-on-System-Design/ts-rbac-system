import { AuthService } from './auth.service';

import { Body, Controller, Get, Post, Query, UseGuards } from '@nestjs/common';

import { Roles } from './../../common/decorators/roles.decorator';
import { RolesGuard } from './../../common/guards/roles/roles.guard';
import { UserRole } from './../../core/auth/entities/user.entity';
import { jwtGuard } from './../auth/guards/jwt.guard';
import { CreateAuthDto } from './dto/create-auth.dto';
import { RefreshTokenDto } from './dto/refresh-token.dto';
import { LoginResponse } from './interfaces/auth-response.interface';

@Controller('auth')
export class AuthController {
  constructor(private readonly authService: AuthService) {}

  @Post('login')
  login(
    @Body() createAuthDto: CreateAuthDto,
  ): Promise<{ accessToken: string }> {
    return this.authService.login(createAuthDto);
  }

  @Post('register')
  async register(@Body() dto: CreateAuthDto): Promise<{ message: string }> {
    await this.authService.register(dto);
    return { message: 'Sign Up successful, verify Email.' };
  }

  @Get('verify-email')
  verifyEmail(@Query('token') token: string): Promise<{ verified: boolean }> {
    return this.authService.verifyEmail(token);
  }

  @Post('refresh')
  refresh(@Body() dto: RefreshTokenDto): Promise<LoginResponse> {
    return this.authService.refreshTokens(dto.refreshToken);
  }

  @Post('logout')
  logout(@Body() dto: RefreshTokenDto): Promise<{ message: string }> {
    return this.authService.logout(dto.refreshToken);
  }

  @Get('admin-test')
  @UseGuards(jwtGuard, RolesGuard)
  @Roles(UserRole.ADMIN)
  adminTest(): { message: string } {
    return {
      message: 'You have admin access',
    };
  }
}
