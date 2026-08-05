import { AuthController } from './auth.controller';
import { AuthService } from './auth.service';

import { Test, TestingModule } from '@nestjs/testing';

describe('AuthController', () => {
  let controller: AuthController;
  let authService: {
    login: jest.Mock;
    register: jest.Mock;
    refreshTokens: jest.Mock;
    logout: jest.Mock;
  };

  beforeEach(async () => {
    authService = {
      login: jest.fn(),
      register: jest.fn(),
      refreshTokens: jest.fn(),
      logout: jest.fn(),
    };

    const module: TestingModule = await Test.createTestingModule({
      controllers: [AuthController],
      providers: [
        {
          provide: AuthService,
          useValue: authService,
        },
      ],
    }).compile();

    controller = module.get<AuthController>(AuthController);
  });

  it('should be defined', () => {
    expect(controller).toBeDefined();
  });

  describe('refresh', () => {
    it('delegates to authService.refreshTokens with the given token', async () => {
      const dto = { refreshToken: 'some-refresh-token' };
      authService.refreshTokens.mockResolvedValueOnce({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });

      const result = await controller.refresh(dto);

      expect(authService.refreshTokens).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toEqual({
        accessToken: 'new-access',
        refreshToken: 'new-refresh',
      });
    });
  });

  describe('logout', () => {
    it('delegates to authService.logout with the given token', async () => {
      const dto = { refreshToken: 'some-refresh-token' };
      authService.logout.mockResolvedValueOnce({
        message: 'Logged out successfully',
      });

      const result = await controller.logout(dto);

      expect(authService.logout).toHaveBeenCalledWith(dto.refreshToken);
      expect(result).toEqual({ message: 'Logged out successfully' });
    });
  });
});
