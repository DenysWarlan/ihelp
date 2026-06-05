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
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import {
  GDPR_ADMIN_ROLES,
  GDPR_APPROVER_ROLES,
  GDPR_AUDIT_ROLES,
} from './gdpr.const.js';
import {
  AuditLogQueryDto,
  CreateAccessRequestDto,
  CreateDeletionRequestDto,
  CreateExportRequestDto,
  CreateRetentionPolicyDto,
  CreateSarKeywordDto,
  RejectAccessRequestDto,
  UpdateRetentionPolicyDto,
  UpdateSarKeywordDto,
} from './gdpr.model.js';
import { GdprService } from './gdpr.service.js';

// ===========================================================================
// Person-facing GDPR controller (deletion + export)
// ===========================================================================

@ApiTags('gdpr')
@Controller('gdpr')
@ApiBearerAuth()
export class GdprController {
  constructor(private readonly gdprService: GdprService) {}

  // ---- Deletion request (S-E12-03) ----

  @Post('deletion-request')
  @ApiOperation({ summary: 'Request account and data deletion (Art. 17)' })
  @ApiResponse({ status: 201, description: 'Deletion request created with 30-day grace period' })
  @ApiConflictResponse({ description: 'Deletion request already in progress or export running' })
  async createDeletionRequest(
    @Body() dto: CreateDeletionRequestDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.gdprService.createDeletionRequest(user.sub, dto);
  }

  @Get('deletion-request')
  @ApiOperation({ summary: 'Get current deletion request status' })
  @ApiOkResponse({ description: 'Returns deletion request details' })
  @ApiNotFoundResponse({ description: 'No active deletion request found' })
  async getDeletionRequest(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.gdprService.getDeletionRequest(user.sub);
  }

  @Delete('deletion-request')
  @ApiOperation({ summary: 'Cancel pending deletion request' })
  @ApiOkResponse({ description: 'Deletion request cancelled' })
  @ApiNotFoundResponse({ description: 'No cancellable deletion request found' })
  async cancelDeletionRequest(@Req() req: Request) {
    const user = req.user as JwtPayload;
    await this.gdprService.cancelDeletionRequest(user.sub);
    return { message: 'Deletion request cancelled' };
  }

  // ---- Data export (S-E12-05) ----

  @Post('export-request')
  @ApiOperation({ summary: 'Request data export (Art. 20 Portability)' })
  @ApiResponse({ status: 201, description: 'Export request created, processing asynchronously' })
  @ApiConflictResponse({ description: 'Export already in progress or deletion running' })
  async createExportRequest(
    @Body() dto: CreateExportRequestDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.gdprService.createExportRequest(user.sub, dto);
  }

  @Get('export-request')
  @ApiOperation({ summary: 'Get latest data export request status' })
  @ApiOkResponse({ description: 'Returns export request details' })
  @ApiNotFoundResponse({ description: 'No export request found' })
  async getExportRequest(@Req() req: Request) {
    const user = req.user as JwtPayload;
    return this.gdprService.getExportRequest(user.sub);
  }
}

// ===========================================================================
// Admin GDPR controller (SAR keywords, retention, access requests, audit)
// ===========================================================================

@ApiTags('gdpr-admin')
@Controller('gdpr')
@ApiBearerAuth()
export class GdprAdminController {
  constructor(private readonly gdprService: GdprService) {}

  // ---- SAR Keywords (S-E12-07) ----

  @Get('sar-keywords')
  @Roles(...GDPR_ADMIN_ROLES)
  @ApiOperation({ summary: 'List all SAR keywords' })
  @ApiOkResponse({ description: 'Returns all SAR keywords' })
  async getSarKeywords() {
    return this.gdprService.getSarKeywords();
  }

