import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
} from '@nestjs/common';
import {
  ApiBearerAuth,
  ApiNotFoundResponse,
  ApiOkResponse,
  ApiOperation,
  ApiTags,
} from '@nestjs/swagger';

import { Roles } from '../auth/decorators/roles.decorator.js';
import { SlaTimerResponse } from './sla.model.js';
import { SlaService } from './sla.service.js';

@ApiTags('sla')
@ApiBearerAuth()
@Controller('cases')
export class SlaController {
  constructor(private readonly slaService: SlaService) {}

  @Get(':caseId/sla')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary: 'Get the SLA timer for a case',
    description:
      'Returns the current SLA timer state including escalation level and status.',
  })
  @ApiOkResponse({ description: 'SLA timer details' })
  @ApiNotFoundResponse({ description: 'No SLA timer found for this case' })
  async getSlaTimer(
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<SlaTimerResponse> {
    return this.slaService.getTimer(caseId);
  }
}
