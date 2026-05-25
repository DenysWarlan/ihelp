import {
  Body,
  Controller,
  Delete,
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
import { ConsentDto } from './consent.model.js';
import { ConsentService } from './consent.service.js';

@ApiTags('auth')
@Controller('auth/consent')
@ApiBearerAuth()
export class ConsentController {
  constructor(private readonly consentService: ConsentService) {}

  @Post()
  @ApiOperation({ summary: 'Grant GDPR consent' })
  @ApiResponse({ status: 201, description: 'Consent granted' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  async grantConsent(
    @Body() dto: ConsentDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.consentService.grantConsent(user.sub, dto.type);
  }

  @Delete('sensitive')
  @ApiOperation({ summary: 'Revoke Art. 9 sensitive data consent' })
  @ApiResponse({ status: 200, description: 'Sensitive consent revoked' })
  @ApiResponse({
    status: 409,
    description: 'Cannot revoke during active crisis',
  })
  async revokeConsent(@Req() req: Request) {
    const user = req.user as JwtPayload;
    await this.consentService.revokeConsent(user.sub, 'sensitive');
    return { message: 'Sensitive data consent revoked' };
  }

  @Get()
  @ApiOperation({ summary: 'Get consent status' })
  @ApiResponse({ status: 200, description: 'Returns consent timestamps and status' })
  async getConsentStatus(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.consentService.getConsentStatus(user.sub);
  }
}
