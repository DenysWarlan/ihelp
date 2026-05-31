import * as crypto from 'node:crypto';

import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import * as bcrypt from 'bcrypt';
import { Invite, User } from '@prisma/client';

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

    this.mail
      .sendInvite(dto.email, dto.role, token, expiresAt)
      .catch((err) =>
        this.logger.error(`Failed to send invite email to ${dto.email}: ${err.message}`),
      );

    return invite;
  }

  /**
   * Claim an invite: validate token, create user with hashed password atomically.
   * Uses Prisma interactive transaction to prevent race conditions.
   */
  async claimInvite(dto: ClaimInviteDto): Promise<User> {
    const invite = await this.prisma.invite.findUnique({
      where: { token: dto.token },
    });

    if (!invite) {
      throw new NotFoundException('Invite not found or invalid token');
    }

    if (invite.claimedAt) {
      throw new ConflictException('Invite has already been claimed');
    }

    if (new Date() > invite.expiresAt) {
      throw new NotFoundException('Invite has expired');
    }

    const passwordHash = await bcrypt.hash(dto.password, BCRYPT_SALT_ROUNDS);

    const user = await this.prisma.$transaction(async (tx) => {
      // Mark invite as claimed
      await tx.invite.update({
        where: { id: invite.id },
        data: { claimedAt: new Date() },
      });

      // Create the staff user
      return tx.user.create({
        data: {
          email: invite.email,
          name: dto.name,
          role: invite.role,
          passwordHash,
        },
      });
    });

    this.logger.log(
      `Invite claimed: user ${user.id} created for ${invite.email}`,
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
