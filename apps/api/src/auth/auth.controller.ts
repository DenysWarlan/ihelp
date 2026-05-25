import {
  Body,
  Controller,
  Delete,
  Get,
  Logger,
  Param,
  Post,
  Req,
  Res,
  UseGuards,
} from '@nestjs/common';
import { AuthGuard } from '@nestjs/passport';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { GOOGLE_STRATEGY } from './auth.const.js';
import { AuthService } from './auth.service.js';
import {
  OAuthProfile,
  JwtPayload,
  RefreshTokenDto,
} from './auth.model.js';
import { Public } from './decorators/public.decorator.js';

@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(private readonly authService: AuthService) {}

  // ---------------------------------------------------------------------------
  // Google OAuth
  // ---------------------------------------------------------------------------

  @Public()
  @Get('google')
  @UseGuards(AuthGuard(GOOGLE_STRATEGY))
  @ApiOperation({ summary: 'Initiate Google OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Google OAuth consent screen' })
  googleLogin(): void {
    // Guard redirects to Google
  }

  @Public()
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

  @Public()
  @Get('facebook')
  @UseGuards(AuthGuard('facebook'))
  @ApiOperation({ summary: 'Initiate Facebook OAuth login' })
  @ApiResponse({ status: 302, description: 'Redirects to Facebook OAuth consent screen' })
  facebookLogin(): void {
    // Guard redirects to Facebook
  }

  @Public()
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

  @Public()
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
  // Token Refresh (S-E01-04)
  // ---------------------------------------------------------------------------

  @Public()
  @Post('refresh')
  @ApiOperation({ summary: 'Refresh access token using refresh token' })
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } }, required: ['refreshToken'] } })
  @ApiResponse({ status: 200, description: 'Returns new token pair' })
  @ApiResponse({ status: 401, description: 'Invalid or expired refresh token' })
  async refresh(@Body() body: RefreshTokenDto) {
    return this.authService.refreshTokens(body.refreshToken);
  }

  // ---------------------------------------------------------------------------
  // Logout (S-E01-04)
  // ---------------------------------------------------------------------------

  @Post('logout')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Logout and revoke refresh token family' })
  @ApiBody({ schema: { properties: { refreshToken: { type: 'string' } }, required: ['refreshToken'] } })
  @ApiResponse({ status: 200, description: 'Session revoked' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async logout(@Body() body: RefreshTokenDto) {
    await this.authService.logout(body.refreshToken);
    return { message: 'Logged out successfully' };
  }

  // ---------------------------------------------------------------------------
  // Provider Linking (S-E01-03)
  // ---------------------------------------------------------------------------

  @Post('link/:provider')
  @UseGuards(AuthGuard(GOOGLE_STRATEGY))
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Start OAuth flow to link additional provider' })
  @ApiParam({ name: 'provider', description: 'OAuth provider name (google, facebook, telegram)' })
  @ApiResponse({ status: 302, description: 'Redirects to provider OAuth consent screen' })
  linkProvider(): void {
    // Guard redirects to provider
  }

  @Public()
  @Get('link/:provider/callback')
  @ApiOperation({ summary: 'OAuth callback for provider linking' })
  @ApiParam({ name: 'provider', description: 'OAuth provider name' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend after linking' })
  async linkProviderCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = process.env['FRONTEND_URL'] ?? 'http://localhost:4333';

    try {
      const profile = req.user as OAuthProfile;
      const jwtPayload = req.user as JwtPayload;

      if (!jwtPayload?.sub) {
        res.redirect(`${frontendUrl}/settings/providers?error=not_authenticated`);
        return;
      }

      await this.authService.linkProvider(jwtPayload.sub, profile);
      res.redirect(`${frontendUrl}/settings/providers?linked=${profile.provider}`);
    } catch (err) {
      this.logger.error(`Provider linking failed: ${(err as Error).message}`, (err as Error).stack);
      res.redirect(`${frontendUrl}/settings/providers?error=link_failed`);
    }
  }

  @Delete('providers/:linkId')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Unlink an OAuth provider' })
  @ApiParam({ name: 'linkId', description: 'Provider link ID to remove' })
  @ApiResponse({ status: 200, description: 'Provider unlinked' })
  @ApiResponse({ status: 409, description: 'Cannot unlink last provider' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async unlinkProvider(
    @Req() req: Request,
    @Param('linkId') linkId: string,
  ) {
    const user = req.user as JwtPayload;
    await this.authService.unlinkProvider(user.sub, linkId);
    return { message: 'Provider unlinked successfully' };
  }

  @Get('providers')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'List linked OAuth providers for current user' })
  @ApiResponse({ status: 200, description: 'Returns list of linked providers' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async getProviders(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.authService.getProviders(user.sub);
  }

  // ---------------------------------------------------------------------------
  // Current user
  // ---------------------------------------------------------------------------

  @Get('me')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Get current user profile' })
  @ApiResponse({ status: 200, description: 'Returns current user' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async me(@Req() req: Request) {
    return this.authService.getUserFromToken(req.user as JwtPayload);
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
