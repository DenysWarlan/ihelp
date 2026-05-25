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

import { JwtPayload } from '../auth/auth.model.js';
import { CreateDeletionRequestDto } from './gdpr.model.js';
import { GdprService } from './gdpr.service.js';

@ApiTags('gdpr')
@Controller('gdpr')
@ApiBearerAuth()
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  @Post('deletion-request')
  @ApiOperation({ summary: 'Request account and data deletion (Art. 17)' })
  @ApiResponse({ status: 201, description: 'Deletion request created with 30-day grace period' })
  @ApiResponse({ status: 409, description: 'Deletion request already in progress' })
  async createDeletionRequest(
    @Body() dto: CreateDeletionRequestDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.gdprService.createDeletionRequest(user.sub, dto);
  }

  @Get('deletion-request')
  @ApiOperation({ summary: 'Get current deletion request status' })
  @ApiResponse({ status: 200, description: 'Returns deletion request details' })
  @ApiResponse({ status: 404, description: 'No active deletion request found' })
  async getDeletionRequest(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.gdprService.getDeletionRequest(user.sub);
  }

  @Delete('deletion-request')
  @ApiOperation({ summary: 'Cancel pending deletion request' })
  @ApiResponse({ status: 200, description: 'Deletion request cancelled' })
  @ApiResponse({ status: 404, description: 'No cancellable deletion request found' })
  async cancelDeletionRequest(@Req() req: Request) {
    const user = req.user as JwtPayload;
    await this.gdprService.cancelDeletionRequest(user.sub);
    return { message: 'Deletion request cancelled' };
  }
}
