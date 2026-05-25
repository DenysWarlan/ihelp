import { Body, Controller, Post, Req } from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth.model.js';
import { Public } from '../decorators/public.decorator.js';
import { MfaTokenDto } from './mfa.model.js';
import { MfaService } from './mfa.service.js';

@ApiTags('auth')
@Controller('auth/mfa')
export class MfaController {
  constructor(private readonly mfaService: MfaService) {}

  @Post('setup')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Initiate MFA setup — returns secret and QR code' })
  @ApiResponse({ status: 201, description: 'MFA secret and QR code data URL' })
  @ApiResponse({ status: 400, description: 'MFA already enabled' })
  async setupMfa(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.mfaService.setupMfa(user.sub);
  }

  @Post('enable')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Enable MFA — verifies TOTP token and returns backup codes' })
  @ApiResponse({ status: 201, description: 'MFA enabled, backup codes returned' })
  @ApiResponse({ status: 400, description: 'Invalid token or MFA not set up' })
  async enableMfa(@Body() dto: MfaTokenDto, @Req() req: Request) {
    const user = req.user as JwtPayload;
    const backupCodes = await this.mfaService.enableMfa(user.sub, dto.token);
    return { backupCodes };
  }

  @Post('verify')
  @Public()
  @ApiOperation({ summary: 'Verify TOTP token during login flow' })
  @ApiResponse({ status: 201, description: 'Verification result' })
  @ApiResponse({ status: 400, description: 'MFA not enabled' })
  async verifyMfa(@Body() dto: MfaTokenDto & { userId: string }) {
    const isValid = await this.mfaService.verifyMfa(dto.userId, dto.token);
    return { valid: isValid };
  }
}
