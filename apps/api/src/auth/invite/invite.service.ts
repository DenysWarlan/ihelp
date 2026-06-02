import * as crypto from 'node:crypto';

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import * as bcrypt from 'bcrypt';
import { Invite, Role, User } from '@prisma/client';

import { MailService } from '../../common/mail/mail.service.js';
import { BCRYPT_SALT_ROUNDS, INVITE_EXPIRY_HOURS } from './invite.const.js';
import { ClaimInviteDto, CreateInviteDto } from './invite.model.js';

@Injectable()
export class InviteService {
  private readonly logger = new Logger(InviteService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mail: MailService,
  ) {}

  /**
   * Create a new invite for a staff member.
   * Generates a cryptographically secure token and sets expiry.
   */
  async createInvite(inviterId: string, dto: CreateInviteDto): Promise<Invite> {
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
      `Invite created for ${dto.email} by ${inviterId}, expires ${expiresAt.toISOString()}`,
    );

    return invite;
  }

  /**
   * Claim an invite: validate token, create user with hashed password atomically.
   * Uses Prisma interactive transaction with row-level locking to prevent race conditions.
   */
  async claimInvite(dto: ClaimInviteDto): Promise<User> {
    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      // Lock the invite row to prevent concurrent claims
      const [invite] = await tx.$queryRaw<Array<{
        id: string;
        email: string;
        role: string;
        claimed_at: Date | null;
        expires_at: Date;
      }>>`
        SELECT id, email, role, claimed_at, expires_at
        FROM invites
        WHERE token = ${dto.token}
        FOR UPDATE
      `;

      if (!invite) {
        throw new NotFoundException('Invite not found or invalid token');
      }

      if (invite.claimed_at) {
        throw new ConflictException('Invite has already been claimed');
      }

      if (new Date() > invite.expires_at) {
        throw new NotFoundException('Invite has expired');
      }

      // Mark invite as claimed
      await tx.invite.update({
        where: { id: invite.id },
        data: { claimedAt: new Date() },
      });

      // Validate role from raw query against Prisma enum
      const validRoles: string[] = Object.values(Role);
      if (!validRoles.includes(invite.role)) {
        throw new BadRequestException(`Invalid role in invite: ${invite.role}`);
      }

      // Create the staff user
      return tx.user.create({
        data: {
          email: invite.email,
          name: dto.name,
          role: invite.role as Role,
          passwordHash,
        },
      });
    });

    this.logger.log(
      `Invite claimed: user ${user.id} created for ${dto.token.substring(0, 8)}...`,
    );
    return user;
  }

  /**
   * Resend an invite by creating a new invite for the same email/role.
   * The old invite is left as-is (still valid until expiry or claim).
   */
  async resendInvite(inviteId: string, inviterId: string): Promise<Invite> {
    const existing = await this.prisma.invite.findUnique({
      where: { id: inviteId },
    });

    if (!existing) {
      throw new NotFoundException('Original invite not found');
    }

    return this.createInvite(inviterId, {
      email: existing.email,
      role: existing.role,
    });
  }
}
