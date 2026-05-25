import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
  OnGatewayDisconnect,
  OnGatewayInit,
  SubscribeMessage,
  WebSocketGateway,
  WebSocketServer,
} from '@nestjs/websockets';
import { Logger, UnauthorizedException } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { ConfigService } from '@nestjs/config';
import { Server, Socket } from 'socket.io';
import { Redis } from 'ioredis';
import { createAdapter } from '@socket.io/redis-adapter';
import { MessageChannel } from '@prisma/client';

import { JwtPayload } from '../auth/auth.model.js';
import { CASE_ROOM_PREFIX, CHAT_EVENTS } from './chat.const.js';
import {
  ChatJoinPayload,
  ChatMessagePayload,
  ChatReadPayload,
  ChatTypingPayload,
  SocketUser,
} from './chat.model.js';
import { MessageService } from './message.service.js';

@WebSocketGateway({
  namespace: '/chat',
  cors: { origin: '*', credentials: true },
})
export class ChatGateway
  implements OnGatewayInit, OnGatewayConnection, OnGatewayDisconnect
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ChatGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly messageService: MessageService,
  ) {}

  // ---------------------------------------------------------------------------
  // Lifecycle
  // ---------------------------------------------------------------------------

  async afterInit(server: Server): Promise<void> {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      if (redisUrl) {
        const pubClient = new Redis(redisUrl);
        const subClient = pubClient.duplicate();
        server.adapter(createAdapter(pubClient, subClient));
        this.logger.log('Redis adapter attached for Socket.io');
      }
    } catch (error) {
      this.logger.warn(
        'Failed to attach Redis adapter; falling back to in-memory adapter',
        error instanceof Error ? error.message : String(error),
      );
    }
  }

  async handleConnection(client: Socket): Promise<void> {
    try {
      const user = this.authenticateClient(client);
      (client as Socket & { user: SocketUser }).user = user;
      this.logger.log(`Client connected: ${client.id} (user: ${user.sub})`);
    } catch {
      this.logger.warn(`Unauthorized connection attempt: ${client.id}`);
      client.emit(CHAT_EVENTS.ERROR, { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  handleDisconnect(client: Socket): void {
    this.logger.log(`Client disconnected: ${client.id}`);
  }

  // ---------------------------------------------------------------------------
  // Events
  // ---------------------------------------------------------------------------

  @SubscribeMessage(CHAT_EVENTS.JOIN)
  async handleJoin(
    @ConnectedSocket() client: Socket & { user: SocketUser },
    @MessageBody() payload: ChatJoinPayload,
  ): Promise<void> {
    try {
      const actor = this.toJwtPayload(client.user);
      await this.messageService.validateCaseAccess(payload.caseId, actor);

      const room = `${CASE_ROOM_PREFIX}${payload.caseId}`;
      await client.join(room);
      this.logger.log(
        `User ${client.user.sub} joined room ${room}`,
      );
    } catch (error) {
      client.emit(CHAT_EVENTS.ERROR, {
        event: CHAT_EVENTS.JOIN,
        message:
          error instanceof Error ? error.message : 'Failed to join room',
      });
    }
  }

  @SubscribeMessage(CHAT_EVENTS.MESSAGE)
  async handleMessage(
    @ConnectedSocket() client: Socket & { user: SocketUser },
    @MessageBody() payload: ChatMessagePayload,
  ): Promise<void> {
    try {
      const actor = this.toJwtPayload(client.user);
      const message = await this.messageService.create(
        payload.caseId,
        {
          content: payload.content,
          channel: payload.channel ?? MessageChannel.WEB,
          attachments: payload.attachments,
        },
        actor,
      );

      const room = `${CASE_ROOM_PREFIX}${payload.caseId}`;
      this.server.to(room).emit(CHAT_EVENTS.NEW_MESSAGE, message);
    } catch (error) {
      client.emit(CHAT_EVENTS.ERROR, {
        event: CHAT_EVENTS.MESSAGE,
        message:
          error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  }

  @SubscribeMessage(CHAT_EVENTS.TYPING)
  async handleTyping(
    @ConnectedSocket() client: Socket & { user: SocketUser },
    @MessageBody() payload: ChatTypingPayload,
  ): Promise<void> {
    const room = `${CASE_ROOM_PREFIX}${payload.caseId}`;
    client.to(room).emit(CHAT_EVENTS.TYPING, {
      userId: client.user.sub,
      isTyping: payload.isTyping,
    });
  }

  @SubscribeMessage(CHAT_EVENTS.READ)
  async handleRead(
    @ConnectedSocket() client: Socket & { user: SocketUser },
    @MessageBody() payload: ChatReadPayload,
  ): Promise<void> {
    try {
      const actor = this.toJwtPayload(client.user);
      const count = await this.messageService.markManyAsRead(
        payload.messageIds,
        actor,
      );

      // Broadcast read receipts to all rooms the client is in
      for (const room of client.rooms) {
        if (room.startsWith(CASE_ROOM_PREFIX)) {
          this.server.to(room).emit(CHAT_EVENTS.MESSAGES_READ, {
            messageIds: payload.messageIds,
            readBy: client.user.sub,
            count,
          });
        }
      }
    } catch (error) {
      client.emit(CHAT_EVENTS.ERROR, {
        event: CHAT_EVENTS.READ,
        message:
          error instanceof Error
            ? error.message
            : 'Failed to mark as read',
      });
    }
  }

  // ---------------------------------------------------------------------------
  // Auth helpers
  // ---------------------------------------------------------------------------

  private authenticateClient(client: Socket): SocketUser {
    const token =
      client.handshake.auth?.token ??
      this.extractBearerToken(client.handshake.headers.authorization);

    if (!token) {
      throw new UnauthorizedException('No token provided');
    }

    const jwtSecret = this.configService.getOrThrow<string>('JWT_SECRET');

    try {
      const payload = this.jwtService.verify<JwtPayload>(token, {
        secret: jwtSecret,
      });
      return { sub: payload.sub, email: payload.email, role: payload.role };
    } catch {
      throw new UnauthorizedException('Invalid token');
    }
  }

  private extractBearerToken(header?: string): string | undefined {
    if (!header) return undefined;
    const [scheme, token] = header.split(' ');
    return scheme === 'Bearer' ? token : undefined;
  }

  private toJwtPayload(user: SocketUser): JwtPayload {
    return { sub: user.sub, email: user.email, role: user.role };
  }
}
