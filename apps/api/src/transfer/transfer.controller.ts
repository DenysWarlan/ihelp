import {
  Body,
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  Post,
  Req,
} from '@nestjs/common';
import {
  ApiBadRequestResponse,
  ApiBearerAuth,
  ApiConflictResponse,
  ApiNotFoundResponse,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { Request } from 'express';

import { JwtPayload } from '../auth/auth.model.js';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { TRANSFER_ROLES } from './transfer.const.js';
import {
  AcceptTransferMatchDto,
  InitiatePermanentTransferDto,
  InitiateVacationTransferDto,
  ReturnCasesDto,
} from './transfer.model.js';
import { TransferService } from './transfer.service.js';

@ApiTags('transfers')
@ApiBearerAuth()
@Controller('transfers')
export class TransferController {
  constructor(private readonly transferService: TransferService) {}

  @Post('vacation')
  @Roles(...TRANSFER_ROLES)
  @ApiOperation({
    summary: 'Initiate vacation (temporary) transfer',
    description:
      'Transfers all active and on-hold cases from a consultant going on vacation. ' +
      'Creates CaseTransfer records with auto-matched replacements. ' +
      'Sets consultant status to ON_VACATION.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transfer initiation result with proposed matches',
  })
  @ApiNotFoundResponse({ description: 'Consultant profile not found' })
  @ApiBadRequestResponse({ description: 'No active cases to transfer' })
  async initiateVacation(
    @Body() dto: InitiateVacationTransferDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.transferService.initiateVacationTransfer(dto, actor.sub);
  }

  @Post('permanent')
  @Roles(...TRANSFER_ROLES)
  @ApiOperation({
    summary: 'Initiate permanent transfer (consultant leaving)',
    description:
      'Transfers all active cases from a departing consultant. ' +
      'BLOCKED if any crisis case exists. ' +
      'After all transfers complete, consultant status is set to DEACTIVATED.',
  })
  @ApiResponse({
    status: 201,
    description: 'Transfer initiation result with proposed matches',
  })
  @ApiNotFoundResponse({ description: 'Consultant profile not found' })
  @ApiBadRequestResponse({
    description: 'Crisis cases exist or no active cases',
  })
  async initiatePermanent(
    @Body() dto: InitiatePermanentTransferDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.transferService.initiatePermanentTransfer(dto, actor.sub);
  }

  @Post(':id/accept')
  @Roles(...TRANSFER_ROLES)
  @ApiOperation({
    summary: 'Accept or override a proposed transfer match',
    description:
      'Completes a pending transfer by accepting the auto-matched consultant ' +
      'or overriding with a specific consultant. Reassigns the case and updates capacity counters.',
  })
  @ApiResponse({ status: 201, description: 'Completed transfer match' })
  @ApiNotFoundResponse({ description: 'Transfer not found' })
  @ApiBadRequestResponse({ description: 'Transfer not in PENDING status' })
  async acceptMatch(
    @Param('id', ParseUUIDPipe) id: string,
    @Body() dto: AcceptTransferMatchDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.transferService.acceptTransferMatch(id, dto, actor.sub);
  }

  @Get('consultant/:userId/pending')
  @Roles(...TRANSFER_ROLES)
  @ApiOperation({
    summary: 'List pending transfers for a consultant',
    description: 'Returns all pending CaseTransfer records for the specified consultant.',
  })
  @ApiResponse({ status: 200, description: 'List of pending transfer matches' })
  async getPendingTransfers(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    return this.transferService.getPendingTransfers(userId);
  }

  // ---------------------------------------------------------------------------
  // S-E10-06: Transfer history for a case
  // ---------------------------------------------------------------------------

  @Get('case/:caseId/history')
  @Roles(...TRANSFER_ROLES)
  @ApiOperation({
    summary: 'Get transfer history for a care case',
    description:
      'Returns all transfer records for the specified case, including ' +
      'consultant names, transfer type, and timestamps.',
  })
  @ApiResponse({ status: 200, description: 'List of transfer history entries' })
  @ApiNotFoundResponse({ description: 'Care case not found' })
  async getTransferHistory(
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ) {
    return this.transferService.getTransferHistory(caseId);
  }

  // ---------------------------------------------------------------------------
  // S-E10-07: Validate consultant deactivation
  // ---------------------------------------------------------------------------

  @Get('consultant/:userId/validate-deactivation')
  @Roles('COORDINATOR', 'ADMIN')
  @ApiOperation({
    summary: 'Check if consultant can be deactivated',
    description:
      'Returns 200 if consultant has no active cases. ' +
      'Returns 409 Conflict with a list of blocking cases if active cases exist.',
  })
  @ApiResponse({ status: 200, description: 'Consultant can be deactivated' })
  @ApiConflictResponse({
    description: 'Consultant has active cases that block deactivation',
  })
  async validateDeactivation(
    @Param('userId', ParseUUIDPipe) userId: string,
  ) {
    await this.transferService.validateConsultantDeactivation(userId);
    return { canDeactivate: true };
  }

  // ---------------------------------------------------------------------------
  // S-E10-08: Return cases after vacation
  // ---------------------------------------------------------------------------

  @Get('returnable')
  @Roles(...TRANSFER_ROLES)
  @ApiOperation({
    summary: 'List cases that can be returned after vacation',
    description:
      'Returns completed vacation transfers where the original consultant ' +
      'can reclaim their cases.',
  })
  @ApiResponse({ status: 200, description: 'List of returnable transfers' })
  async getReturnableTransfers(@Req() req: Request) {
    const actor = req.user as JwtPayload;
    return this.transferService.getReturnableTransfers(actor.sub);
  }

  @Post('return')
  @Roles(...TRANSFER_ROLES)
  @ApiOperation({
    summary: 'Return selected cases after vacation',
    description:
      'Bulk return cases to the original consultant. ' +
      'Validates workload limits before returning.',
  })
  @ApiResponse({ status: 201, description: 'Return result' })
  @ApiBadRequestResponse({
    description: 'Workload limit exceeded or no eligible transfers',
  })
  async returnCases(
    @Body() dto: ReturnCasesDto,
    @Req() req: Request,
  ) {
    const actor = req.user as JwtPayload;
    return this.transferService.returnCases(dto, actor.sub);
  }
}
