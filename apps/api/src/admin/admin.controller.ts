import {
  Body,
  Controller,
  Delete,
  Get,
  Param,
  Patch,
  Post,
  Query,
  Req,
} from '@nestjs/common';
import { ParseUuidPipe } from '../common/pipes/parse-uuid.pipe.js';
import {
  ApiBearerAuth,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { SettingsCategory } from './admin.const.js';
import {
  CreateAdminInviteDto,
  CreateStaffUserDto,
  GetWeeklyScheduleDto,
  ListAuditLogDto,
  ListInvitesDto,
  ListStaffUsersDto,
  UpdateIntegrationDto,
  UpdateSettingsDto,
  UpdateStaffUserDto,
} from './admin.model.js';
import { AdminAuditService } from './admin-audit.service.js';
import { AdminConfigService } from './admin-config.service.js';
import { AdminDutyService } from './admin-duty.service.js';
import { AdminInviteService } from './admin-invite.service.js';
import { AdminService } from './admin.service.js';
import { DuplicateDetectionService } from './duplicate-detection.service.js';
import { DismissDuplicateDto, ExecuteMergeDto, ListDuplicatesDto } from './duplicate.model.js';
import { UserMergeService } from './user-merge.service.js';

@ApiTags('admin')
@Controller('admin')
@ApiBearerAuth()
@Roles('ADMIN')
export class AdminController {
  constructor(
    private readonly adminService: AdminService,
    private readonly adminInviteService: AdminInviteService,
    private readonly adminConfigService: AdminConfigService,
    private readonly adminAuditService: AdminAuditService,
    private readonly adminDutyService: AdminDutyService,
    private readonly duplicateDetectionService: DuplicateDetectionService,
    private readonly userMergeService: UserMergeService,
  ) {}

  // ---------------------------------------------------------------------------
  // Dashboard (admin overview stats)
  // ---------------------------------------------------------------------------

  @Get('dashboard')
  @ApiOperation({ summary: 'Get admin dashboard stats, alerts, and recent audit' })
  @ApiResponse({ status: 200, description: 'Dashboard data' })
  async getDashboard() {
    return this.adminService.getDashboardData();
  }

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

  // ---------------------------------------------------------------------------
  // Duplicate detection & merge (S-E13-05)
  // ---------------------------------------------------------------------------

  @Get('duplicates')
  @ApiOperation({ summary: 'List duplicate user groups with clustering' })
  @ApiResponse({ status: 200, description: 'Grouped list of duplicate users' })
  async listDuplicates(@Query() query: ListDuplicatesDto) {
    return this.duplicateDetectionService.listDuplicateGroups(query);
  }

  @Get('duplicates/history')
  @ApiOperation({ summary: 'List merge history with pagination' })
  @ApiResponse({ status: 200, description: 'Paginated merge history' })
  async listMergeHistory(
    @Query('page') page?: number,
    @Query('pageSize') pageSize?: number,
  ) {
    return this.userMergeService.listMergeHistory(
      page ? Number(page) : undefined,
      pageSize ? Number(pageSize) : undefined,
    );
  }

  @Get('duplicates/history/:mergeId')
  @ApiOperation({ summary: 'Get merge detail by ID' })
  @ApiResponse({ status: 200, description: 'Merge detail' })
  @ApiResponse({ status: 404, description: 'Merge record not found' })
  async getMergeDetail(@Param('mergeId', ParseUuidPipe) mergeId: string) {
    return this.userMergeService.getMergeDetail(mergeId);
  }

  @Get('duplicates/:groupId')
  @ApiOperation({ summary: 'Get duplicate group detail' })
  @ApiResponse({ status: 200, description: 'Group detail with user summaries' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async getDuplicateGroup(@Param('groupId') groupId: string) {
    return this.duplicateDetectionService.getGroupDetail(groupId);
  }

  @Post('duplicates/:groupId/dismiss')
  @ApiOperation({ summary: 'Dismiss a duplicate group as not-duplicate' })
  @ApiResponse({ status: 201, description: 'Group dismissed' })
  @ApiResponse({ status: 404, description: 'Group not found' })
  async dismissDuplicate(
    @Param('groupId') groupId: string,
    @Body() dto: DismissDuplicateDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.duplicateDetectionService.dismissDuplicate(
      groupId,
      actor.sub,
      dto.reason,
    );
  }

  @Post('duplicates/:groupId/merge')
  @ApiOperation({ summary: 'Merge two duplicate users' })
  @ApiResponse({ status: 201, description: 'Users merged successfully' })
  @ApiResponse({ status: 400, description: 'Invalid merge (same user, cross-role, inactive)' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async executeMerge(
    @Body() dto: ExecuteMergeDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.userMergeService.executeMerge(
      dto.primaryUserId,
      dto.secondaryUserId,
      actor.sub,
    );
  }

  // Keep legacy endpoint for backward compatibility with frontend banner
  @Get('users/duplicates')
  @ApiOperation({ summary: 'List potential duplicate user accounts (legacy)' })
  @ApiResponse({ status: 200, description: 'List of potential duplicates' })
  async findDuplicates() {
    const result = await this.duplicateDetectionService.listDuplicateGroups({});
    return { duplicates: [], total: result.total };
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
  async getUser(@Param('id', ParseUuidPipe) id: string) {
    return this.adminService.getUser(id);
  }

  @Patch('users/:id')
  @ApiOperation({ summary: 'Update staff user (role, status, name)' })
  @ApiResponse({ status: 200, description: 'Staff user updated' })
  @ApiResponse({ status: 400, description: 'Cannot change own role' })
  @ApiResponse({ status: 404, description: 'User not found' })
  async updateUser(
    @Param('id', ParseUuidPipe) id: string,
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
    @Param('id', ParseUuidPipe) id: string,
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
  async revokeInvite(@Param('id', ParseUuidPipe) id: string) {
    await this.adminInviteService.revokeInvite(id);
    return { message: 'Invite revoked' };
  }

  // ---------------------------------------------------------------------------
  // Automation settings (S-E13-07)
  // ---------------------------------------------------------------------------

  @Get('settings/:category')
  @ApiOperation({ summary: 'Get all settings in a category' })
  @ApiResponse({ status: 200, description: 'Category settings' })
  @ApiResponse({ status: 400, description: 'Invalid category' })
  async getSettings(
    @Param('category') category: SettingsCategory,
  ) {
    return this.adminConfigService.getSettingsByCategory(category);
  }

  @Patch('settings/:category')
  @ApiOperation({ summary: 'Update settings in a category' })
  @ApiResponse({ status: 200, description: 'Settings updated' })
  @ApiResponse({ status: 400, description: 'Invalid category' })
  async updateSettings(
    @Param('category') category: SettingsCategory,
    @Body() dto: UpdateSettingsDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.adminConfigService.updateSettings(
      category,
      dto.settings,
      actor.sub,
    );
  }

  // ---------------------------------------------------------------------------
  // Integration settings (S-E13-08)
  // ---------------------------------------------------------------------------

  @Get('integrations')
  @ApiOperation({ summary: 'List all integration settings (values masked)' })
  @ApiResponse({ status: 200, description: 'List of integrations' })
  async listIntegrations() {
    return this.adminConfigService.listIntegrations();
  }

  @Patch('integrations/:key')
  @ApiOperation({ summary: 'Update an integration setting' })
  @ApiResponse({ status: 200, description: 'Integration setting updated' })
  async updateIntegration(
    @Param('key') key: string,
    @Body() dto: UpdateIntegrationDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.adminConfigService.updateIntegration(
      key,
      dto.value,
      dto.description,
      actor.sub,
    );
  }

  @Post('integrations/:key/test')
  @ApiOperation({ summary: 'Test an integration connection (MVP: log-based)' })
  @ApiResponse({ status: 200, description: 'Test result' })
  @ApiResponse({ status: 404, description: 'Integration setting not found' })
  async testIntegration(
    @Param('key') key: string,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.adminConfigService.testIntegration(key, actor.sub);
  }

  // ---------------------------------------------------------------------------
  // Crisis line on-call schedule (S-E13-09)
  // ---------------------------------------------------------------------------

  @Get('duty/weekly-schedule')
  @ApiOperation({
    summary: 'Get weekly duty schedule with overlap/gap warnings',
  })
  @ApiResponse({ status: 200, description: 'Weekly schedule view' })
  async getWeeklySchedule(@Query() query: GetWeeklyScheduleDto) {
    return this.adminDutyService.getWeeklySchedule(query.startDate);
  }

  // ---------------------------------------------------------------------------
  // Admin audit log (S-E13-10)
  // ---------------------------------------------------------------------------

  @Get('audit-log')
  @ApiOperation({
    summary: 'Paginated, filterable admin audit log',
  })
  @ApiResponse({ status: 200, description: 'Paginated audit log entries' })
  async listAuditLog(@Query() query: ListAuditLogDto) {
    return this.adminAuditService.listAuditLogs(query);
  }
}
