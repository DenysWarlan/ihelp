import {
  Body,
  Controller,
  Param,
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
import { Public } from '../decorators/public.decorator.js';
import { Roles } from '../decorators/roles.decorator.js';
import { ClaimInviteDto, CreateInviteDto } from './invite.model.js';
import { InviteService } from './invite.service.js';

@ApiTags('auth')
@Controller('auth/invite')
export class InviteController {
  constructor(private readonly inviteService: InviteService) {}

  @Post()
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Create a staff invite (Admin only)' })
  @ApiResponse({ status: 201, description: 'Invite created successfully' })
  @ApiResponse({ status: 401, description: 'Unauthorized' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async createInvite(
    @Body() dto: CreateInviteDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.inviteService.createInvite(user.sub, dto);
  }

  @Post('claim')
  @Public()
  @ApiOperation({ summary: 'Claim an invite and create a staff account' })
  @ApiResponse({ status: 201, description: 'Account created successfully' })
  @ApiResponse({ status: 404, description: 'Invite not found or expired' })
  @ApiResponse({ status: 409, description: 'Invite already claimed' })
  async claimInvite(@Body() dto: ClaimInviteDto) {
    const user = await this.inviteService.claimInvite(dto);
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
    };
  }

  @Post(':id/resend')
  @Roles('ADMIN')
  @ApiBearerAuth()
  @ApiOperation({ summary: 'Resend a staff invite (Admin only)' })
  @ApiResponse({ status: 201, description: 'New invite created for the same recipient' })
  @ApiResponse({ status: 404, description: 'Original invite not found' })
  async resendInvite(
    @Param('id') id: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.inviteService.resendInvite(id, user.sub);
  }
}
