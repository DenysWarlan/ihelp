import {
  ConnectedSocket,
  MessageBody,
  OnGatewayConnection,
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

import { JwtPayload } from '../auth/auth.model.js';

import {
  CONVERSATION_EVENTS,
  CONVERSATION_ROOM_PREFIX,
} from './conversations.const.js';
import { ConversationMessageResponse } from './conversations.model.js';
import { ConversationsService } from './conversations.service.js';

interface SocketUser {
  readonly sub: string;
  readonly email: string;
  readonly role: string;
}

interface JoinPayload {
  readonly conversationId: string;
}

interface MessagePayload {
  readonly conversationId: string;
  readonly content: string;
}

interface TypingPayload {
  readonly conversationId: string;
  readonly isTyping: boolean;
}

interface ReadPayload {
  readonly conversationId: string;
}

@WebSocketGateway({
  namespace: '/conversations',
  cors: { origin: '*', credentials: true },
})
export class ConversationsGateway
  implements OnGatewayInit, OnGatewayConnection
{
  @WebSocketServer()
  server!: Server;

  private readonly logger = new Logger(ConversationsGateway.name);

  constructor(
    private readonly jwtService: JwtService,
    private readonly configService: ConfigService,
    private readonly conversationsService: ConversationsService,
  ) {}

  async afterInit(server: Server): Promise<void> {
    try {
      const redisUrl = this.configService.get<string>('REDIS_URL');
      if (redisUrl) {
        const pubClient = new Redis(redisUrl);
        const subClient = pubClient.duplicate();
        server.adapter(createAdapter(pubClient, subClient));
        this.logger.log('Redis adapter attached for conversations namespace');
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
      await client.join(`user:${user.sub}`);
      this.logger.log(`Client connected: ${client.id} (user: ${user.sub})`);
    } catch {
      client.emit(CONVERSATION_EVENTS.ERROR, { message: 'Authentication failed' });
      client.disconnect(true);
    }
  }

  @SubscribeMessage(CONVERSATION_EVENTS.JOIN)
  async handleJoin(
    @ConnectedSocket() client: Socket & { user: SocketUser },
    @MessageBody() payload: JoinPayload,
  ): Promise<void> {
    try {
      await this.conversationsService.requireMembership(
        payload.conversationId,
        client.user.sub,
      );
      await client.join(`${CONVERSATION_ROOM_PREFIX}${payload.conversationId}`);
    } catch (error) {
      client.emit(CONVERSATION_EVENTS.ERROR, {
        event: CONVERSATION_EVENTS.JOIN,
        message: error instanceof Error ? error.message : 'Failed to join',
      });
    }
  }

  @SubscribeMessage(CONVERSATION_EVENTS.MESSAGE)
  async handleMessage(
    @ConnectedSocket() client: Socket & { user: SocketUser },
    @MessageBody() payload: MessagePayload,
  ): Promise<void> {
    try {
      const message = await this.conversationsService.postMessage(
        payload.conversationId,
        client.user.sub,
        payload.content,
      );
      await this.broadcastNewMessage(payload.conversationId, message);
    } catch (error) {
      client.emit(CONVERSATION_EVENTS.ERROR, {
        event: CONVERSATION_EVENTS.MESSAGE,
        message: error instanceof Error ? error.message : 'Failed to send message',
      });
    }
  }

  @SubscribeMessage(CONVERSATION_EVENTS.TYPING)
  handleTyping(
    @ConnectedSocket() client: Socket & { user: SocketUser },
    @MessageBody() payload: TypingPayload,
  ): void {
    const room = `${CONVERSATION_ROOM_PREFIX}${payload.conversationId}`;
    client.to(room).emit(CONVERSATION_EVENTS.TYPING, {
      conversationId: payload.conversationId,
      userId: client.user.sub,
      isTyping: payload.isTyping,
    });
  }

  @SubscribeMessage(CONVERSATION_EVENTS.READ)
  async handleRead(
    @ConnectedSocket() client: Socket & { user: SocketUser },
    @MessageBody() payload: ReadPayload,
  ): Promise<void> {
    try {
      await this.conversationsService.markRead(
        payload.conversationId,
        client.user.sub,
      );
    } catch (error) {
      client.emit(CONVERSATION_EVENTS.ERROR, {
        event: CONVERSATION_EVENTS.READ,
        message: error instanceof Error ? error.message : 'Failed to mark as read',
      });
    }
  }

  /**
   * Broadcasts a new message to the conversation room and notifies members
   * for unread badge updates. Called from both the socket and REST paths.
   */
  async broadcastNewMessage(
    conversationId: string,
    message: ConversationMessageResponse,
  ): Promise<void> {
    const room = `${CONVERSATION_ROOM_PREFIX}${conversationId}`;
    this.server.to(room).emit(CONVERSATION_EVENTS.NEW_MESSAGE, message);

    const memberIds = await this.conversationsService.listMemberIds(conversationId);
    for (const userId of memberIds) {
      if (userId === message.senderId) continue;
      this.server.to(`user:${userId}`).emit(CONVERSATION_EVENTS.NOTIFY, {
        conversationId,
        senderName: message.senderName,
        preview: message.content.slice(0, 120),
      });
    }
  }

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
}
