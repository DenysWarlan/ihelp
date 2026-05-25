import { Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtModule } from '@nestjs/jwt';

import { MessageService } from './message.service.js';
import { MessageController, MessageReadController } from './message.controller.js';
import { ChatGateway } from './chat.gateway.js';

@Module({
  imports: [
    JwtModule.registerAsync({
      inject: [ConfigService],
      useFactory: (config: ConfigService) => ({
        secret: config.getOrThrow<string>('JWT_SECRET'),
      }),
    }),
  ],
  controllers: [MessageController, MessageReadController],
  providers: [MessageService, ChatGateway],
  exports: [MessageService],
})
export class ChatModule {}
