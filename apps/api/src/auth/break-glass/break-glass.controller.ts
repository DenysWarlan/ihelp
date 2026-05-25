import { Body, Controller, Ip, Post } from '@nestjs/common';
import { ApiOperation, ApiResponse, ApiTags } from '@nestjs/swagger';

import { Public } from '../decorators/public.decorator.js';
import { BreakGlassLoginDto } from './break-glass.model.js';
import { BreakGlassService } from './break-glass.service.js';

@ApiTags('auth')
@Controller('auth/break-glass')
export class BreakGlassController {
  constructor(private readonly breakGlassService: BreakGlassService) {}

  @Post()
  @Public()
  @ApiOperation({
    summary: 'Emergency break-glass login (all attempts are audit-logged)',
  })
  @ApiResponse({ status: 201, description: 'Break-glass login successful — tokens returned' })
  @ApiResponse({ status: 401, description: 'Invalid credentials' })
  async loginBreakGlass(
    @Body() dto: BreakGlassLoginDto,
    @Ip() ip: string,
  ) {
    return this.breakGlassService.loginBreakGlass(dto.password, ip);
  }
}
