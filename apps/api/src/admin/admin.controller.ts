import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  ParseUUIDPipe,
  Patch,
  Post,
  Query,
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
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  CreateAdminInviteDto,
  CreateStaffUserDto,
  ListInvitesDto,
  ListStaffUsersDto,
  UpdateStaffUserDto,
} from './admin.model.js';
import { AdminInviteService } from './admin-invite.service.js';
import { AdminService } from './admin.service.js';

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminInviteService: AdminInviteService,
  ) {}

  // ---------------------------------------------------------------------------
  // Staff user CRUD (S-E13-01)
  // ---------------------------------------------------------------------------

  @Get('users')
  @ApiOperation({ summary: 'List staff users with filters and pagination' })
  @ApiResponse({ status: 200, description: 'Paginated list of staff users' })
  @ApiResponse({ status: 403, description: 'Forbidden — admin role required' })
  async listUsers(@Query() query: ListStaffUsersDto) {
    return this.adminService.listUsers(query);
  }

  @Post('users')
  @ApiOperation({ summary: 'Create a staff user with role assignment' })
  @ApiResponse({ status: 201, description: 'Staff user created' })
  @ApiResponse({ status: 409, description: 'User with this email already exists' })
  async createUser(@Body() dto: CreateStaffUserDto) {
    return this.adminService.createUser(dto);
  }

  @Get('users/:id')
  @ApiOperation({ summary: 'Get staff user details' })
  @ApiResponse({ status: 200, description: 'Staff user details' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async getUser(@Param('id', ParseUUIDPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update staff user (role, status, name)' })
  @ApiResponse({ status: 200, description: 'Staff user updated' })
  @ApiResponse({ status: 400, description: 'Cannot change own role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: UpdateStaffUserDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.adminService.updateUser(id, dto, actor.sub);
  }

  @Delete('users/:id')
  @ApiOperation({ summary: 'Soft deactivate a staff user' })
  @ApiResponse({ status: 200, description: 'Staff user deactivated' })
  @ApiResponse({ status: 400, description: 'Cannot deactivate own account' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async deactivateUser(
    @Param('id', ParseUUIDPipe) id: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    await this.adminService.deactivateUser(id, actor.sub);
    return { message: 'User deactivated' };
  }

  // ---------------------------------------------------------------------------
  // Invite management (S-E13-02)
  // ---------------------------------------------------------------------------

  @Post('invites')
  @ApiOperation({ summary: 'Create a staff invite (72h TTL)' })
  @ApiResponse({ status: 201, description: 'Invite created' })
  @ApiResponse({ status: 409, description: 'Active invite already exists for this email' })
  async createInvite(
    @Body() dto: CreateAdminInviteDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.adminInviteService.createInvite(actor.sub, dto);
  }

  @Get('invites')
  @ApiOperation({ summary: 'List invites with status filter' })
  @ApiResponse({ status: 200, description: 'Paginated list of invites' })
  async listInvites(@Query() query: ListInvitesDto) {
    return this.adminInviteService.listInvites(query);
  }

  @Delete('invites/:id')
  @ApiOperation({ summary: 'Revoke a pending invite' })
  @ApiResponse({ status: 200, description: 'Invite revoked' })
  @ApiResponse({ status: 404, description: 'Invite not found' })
  @ApiResponse({ status: 409, description: 'Cannot revoke claimed invite' })
  async revokeInvite(@Param('id', ParseUUIDPipe) id: string) {
    await this.adminInviteService.revokeInvite(id);
    return { message: 'Invite revoked' };
  }
}
