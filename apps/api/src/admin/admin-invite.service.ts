import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import * as crypto from 'node:crypto';

import { MailService } from '../common/mail/mail.service.js';
import { INVITE_EXPIRY_HOURS } from '../auth/invite/invite.const.js';
import { DEFAULT_PAGE_SIZE } from './admin.const.js';
import {
  CreateAdminInviteDto,
  InviteResponse,
  ListInvitesDto,
  PaginatedInvitesResponse,
} from './admin.model.js';

@Injectable()
export class AdminInviteService {
  private readonly logger = new Logger(AdminInviteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  // ---------------------------------------------------------------------------
  // Create invite
  // ---------------------------------------------------------------------------

  async createInvite(
    inviterId: string,
    dto: CreateAdminInviteDto,
  ): Promise<InviteResponse> {
    // Check for existing unclaimed, non-expired invite for same email
    const existing = await this.prisma.invite.findFirst({
      where: {
        email: dto.email,
        claimedAt: null,
        expiresAt: { gt: new Date() },
      },
    });

    if (existing) {
      throw new ConflictException(
        `An active invite already exists for ${dto.email}`,
      );
    }

    const token = crypto.randomBytes(32).toString('hex');
    const expiresAt = new Date();
    expiresAt.setHours(expiresAt.getHours() + INVITE_EXPIRY_HOURS);

    // Send email first — only create DB record if email succeeds
    await this.mail.sendInvite(dto.email, dto.role, token, expiresAt);

    const invite = await this.prisma.invite.create({
      data: {
        email: dto.email,
        role: dto.role,
        token,
        inviterId,
        expiresAt,
      },
    });

    this.logger.log(
      `Invite created for ${dto.email} by admin ${inviterId}, expires ${expiresAt.toISOString()}`,
    );

    return this.toInviteResponse(invite);
  }

  // ---------------------------------------------------------------------------
  // List invites with status filter and pagination
  // ---------------------------------------------------------------------------

  async listInvites(
    query: ListInvitesDto,
  ): Promise<PaginatedInvitesResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * pageSize;
    const now = new Date();

    // Build where clause based on status filter
    let where = {};
    if (query.status === 'claimed') {
      where = { claimedAt: { not: null } };
    } else if (query.status === 'expired') {
      where = { claimedAt: null, expiresAt: { lte: now } };
    } else if (query.status === 'pending') {
      where = { claimedAt: null, expiresAt: { gt: now } };
    }

    const [invites, total] = await this.prisma.$transaction([
      this.prisma.invite.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
      }),
      this.prisma.invite.count({ where }),
    ]);

    return {
      data: invites.map((inv) => this.toInviteResponse(inv)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ---------------------------------------------------------------------------
  // Revoke invite
  // ---------------------------------------------------------------------------

  async revokeInvite(inviteId: string): Promise<void> {
    const invite = await this.prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found');
    }

    if (invite.claimedAt) {
      throw new ConflictException('Cannot revoke an already claimed invite');
    }

    // Revoke by setting expiry to now (soft revoke)
    await this.prisma.invite.update({
      where: { id: inviteId },
      data: { expiresAt: new Date() },
    });

    this.logger.log(`Invite ${inviteId} revoked`);
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toInviteResponse(invite: {
    id: string;
    email: string;
    role: string;
    createdAt: Date;
    expiresAt: Date;
    claimedAt: Date | null;
  }): InviteResponse {
    const now = new Date();
    let status: 'pending' | 'claimed' | 'expired';

    if (invite.claimedAt) {
      status = 'claimed';
    } else if (invite.expiresAt <= now) {
      status = 'expired';
    } else {
      status = 'pending';
    }

    return {
      id: invite.id,
      email: invite.email,
      role: invite.role,
      status,
      createdAt: invite.createdAt,
      expiresAt: invite.expiresAt,
      claimedAt: invite.claimedAt,
    };
  }
}
