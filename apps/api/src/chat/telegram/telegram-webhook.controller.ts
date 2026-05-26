import {
  Body,
  Controller,
  Headers,
  HttpCode,
  HttpStatus,
  Logger,
  Post,
  UnauthorizedException,
} from '@nestjs/common';
import {
  ApiExcludeEndpoint,
  ApiOperation,
  ApiResponse,
  ApiTags,
} from '@nestjs/swagger';
import { ConfigService } from '@nestjs/config';

import { Public } from '../../auth/decorators/public.decorator.js';
import { TelegramUpdate } from '../chat.model.js';
import { TelegramService } from './telegram.service.js';
import { TELEGRAM_WEBHOOK_HEADER } from './telegram.const.js';

@ApiTags('webhooks')
@Controller('webhooks/telegram')
export class TelegramWebhookController {
  private readonly logger = new Logger(TelegramWebhookController.name);
  private readonly secretToken: string;

  constructor(
    private readonly telegramService: TelegramService,
    private readonly configService: ConfigService,
  ) {
    this.secretToken = this.configService.get<string>(
      'TELEGRAM_WEBHOOK_SECRET',
      '',
    );
  }

  @Post()
  @Public()
  @HttpCode(HttpStatus.OK)
  @ApiOperation({ summary: 'Receive Telegram webhook updates' })
  @ApiResponse({ status: 200, description: 'Update processed' })
  @ApiResponse({ status: 401, description: 'Invalid secret token' })
  @ApiExcludeEndpoint() // Hide from public Swagger docs
  async handleUpdate(
    @Headers(TELEGRAM_WEBHOOK_HEADER) headerToken: string | undefined,
    @Body() update: TelegramUpdate,
  ): Promise<{ ok: boolean }> {
    this.logger.log(`Webhook received — update_id: ${update.update_id}, has_message: ${!!update.message}, has_edited: ${!!update.edited_message}`);

    this.validateSecretToken(headerToken);

    if (update.message) {
      this.logger.log(
        `Incoming TG message: chat_id=${update.message.chat.id}, from=${update.message.from?.first_name ?? 'unknown'} (${update.message.from?.id}), text="${(update.message.text ?? '').slice(0, 50)}"`,
      );
    }

    // Process asynchronously — Telegram requires 200 OK within seconds
    void this.telegramService.processUpdate(update).catch((error) => {
      this.logger.error(
        `Failed to process Telegram update ${update.update_id}`,
        error instanceof Error ? error.stack : String(error),
      );
    });

    return { ok: true };
  }

  private validateSecretToken(headerToken: string | undefined): void {
    if (!this.secretToken) {
      this.logger.warn(
        'TELEGRAM_WEBHOOK_SECRET is not configured — rejecting all webhook requests',
      );
      throw new UnauthorizedException('Webhook secret not configured');
    }

    if (headerToken !== this.secretToken) {
      throw new UnauthorizedException('Invalid webhook secret token');
    }
  }
}
