import { Module, forwardRef } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { CrisisModule } from '../crisis/crisis.module.js';
import { SlaModule } from '../sla/sla.module.js';
import { MessageService } from './message.service.js';
import {
  CaseChannelController,
  MessageController,
  MessageReadController,
} from './message.controller.js';
import { ChatGateway } from './chat.gateway.js';
import { TelegramWebhookController } from './telegram/telegram-webhook.controller.js';
import { TelegramService } from './telegram/telegram.service.js';
import { WebAdapter } from './adapters/web.adapter.js';
import { TelegramAdapter } from './adapters/telegram.adapter.js';
import { GenericAdapter } from './adapters/generic.adapter.js';
import { AdapterFactory } from './adapters/adapter.factory.js';

@Module({
  imports: [
    CrisisModule,
    forwardRef(() => SlaModule),
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [
    MessageController,
    MessageReadController,
    CaseChannelController,
    TelegramWebhookController,
  ],
  providers: [
    MessageService,
    ChatGateway,
    TelegramService,
    WebAdapter,
    TelegramAdapter,
    GenericAdapter,
    AdapterFactory,
  ],
  exports: [MessageService, AdapterFactory],
})
export class ChatModule {}
