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
import { Throttle } from '@nestjs/throttler';
import {
  ApiTags,
  ApiOperation,
  ApiResponse,
  ApiBearerAuth,
  ApiBody,
  ApiParam,
} from '@nestjs/swagger';
import { Request, Response } from 'express';

import { ConfigService } from '@nestjs/config';
import { GOOGLE_STRATEGY } from './auth.const.js';
import { AuthService } from './auth.service.js';
import {
  OAuthProfile,
  JwtPayload,
  RefreshTokenDto,
  StaffLoginDto,
  PersonLoginDto,
  PhoneLoginDto,
  PersonRegisterDto,
  SetPasswordDto,
} from './auth.model.js';
import { Public } from './decorators/public.decorator.js';


@ApiTags('auth')
@Controller('auth')
export class AuthController {
  private readonly logger = new Logger(AuthController.name);

  constructor(
    private readonly authService: AuthService,
    private readonly configService: ConfigService,
  ) {}

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
  // Telegram OpenID Connect (standard OAuth2 flow)
  // ---------------------------------------------------------------------------

  @Public()
  @Get('telegram')
  @ApiOperation({ summary: 'Initiate Telegram OIDC login' })
  @ApiResponse({ status: 302, description: 'Redirects to Telegram OAuth' })
  telegramLogin(@Res() res: Response): void {
    const botId = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '').split(':')[0];
    const telegramDomain = this.configService.get<string>('TELEGRAM_DOMAIN', '');
    const redirectUri = `https://${telegramDomain}/api/auth/telegram/callback`;

    const origin = `https://${telegramDomain}`;
    const url = `https://oauth.telegram.org/auth?bot_id=${botId}&origin=${encodeURIComponent(origin)}&scope=openid+profile&response_type=code&redirect_uri=${encodeURIComponent(redirectUri)}`;

    this.logger.log(`Telegram OIDC redirect: botId=${botId}, redirectUri=${redirectUri}`);
    res.redirect(url);
  }

  @Public()
  @Get('telegram/callback')
  @ApiOperation({ summary: 'Telegram auth callback — validates hash and creates session' })
  @ApiResponse({ status: 302, description: 'Redirects to frontend with tokens' })
  async telegramCallback(
    @Req() req: Request,
    @Res() res: Response,
  ): Promise<void> {
    const frontendUrl = this.configService.get<string>('FRONTEND_URL', 'http://localhost:4333');
    const botToken = this.configService.get<string>('TELEGRAM_BOT_TOKEN', '');
    const query = req.query as Record<string, string>;

    this.logger.log(`Telegram callback received, query keys: ${Object.keys(query).join(', ')}`);

    const hash = query['hash'];
    const id = query['id'];
    if (!hash || !id) {
      this.logger.warn(`Telegram callback: missing hash or id. Query: ${JSON.stringify(query)}`);
      res.redirect(`${frontendUrl}/login?error=telegram_no_data`);
      return;
    }

    try {
      // Validate hash: HMAC-SHA-256(SHA256(bot_token), data_check_string)
      const { createHash, createHmac } = require('crypto');
      const dataCheckString = Object.keys(query)
        .filter((key) => key !== 'hash')
        .sort()
        .map((key) => `${key}=${query[key]}`)
        .join('\n');

      const secretKey = createHash('sha256').update(botToken).digest();
      const computedHash = createHmac('sha256', secretKey)
        .update(dataCheckString)
        .digest('hex');

      if (computedHash !== hash) {
        this.logger.warn('Telegram callback: hash mismatch');
        res.redirect(`${frontendUrl}/login?error=telegram_invalid_hash`);
        return;
      }

      this.logger.log(`Telegram hash valid for id=${id}`);

      const name = [query['first_name'], query['last_name']]
        .filter(Boolean).join(' ') || query['username'] || '';

      const profile: OAuthProfile = {
        provider: 'telegram',
        providerId: id,
        email: `${query['username'] || id}@telegram.user`,
        name,
        avatarUrl: query['photo_url'],
      };

      const tokens = await this.authService.handleOAuthLogin(profile);

      this.logger.log(`Telegram auth success: ${name} (${id}), redirecting to frontend`);
      res.redirect(
        `${frontendUrl}/auth/callback?accessToken=${tokens.accessToken}&refreshToken=${tokens.refreshToken}`,
      );
    } catch (err) {
      this.logger.error(`Telegram auth error: ${(err as Error).message}`, (err as Error).stack);
      res.redirect(`${frontendUrl}/login?error=telegram_failed`);
    }
  }

  // ---------------------------------------------------------------------------
  // Staff Email/Password Login
  // ---------------------------------------------------------------------------

  @Public()
  @Post('staff/login')
  @ApiOperation({ summary: 'Staff email/password login' })
  @ApiBody({ type: StaffLoginDto })
  @ApiResponse({ status: 200, description: 'Returns token pair or MFA challenge' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async staffLogin(@Body() dto: StaffLoginDto) {
    return this.authService.staffLogin(dto.email, dto.password, dto.mfaCode);
  }

  // ---------------------------------------------------------------------------
  // Person Email/Password Login
  // ---------------------------------------------------------------------------

  @Public()
  @Throttle([{ ttl: 60_000, limit: 5 }])
  @Post('person/login')
  @ApiOperation({ summary: 'Person email/password login' })
  @ApiBody({ type: PersonLoginDto })
  @ApiResponse({ status: 200, description: 'Returns token pair' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async personLogin(@Body() dto: PersonLoginDto) {
    return this.authService.personLogin(dto.email, dto.password);
  }

  // ---------------------------------------------------------------------------
  // Person Phone Login
  // ---------------------------------------------------------------------------

  @Public()
  @Throttle([{ ttl: 60_000, limit: 5 }])
  @Post('person/login/phone')
  @ApiOperation({ summary: 'Person phone/password login' })
  @ApiBody({ type: PhoneLoginDto })
  @ApiResponse({ status: 200, description: 'Returns token pair' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async personLoginByPhone(@Body() dto: PhoneLoginDto) {
    return this.authService.personLoginByPhone(dto.phone, dto.password);
  }

  // ---------------------------------------------------------------------------
  // Person Registration
  // ---------------------------------------------------------------------------

  @Public()
  @Throttle([{ ttl: 60_000, limit: 3 }])
  @Post('person/register')
  @ApiOperation({ summary: 'Register a new person account' })
  @ApiBody({ type: PersonRegisterDto })
  @ApiResponse({ status: 201, description: 'Returns token pair' })
  @ApiResponse({ status: 409, description: 'User already exists' })
  async personRegister(@Body() dto: PersonRegisterDto) {
    return this.authService.registerPerson(dto.name, dto.password, dto.email, dto.phone);
  }

  // ---------------------------------------------------------------------------
  // Set Password
  // ---------------------------------------------------------------------------

  @Post('set-password')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Set or change account password' })
  @ApiBody({ type: SetPasswordDto })
  @ApiResponse({ status: 200, description: 'Password updated successfully' })
  @ApiResponse({ status: 400, description: 'Current password required or invalid' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async setPassword(@Req() req: Request, @Body() dto: SetPasswordDto) {
    const user = req.user as JwtPayload;
    return this.authService.setPassword(user.sub, dto.password, dto.currentPassword);
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