  @Post('sar-keywords')
  @Roles(...GDPR_ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a new SAR keyword' })
  @ApiResponse({ status: 201, description: 'SAR keyword created' })
  @ApiConflictResponse({ description: 'Keyword already exists' })
  async createSarKeyword(@Body() dto: CreateSarKeywordDto) {
    return this.gdprService.createSarKeyword(dto);
  }

  @Patch('sar-keywords/:id')
  @Roles(...GDPR_ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a SAR keyword (e.g., toggle active status)' })
  @ApiOkResponse({ description: 'SAR keyword updated' })
  @ApiNotFoundResponse({ description: 'SAR keyword not found' })
  async updateSarKeyword(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateSarKeywordDto,
  ) {
    return this.gdprService.updateSarKeyword(id, dto);
  }

  @Delete('sar-keywords/:id')
  @Roles(...GDPR_ADMIN_ROLES)
  @ApiOperation({ summary: 'Delete a SAR keyword' })
  @ApiOkResponse({ description: 'SAR keyword deleted' })
  @ApiNotFoundResponse({ description: 'SAR keyword not found' })
  async deleteSarKeyword(@Param('id', ParseUuidPipe) id: string) {
    await this.gdprService.deleteSarKeyword(id);
    return { message: 'SAR keyword deleted' };
  }

  @Post('sar-keywords/seed')
  @Roles(...GDPR_ADMIN_ROLES)
  @ApiOperation({ summary: 'Seed default SAR keywords (Ukrainian/Russian)' })
  @ApiOkResponse({ description: 'Returns number of keywords seeded' })
  async seedSarKeywords() {
    const count = await this.gdprService.seedDefaultSarKeywords();
    return { seeded: count };
  }

  // ---- Retention Policies (S-E12-09) ----

  @Get('retention-policies')
  @Roles(...GDPR_ADMIN_ROLES)
  @ApiOperation({ summary: 'List all retention policies' })
  @ApiOkResponse({ description: 'Returns all retention policies' })
  async getRetentionPolicies() {
    return this.gdprService.getRetentionPolicies();
  }

  @Post('retention-policies')
  @Roles(...GDPR_ADMIN_ROLES)
  @ApiOperation({ summary: 'Create a retention policy' })
  @ApiResponse({ status: 201, description: 'Retention policy created' })
  @ApiConflictResponse({ description: 'Policy for this entity type already exists' })
  async createRetentionPolicy(@Body() dto: CreateRetentionPolicyDto) {
    return this.gdprService.createRetentionPolicy(dto);
  }

  @Patch('retention-policies/:id')
  @Roles(...GDPR_ADMIN_ROLES)
  @ApiOperation({ summary: 'Update a retention policy' })
  @ApiOkResponse({ description: 'Retention policy updated' })
  @ApiNotFoundResponse({ description: 'Retention policy not found' })
  async updateRetentionPolicy(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: UpdateRetentionPolicyDto,
  ) {
    return this.gdprService.updateRetentionPolicy(id, dto);
  }

  @Delete('retention-policies/:id')
  @Roles(...GDPR_ADMIN_ROLES)
  @ApiOperation({ summary: 'Delete a retention policy' })
  @ApiOkResponse({ description: 'Retention policy deleted' })
  @ApiNotFoundResponse({ description: 'Retention policy not found' })
  async deleteRetentionPolicy(@Param('id', ParseUuidPipe) id: string) {
    await this.gdprService.deleteRetentionPolicy(id);
    return { message: 'Retention policy deleted' };
  }

  // ---- Data Access Requests / Four-Eyes (S-E12-10) ----

  @Post('access-requests')
  @Roles(...GDPR_APPROVER_ROLES)
  @ApiOperation({ summary: 'Request access to a person\'s data (four-eyes principle)' })
  @ApiResponse({ status: 201, description: 'Access request created, awaiting approval' })
  @ApiConflictResponse({ description: 'Pending request already exists' })
  async createAccessRequest(
    @Body() dto: CreateAccessRequestDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.gdprService.createAccessRequest(user.sub, dto);
  }

  @Post('access-requests/:id/approve')
  @Roles(...GDPR_APPROVER_ROLES)
  @ApiOperation({ summary: 'Approve a data access request (four-eyes)' })
  @ApiOkResponse({ description: 'Access request approved' })
  @ApiNotFoundResponse({ description: 'Access request not found' })
  async approveAccessRequest(
    @Param('id', ParseUuidPipe) id: string,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.gdprService.approveAccessRequest(id, user.sub);
  }

  @Post('access-requests/:id/reject')
  @Roles(...GDPR_APPROVER_ROLES)
  @ApiOperation({ summary: 'Reject a data access request' })
  @ApiOkResponse({ description: 'Access request rejected' })
  @ApiNotFoundResponse({ description: 'Access request not found' })
  async rejectAccessRequest(
    @Param('id', ParseUuidPipe) id: string,
    @Body() dto: RejectAccessRequestDto,
    @Req() req: Request,
  ) {
    const user = req.user as JwtPayload;
    return this.gdprService.rejectAccessRequest(id, user.sub, dto.reason);
  }

  @Get('access-requests')
  @Roles(...GDPR_APPROVER_ROLES)
  @ApiOperation({ summary: 'List data access requests' })
  @ApiOkResponse({ description: 'Returns data access requests' })
  async getAccessRequests(
    @Query('status') status?: string,
  ) {
    return this.gdprService.getAccessRequests(status);
  }

  // ---- Audit Log (S-E12-10) ----

  @Get('audit-log')
  @Roles(...GDPR_AUDIT_ROLES)
  @ApiOperation({ summary: 'Get GDPR audit log (filterable)' })
  @ApiOkResponse({ description: 'Returns audit log entries' })
  async getAuditLog(@Query() query: AuditLogQueryDto) {
    return this.gdprService.getAuditLog({
      action: query.action,
      userId: query.userId,
      from: query.from,
      to: query.to,
    });
  }
}
