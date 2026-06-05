import {
  Controller,
  Get,
  Param,
} from '@nestjs/common';
import { ParseUuidPipe } from '../../common/pipes/parse-uuid.pipe.js';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../../auth/decorators/roles.decorator.js';
import { AUDIT_VIEW_ROLES } from '../cases.const.js';
import { AuditEntryResponse, CaseAuditService } from './case-audit.service.js';

@ApiTags('case-audit')
@ApiBearerAuth()
@Roles(...AUDIT_VIEW_ROLES)
@Controller('cases/:caseId/audit')
export class CaseAuditController {
  constructor(private readonly caseAuditService: CaseAuditService) {}

  @Get()
  @ApiOperation({ summary: 'List audit entries for a case (supervisor+ only)' })
  @ApiResponse({ status: 200, description: 'List of audit entries' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async findAll(
    @Param('caseId', ParseUuidPipe) caseId: string,
  ): Promise<AuditEntryResponse[]> {
    return this.caseAuditService.findAll(caseId);
  }
}
