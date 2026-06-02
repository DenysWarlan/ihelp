import { Body, Controller, Ip, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags, ApiTooManyRequestsResponse } from '@nestjs/swagger';
import { Throttle } from '@nestjs/throttler';

import { Public } from '../decorators/public.decorator.js';
import { BreakGlassLoginDto } from './break-glass.model.js';
import { BreakGlassService } from './break-glass.service.js';

@ApiTags('auth')
@Controller('auth/break-glass')
export class BreakGlassController {
  constructor(private readonly breakGlassService: BreakGlassService) {}

  @Post()
  @Public()
  @Throttle([{ ttl: 300_000, limit: 3 }])
  @ApiOperation({
    summary: 'Emergency break-glass login (all attempts are audit-logged)',
  })
  @ApiResponse({ status: 201, description: 'Break-glass login successful — tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  @ApiTooManyRequestsResponse({ description: 'Rate limit exceeded — max 3 attempts per 5 minutes' })
  async loginBreakGlass(
    @Body() dto: BreakGlassLoginDto,
    @Ip() ip: string,
  ) {
    return this.breakGlassService.loginBreakGlass(dto.password, ip);
  }
}
