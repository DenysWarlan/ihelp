import { Controller, Get, Query, Req, Res, UseGuards, Logger } from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import { ApiTags, ApiOperation, ApiResponse } from '@nestjs/swagger';
import { Request, Response } from 'express';

import { GOOGLE_STRATEGY } from './auth.const.js';
import { AuthService } from './auth.service.js';
import { OAuthProfile } from './auth.model.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // ---------------------------------------------------------------------------
  // Google OAuth
  // ---------------------------------------------------------------------------

  @Get('google')
  @UseGuards(AuthGuard(GOOGLE_STRATEGY))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth consent screen' })
  googleLogin(): void {
    // Guard redirects to Google
  }

  @Get('google/callback')
  @UseGuards(AuthGuard(GOOGLE_STRATEGY))
  @ApiOperation({ summary: 'Google OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async googleCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleOAuthCallback(req, res, 'google');
  }

  // ---------------------------------------------------------------------------
  // Facebook OAuth
  // ---------------------------------------------------------------------------

  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Facebook OAuth consent screen' })
  facebookLogin(): void {
    // Guard redirects to Facebook
  }

  @Get('facebook/callback')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Facebook OAuth callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async facebookCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleOAuthCallback(req, res, 'facebook');
  }

  // ---------------------------------------------------------------------------
  // Telegram Login Widget
  // ---------------------------------------------------------------------------

  @Get('telegram/callback')
  @UseGuards(AuthGuard('telegram'))
  @ApiOperation({ summary: 'Telegram Login Widget callback' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async telegramCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    await this.handleOAuthCallback(req, res, 'telegram');
  }

  // ---------------------------------------------------------------------------
  // Current user
  // ---------------------------------------------------------------------------

  @Get('me')
  @UseGuards(AuthGuard('jwt'))
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@Req() req: Request) {
    return this.authService.getUserFromToken(req.user as { sub: string; email: string; role: string });
  }

  // ---------------------------------------------------------------------------
  // Shared OAuth callback handler
  // ---------------------------------------------------------------------------

  private async handleOAuthCallback(
    req: Request,
    res: Response,
    provider: string,
  ): Promise<void> {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:4333';

    try {
      const profile = req.user as OAuthProfile;
      if (!profile?.email && provider !== 'telegram') {
        this.logger.warn(`OAuth ${provider}: no email in profile`);
        res.redirect(`${frontendUrl}/login?error=no_email&provider=${provider}`);
        return;
      }

      const tokens = await this.authService.handleOAuthLogin(profile);
      res.redirect(
        `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
      );
    } catch (err) {
      this.logger.error(`OAuth ${provider} callback failed: ${(err as Error).message}`, (err as Error).stack);
      res.redirect(`${frontendUrl}/login?error=oauth_failed&provider=${provider}`);
    }
  }
}
