import {
  Injectable,
  Logger,
  OnModuleInit,
  UnauthorizedException,
} from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '@org/prisma-client';
import * as bcrypt from 'bcrypt';

import { JWT_ACCESS_EXPIRY, JWT_REFRESH_EXPIRY } from '../auth.const.js';
import { JwtPayload, TokenPair } from '../auth.model.js';
import { AuditService } from '../../common/audit/audit.service.js';

import {
  BREAK_GLASS_EMAIL,
  BREAK_GLASS_INIT_ACTION,
  BREAK_GLASS_LOGIN_ACTION,
} from './break-glass.const.js';

/** Bcrypt rounds for break-glass password. */
const BREAK_GLASS_HASH_ROUNDS = 12;

@Injectable()
export class BreakGlassService implements OnModuleInit {
  private readonly logger = new Logger(BreakGlassService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly jwt: JwtService,
    private readonly config: ConfigService,
    private readonly audit: AuditService,
  ) {}

  /**
   * On application startup, ensure the break-glass account exists.
   * Password comes from BREAK_GLASS_PASSWORD env var.
   * If not set, the break-glass account is not created (dev environments).
   */
  async onModuleInit(): Promise<void> {
    await this.ensureBreakGlassExists();
  }

  async ensureBreakGlassExists(): Promise<void> {
    const password = this.config.get<string>('BREAK_GLASS_PASSWORD');

    if (!password) {
      this.logger.warn(
        'BREAK_GLASS_PASSWORD not set — break-glass account will not be available',
      );
      return;
    }

    const existing = await this.prisma.user.findUnique({
      where: { email: BREAK_GLASS_EMAIL },
    });

    if (existing) {
      this.logger.log('Break-glass account already exists');
      return;
    }

    const passwordHash = await bcrypt.hash(password, BREAK_GLASS_HASH_ROUNDS);

    await this.prisma.user.create({
      data: {
        email: BREAK_GLASS_EMAIL,
        name: 'Break Glass Admin',
        role: 'ADMIN',
        isBreakGlass: true,
        passwordHash,
      },
    });

    await this.audit.log(
      BREAK_GLASS_INIT_ACTION,
      undefined,
      'Break-glass account created on startup',
    );

    this.logger.warn('Break-glass emergency admin account created');
  }

  /**
   * Authenticate with the break-glass account.
   * Every attempt (success or failure) is logged as a critical audit event.
   */
  async loginBreakGlass(
    password: string,
    ipAddress: string,
  ): Promise<TokenPair> {
    const user = await this.prisma.user.findUnique({
      where: { email: BREAK_GLASS_EMAIL },
    });

    if (!user || !user.isBreakGlass || !user.passwordHash) {
      await this.audit.log(
        BREAK_GLASS_LOGIN_ACTION,
        undefined,
        'Break-glass login attempt — account not found',
        ipAddress,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    const isValid = await bcrypt.compare(password, user.passwordHash);

    if (!isValid) {
      await this.audit.log(
        BREAK_GLASS_LOGIN_ACTION,
        user.id,
        'Break-glass login FAILED — invalid password',
        ipAddress,
      );
      throw new UnauthorizedException('Invalid credentials');
    }

    // Log successful break-glass login as critical event
    await this.audit.log(
      BREAK_GLASS_LOGIN_ACTION,
      user.id,
      'Break-glass login SUCCESSFUL — emergency access granted',
      ipAddress,
    );

    this.logger.warn(
      `CRITICAL: Break-glass login from IP ${ipAddress}`,
    );

    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      role: user.role,
    };

    const accessToken = this.jwt.sign(payload, {
      expiresIn: JWT_ACCESS_EXPIRY,
    });
    const refreshToken = this.jwt.sign(payload, {
      expiresIn: JWT_REFRESH_EXPIRY,
    });

    // Store session
    const expiresAt = new Date();
    expiresAt.setDate(expiresAt.getDate() + 7);

    await this.prisma.session.create({
      data: {
        userId: user.id,
        token: refreshToken,
        expiresAt,
      },
    });

    return { accessToken, refreshToken };
  }
}
