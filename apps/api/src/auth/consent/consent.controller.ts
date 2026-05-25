import {
  Body,
  Controller,
  Get,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth.model.js';
import { GrantConsentDto } from './consent.model.js';
import { ConsentService } from './consent.service.js';

@ApiTags('consent')
@Controller('consent')
@ApiBearerAuth()
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post('grant')
  @ApiOperation({ summary: 'Grant GDPR consent (general data or sensitive data)' })
  @ApiResponse({ status: 201, description: 'Consent granted and recorded' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async grantConsent(
    @Body() dto: GrantConsentDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip;
    const userAgent = req.headers['user-agent'] ?? undefined;
    return this.consentService.grantConsent(user.sub, dto.type, ipAddress, userAgent);
  }

  @Post('withdraw-sensitive')
  @ApiOperation({ summary: 'Withdraw Art. 9 sensitive data consent' })
  @ApiResponse({ status: 201, description: 'Sensitive data consent withdrawn' })
  @ApiResponse({ status: 409, description: 'Cannot withdraw during active crisis case' })
  async withdrawSensitiveConsent(@Req() req: Request) {
    const user = req.user as JwtPayload;
    const ipAddress = (req.headers['x-forwarded-for'] as string) ?? req.ip;
    const userAgent = req.headers['user-agent'] ?? undefined;
    await this.consentService.withdrawSensitiveConsent(user.sub, ipAddress, userAgent);
    return { message: 'Sensitive data consent withdrawn successfully' };
  }

  @Get('status')
  @ApiOperation({ summary: 'Get current consent status' })
  @ApiResponse({ status: 200, description: 'Returns consent timestamps and status' })
  async getConsentStatus(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.consentService.getConsentStatus(user.sub);
  }
}
