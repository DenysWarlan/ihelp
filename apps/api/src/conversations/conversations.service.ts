import {
  BadRequestException,
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { ConversationKind, Prisma, Role } from '@prisma/client';

import {
  DEFAULT_CONVERSATION_PAGE_SIZE,
  MAX_CONVERSATION_PAGE_SIZE,
  STAFF_ROLES,
} from './conversations.const.js';
import {
  ContactResponse,
  ConversationMessageResponse,
  ConversationResponse,
  CreateConversationDto,
} from './conversations.model.js';

/** Prisma include to join member + sender user details. */
const CONVERSATION_INCLUDE = {
  members: { include: { user: { select: { name: true, role: true } } } },
} as const;

type ConversationWithMembers = Prisma.ConversationGetPayload<{
  include: typeof CONVERSATION_INCLUDE;
}>;

@Injectable()
export class ConversationsService {
  private readonly logger = new Logger(ConversationsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(
    dto: CreateConversationDto,
    creatorId: string,
  ): Promise<ConversationResponse> {
    // De-duplicate and drop the creator from the participant list.
    const otherIds = [...new Set(dto.participantIds)].filter(
      (id: string) => id !== creatorId,
    );

    if (otherIds.length === 0) {
      throw new BadRequestException('At least one other participant is required');
    }

    // Validate all participants exist and are active.
    const users = await this.prisma.user.findMany({
      where: { id: { in: otherIds }, isActive: true },
      select: { id: true, role: true },
    });

    if (users.length !== otherIds.length) {
      throw new BadRequestException('One or more participants are invalid or inactive');
    }

    const kind = this.resolveKind(otherIds.length, users.map((u) => u.role));

    // For 1:1 conversations, reuse an existing one between the same two users.
    if (otherIds.length === 1) {
      const existing = await this.findDirectBetween(creatorId, otherIds[0]);
      if (existing) {
        return this.formatConversation(existing, creatorId);
      }
    }

    const memberIds = [creatorId, ...otherIds];
    const conversation = await this.prisma.conversation.create({
      data: {
        kind,
        title: dto.title?.trim() || null,
        createdById: creatorId,
        members: {
          create: memberIds.map((userId: string) => ({ userId })),
        },
      },
      include: CONVERSATION_INCLUDE,
    });

    this.logger.log(
      `Conversation ${conversation.id} (${kind}) created by ${creatorId}`,
    );

    return this.formatConversation(conversation, creatorId);
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findMine(userId: string): Promise<ConversationResponse[]> {
    const conversations = await this.prisma.conversation.findMany({
      where: { members: { some: { userId } } },
      include: CONVERSATION_INCLUDE,
      orderBy: [{ lastMessageAt: 'desc' }, { createdAt: 'desc' }],
    });

    return Promise.all(
      conversations.map((c) => this.formatConversation(c, userId)),
    );
  }

  async getMessages(
    conversationId: string,
    userId: string,
    limit?: number,
  ): Promise<ConversationMessageResponse[]> {
    await this.requireMembership(conversationId, userId);

    const take = Math.min(
      Math.max(limit ?? DEFAULT_CONVERSATION_PAGE_SIZE, 1),
      MAX_CONVERSATION_PAGE_SIZE,
    );

    // Fetch the most recent `take` messages, then return chronological order.
    const messages = await this.prisma.conversationMessage.findMany({
      where: { conversationId },
      include: { sender: { select: { name: true } } },
      orderBy: { createdAt: 'desc' },
      take,
    });

    return messages
      .reverse()
      .map((m) => this.formatMessage(m.id, conversationId, m.senderId, m.sender.name, m.content, m.isDeleted, m.createdAt));
  }

  // ---------------------------------------------------------------------------
  // Write
  // ---------------------------------------------------------------------------

  async postMessage(
    conversationId: string,
    userId: string,
    content: string,
  ): Promise<ConversationMessageResponse> {
    await this.requireMembership(conversationId, userId);

    const message = await this.prisma.conversationMessage.create({
      data: { conversationId, senderId: userId, content },
      include: { sender: { select: { name: true } } },
    });

    // Bump conversation activity and mark the sender as caught up.
    await this.prisma.$transaction([
      this.prisma.conversation.update({
        where: { id: conversationId },
        data: { lastMessageAt: message.createdAt },
      }),
      this.prisma.conversationMember.update({
        where: { conversationId_userId: { conversationId, userId } },
        data: { lastReadAt: message.createdAt },
      }),
    ]);

    return this.formatMessage(
      message.id,
      conversationId,
      userId,
      message.sender.name,
      message.content,
      message.isDeleted,
      message.createdAt,
    );
  }

  async markRead(conversationId: string, userId: string): Promise<void> {
    await this.requireMembership(conversationId, userId);
    await this.prisma.conversationMember.update({
      where: { conversationId_userId: { conversationId, userId } },
      data: { lastReadAt: new Date() },
    });
  }

  /** Returns user IDs of all members of a conversation (for realtime fan-out). */
  async listMemberIds(conversationId: string): Promise<string[]> {
    const members = await this.prisma.conversationMember.findMany({
      where: { conversationId },
      select: { userId: true },
    });
    return members.map((m) => m.userId);
  }

  // ---------------------------------------------------------------------------
  // Contacts — any active user except the requester (staff can message anyone)
  // ---------------------------------------------------------------------------

  async listContacts(excludeUserId: string): Promise<ContactResponse[]> {
    const users = await this.prisma.user.findMany({
      where: { isActive: true, id: { not: excludeUserId } },
      select: { id: true, name: true, role: true },
      orderBy: { name: 'asc' },
    });
    return users.map((u) => ({ id: u.id, name: u.name, role: u.role }));
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  /** Ensures the user is a member of the conversation; throws otherwise. */
  async requireMembership(conversationId: string, userId: string): Promise<void> {
    const member = await this.prisma.conversationMember.findUnique({
      where: { conversationId_userId: { conversationId, userId } },
    });
    if (!member) {
      // Distinguish missing conversation from forbidden access.
      const exists = await this.prisma.conversation.findUnique({
        where: { id: conversationId },
        select: { id: true },
      });
      if (!exists) {
        throw new NotFoundException('Conversation not found');
      }
      throw new ForbiddenException('You are not a member of this conversation');
    }
  }

  private resolveKind(otherCount: number, otherRoles: Role[]): ConversationKind {
    if (otherCount > 1) {
      return ConversationKind.STAFF_GROUP;
    }
    return otherRoles[0] === Role.PERSON
      ? ConversationKind.SUPERVISOR_CLIENT
      : ConversationKind.STAFF_DIRECT;
  }

  private async findDirectBetween(
    userA: string,
    userB: string,
  ): Promise<ConversationWithMembers | null> {
    return this.prisma.conversation.findFirst({
      where: {
        kind: {
          in: [ConversationKind.STAFF_DIRECT, ConversationKind.SUPERVISOR_CLIENT],
        },
        members: { every: { userId: { in: [userA, userB] } } },
        AND: [
          { members: { some: { userId: userA } } },
          { members: { some: { userId: userB } } },
        ],
      },
      include: CONVERSATION_INCLUDE,
    });
  }

  private async formatConversation(
    conversation: ConversationWithMembers,
    requestingUserId: string,
  ): Promise<ConversationResponse> {
    const myMember = conversation.members.find(
      (m) => m.userId === requestingUserId,
    );

    const lastReadAt = myMember?.lastReadAt ?? null;

    const unreadCount = await this.prisma.conversationMessage.count({
      where: {
        conversationId: conversation.id,
        senderId: { not: requestingUserId },
        isDeleted: false,
        ...(lastReadAt ? { createdAt: { gt: lastReadAt } } : {}),
      },
    });

    const lastMessage = await this.prisma.conversationMessage.findFirst({
      where: { conversationId: conversation.id, isDeleted: false },
      orderBy: { createdAt: 'desc' },
      select: { content: true },
    });

    return {
      id: conversation.id,
      kind: conversation.kind,
      title: conversation.title,
      createdById: conversation.createdById,
      members: conversation.members.map((m) => ({
        id: m.id,
        userId: m.userId,
        name: m.user.name,
        role: m.user.role,
      })),
      lastMessage: lastMessage?.content ?? null,
      lastMessageAt: conversation.lastMessageAt,
      unreadCount,
      createdAt: conversation.createdAt,
    };
  }

  private formatMessage(
    id: string,
    conversationId: string,
    senderId: string,
    senderName: string,
    content: string,
    isDeleted: boolean,
    createdAt: Date,
  ): ConversationMessageResponse {
    return {
      id,
      conversationId,
      senderId,
      senderName,
      content: isDeleted ? '' : content,
      isDeleted,
      createdAt,
    };
  }
}
