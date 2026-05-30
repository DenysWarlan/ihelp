import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { CaseStatus, Prisma, Role, SlaStatus } from '@prisma/client';

import { AuditService } from '../common/audit/audit.service.js';
import {
  AUDIT_ACTIONS,
  DEFAULT_PAGE_SIZE,
  DUPLICATE_EXACT_EMAIL_REASON,
  DUPLICATE_NAME_REASON,
  ERROR_CONSULTANT_ACTIVE_CASES,
  ERROR_LAST_ADMIN,
  ERROR_SELF_ROLE_CHANGE,
} from './admin.const.js';
import {
  CreateStaffUserDto,
  DuplicateAccountEntry,
  DuplicateAccountsResponse,
  ListStaffUsersDto,
  PaginatedStaffUsersResponse,
  StaffUserResponse,
  UpdateStaffUserDto,
} from './admin.model.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly auditService: AuditService,
  ) {}

  // ---------------------------------------------------------------------------
  // Dashboard — aggregated stats, alerts, recent audit
  // ---------------------------------------------------------------------------

  async getDashboardData() {
    const [
      totalUsers,
      usersByRole,
      activeCases,
      pendingInvites,
      slaBreaches,
      crisisAlerts,
      recentAudit,
    ] = await this.prisma.$transaction([
      this.prisma.user.count({ where: { isActive: true } }),
      this.prisma.user.groupBy({
        by: ['role'],
        where: { isActive: true },
        _count: { id: true },
      }),
      this.prisma.careCase.count({
        where: {
          status: {
            in: [
              CaseStatus.NEW,
              CaseStatus.ASSIGNED,
              CaseStatus.IN_PROGRESS,
              CaseStatus.ON_HOLD,
              CaseStatus.MEETING_SCHEDULED,
            ],
          },
        },
      }),
      this.prisma.invite.count({
        where: { claimedAt: null, expiresAt: { gt: new Date() } },
      }),
      this.prisma.slaTimer.count({
        where: { status: SlaStatus.ESCALATED },
      }),
      this.prisma.crisisAlert.count({
        where: { acknowledgedAt: null },
      }),
      this.prisma.auditLog.findMany({
        orderBy: { createdAt: 'desc' },
        take: 8,
        select: {
          id: true,
          action: true,
          userId: true,
          details: true,
          createdAt: true,
        },
      }),
    ]);

    // Duplicate suspects: count via raw SQL (not in transaction)
    const duplicateRows = await this.prisma.$queryRaw<{ cnt: bigint }[]>`
      SELECT COUNT(DISTINCT u1.id) AS cnt
      FROM users u1
      INNER JOIN users u2
        ON u1.id != u2.id
        AND u1.is_active = true AND u2.is_active = true
        AND LOWER(TRIM(u1.name)) = LOWER(TRIM(u2.name))
        AND LENGTH(TRIM(u1.name)) > 0
    `.catch(() => [{ cnt: BigInt(0) }]);
    const duplicateSuspects = Number(duplicateRows[0]?.cnt ?? 0);

    const roleMap: Record<string, number> = {};
    for (const entry of usersByRole) {
      roleMap[entry.role.toLowerCase()] = entry._count.id;
    }

    // Resolve performer names for audit entries
    const userIds = recentAudit
      .map((a) => a.userId)
      .filter((id): id is string => id !== null);
    const uniqueIds = [...new Set(userIds)];

    const performers =
      uniqueIds.length > 0
        ? await this.prisma.user.findMany({
            where: { id: { in: uniqueIds } },
            select: { id: true, name: true },
          })
        : [];

    const performerMap = new Map(performers.map((p) => [p.id, p.name]));

    return {
      stats: {
        totalUsers,
        usersByRole: roleMap,
        activeCases,
        pendingInvites,
        slaBreaches,
      },
      alerts: {
        crisisAlerts,
        duplicateSuspects: duplicateSuspects as number,
      },
      recentAudit: recentAudit.map((a) => ({
        id: a.id,
        action: a.action,
        performedByName: a.userId ? performerMap.get(a.userId) ?? 'System' : 'System',
        createdAt: a.createdAt,
      })),
    };
  }

  // ---------------------------------------------------------------------------
  // List staff users with filters and pagination
  // ---------------------------------------------------------------------------

  async listUsers(
    query: ListStaffUsersDto,
  ): Promise<PaginatedStaffUsersResponse> {
    const page = query.page ?? 1;
    const pageSize = query.pageSize ?? DEFAULT_PAGE_SIZE;
    const skip = (page - 1) * pageSize;

    const where: Prisma.UserWhereInput = {};

    if (query.role) {
      where.role = query.role;
    }

    if (query.isActive !== undefined) {
      where.isActive = query.isActive;
    }

    if (query.search) {
      where.OR = [
        { name: { contains: query.search, mode: 'insensitive' } },
        { email: { contains: query.search, mode: 'insensitive' } },
      ];
    }

    const [users, total] = await this.prisma.$transaction([
      this.prisma.user.findMany({
        where,
        skip,
        take: pageSize,
        orderBy: { createdAt: 'desc' },
        select: {
          id: true,
          email: true,
          name: true,
          role: true,
          isActive: true,
          createdAt: true,
          updatedAt: true,
        },
      }),
      this.prisma.user.count({ where }),
    ]);

    return {
      data: users.map((u) => this.toStaffResponse(u)),
      total,
      page,
      pageSize,
      totalPages: Math.ceil(total / pageSize),
    };
  }

  // ---------------------------------------------------------------------------
  // Create staff user
  // ---------------------------------------------------------------------------

  async createUser(dto: CreateStaffUserDto): Promise<StaffUserResponse> {
    const existing = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existing) {
      throw new ConflictException(
        `User with email ${dto.email} already exists`,
      );
    }

    const user = await this.prisma.user.create({
      data: {
        email: dto.email,
        name: dto.name,
        role: dto.role,
      },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log(
      AUDIT_ACTIONS.USER_CREATED,
      undefined,
      JSON.stringify({
        userId: user.id,
        email: dto.email,
        role: dto.role,
      }),
    );

    this.logger.log(
      `Staff user created: ${user.id} (${dto.email}, role: ${dto.role})`,
    );
    return this.toStaffResponse(user);
  }

  // ---------------------------------------------------------------------------
  // Get staff user by ID
  // ---------------------------------------------------------------------------

  async getUser(userId: string): Promise<StaffUserResponse> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    return this.toStaffResponse(user);
  }

  // ---------------------------------------------------------------------------
  // Update staff user
  // ---------------------------------------------------------------------------

  async updateUser(
    userId: string,
    dto: UpdateStaffUserDto,
    actorId: string,
  ): Promise<StaffUserResponse> {
    // S-E13-03: Block self-role-change
    if (userId === actorId && dto.role !== undefined) {
      throw new BadRequestException(ERROR_SELF_ROLE_CHANGE);
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    // S-E13-03: Last admin protection — role change or deactivation
    const isRemovingAdmin =
      existing.role === Role.ADMIN &&
      ((dto.role !== undefined && dto.role !== Role.ADMIN) ||
        (dto.isActive !== undefined && !dto.isActive));

    if (isRemovingAdmin) {
      await this.ensureNotLastAdmin(userId);
    }

    const data: Prisma.UserUpdateInput = {};
    if (dto.name !== undefined) data.name = dto.name;
    if (dto.role !== undefined) data.role = dto.role;
    if (dto.isActive !== undefined) data.isActive = dto.isActive;

    const user = await this.prisma.user.update({
      where: { id: userId },
      data,
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
        createdAt: true,
        updatedAt: true,
      },
    });

    await this.auditService.log(
      AUDIT_ACTIONS.USER_UPDATED,
      actorId,
      JSON.stringify({
        userId,
        changes: dto,
        oldValues: {
          name: existing.name,
          role: existing.role,
          isActive: existing.isActive,
        },
      }),
    );

    this.logger.log(
      `Staff user updated: ${userId} by ${actorId}`,
    );
    return this.toStaffResponse(user);
  }

  // ---------------------------------------------------------------------------
  // Soft deactivate staff user
  // ---------------------------------------------------------------------------

  async deactivateUser(
    userId: string,
    actorId: string,
  ): Promise<void> {
    if (userId === actorId) {
      throw new BadRequestException(
        'Cannot deactivate your own account',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
    }

    // S-E13-03: Last admin protection
    if (existing.role === Role.ADMIN) {
      await this.ensureNotLastAdmin(userId);
    }

    // S-E13-04: Block deactivation if consultant has active cases
    if (existing.role === Role.CONSULTANT) {
      const activeCases = await this.prisma.careCase.findMany({
        where: {
          consultantId: userId,
          status: {
            in: [
              CaseStatus.ASSIGNED,
              CaseStatus.IN_PROGRESS,
              CaseStatus.ON_HOLD,
              CaseStatus.MEETING_SCHEDULED,
            ],
          },
        },
        select: {
          id: true,
          topic: true,
          status: true,
          person: { select: { name: true } },
        },
      });

      if (activeCases.length > 0) {
        throw new ConflictException({
          message: ERROR_CONSULTANT_ACTIVE_CASES,
          blockingCases: activeCases.map((c) => ({
            caseId: c.id,
            topic: c.topic,
            status: c.status,
            personName: c.person?.name ?? null,
          })),
          count: activeCases.length,
          suggestion: 'Use the transfer endpoint to reassign active cases before deactivating.',
        });
      }
    }

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    await this.auditService.log(
      AUDIT_ACTIONS.USER_DEACTIVATED,
      actorId,
      JSON.stringify({
        userId,
        email: existing.email,
        role: existing.role,
      }),
    );

    this.logger.log(
      `Staff user deactivated: ${userId} by ${actorId}`,
    );
  }

  // ---------------------------------------------------------------------------
  // S-E13-05: Duplicate Account Detection
  // ---------------------------------------------------------------------------

  async findDuplicates(): Promise<DuplicateAccountsResponse> {
    const allUsers = await this.prisma.user.findMany({
      select: {
        id: true,
        email: true,
        name: true,
        role: true,
        isActive: true,
      },
      orderBy: { createdAt: 'asc' },
    });

    const duplicates: DuplicateAccountEntry[] = [];
    const seen = new Set<string>();

    for (let i = 0; i < allUsers.length; i++) {
      for (let j = i + 1; j < allUsers.length; j++) {
        const a = allUsers[i];
        const b = allUsers[j];
        const pairKey = [a.id, b.id].sort().join(':');

        if (seen.has(pairKey)) continue;

        // Exact email match (should be unique, but check across case)
        if (a.email.toLowerCase() === b.email.toLowerCase() && a.id !== b.id) {
          seen.add(pairKey);
          duplicates.push({
            id: b.id,
            email: b.email,
            name: b.name,
            role: b.role,
            isActive: b.isActive,
            reason: DUPLICATE_EXACT_EMAIL_REASON,
            matchedWith: a.id,
          });
          continue;
        }

        // Case-insensitive name match
        if (
          a.name.toLowerCase().trim() === b.name.toLowerCase().trim() &&
          a.name.trim().length > 0
        ) {
          seen.add(pairKey);
          duplicates.push({
            id: b.id,
            email: b.email,
            name: b.name,
            role: b.role,
            isActive: b.isActive,
            reason: DUPLICATE_NAME_REASON,
            matchedWith: a.id,
          });
        }
      }
    }

    return {
      duplicates,
      total: duplicates.length,
    };
  }

  // ---------------------------------------------------------------------------
  // S-E13-03: Last Admin Protection — Helper
  // ---------------------------------------------------------------------------

  private async ensureNotLastAdmin(userId: string): Promise<void> {
    const activeAdminCount = await this.prisma.user.count({
      where: {
        role: Role.ADMIN,
        isActive: true,
        id: { not: userId },
      },
    });

    if (activeAdminCount === 0) {
      throw new ConflictException(ERROR_LAST_ADMIN);
    }
  }

  // ---------------------------------------------------------------------------
  // Helpers
  // ---------------------------------------------------------------------------

  private toStaffResponse(user: {
    id: string;
    email: string;
    name: string;
    role: Role;
    isActive: boolean;
    createdAt: Date;
    updatedAt: Date;
  }): StaffUserResponse {
    return {
      id: user.id,
      email: user.email,
      name: user.name,
      role: user.role,
      isActive: user.isActive,
      createdAt: user.createdAt,
      updatedAt: user.updatedAt,
    };
  }
}
