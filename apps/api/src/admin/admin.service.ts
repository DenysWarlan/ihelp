import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { Prisma, Role, User } from '@prisma/client';

import { DEFAULT_PAGE_SIZE } from './admin.const.js';
import {
  CreateStaffUserDto,
  ListStaffUsersDto,
  PaginatedStaffUsersResponse,
  StaffUserResponse,
  UpdateStaffUserDto,
} from './admin.model.js';

@Injectable()
export class AdminService {
  private readonly logger = new Logger(AdminService.name);

  constructor(private readonly prisma: PrismaService) {}

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
    if (userId === actorId && dto.role !== undefined) {
      throw new BadRequestException(
        'Cannot change your own role — this could cause admin lockout',
      );
    }

    const existing = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!existing) {
      throw new NotFoundException('User not found');
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

    await this.prisma.user.update({
      where: { id: userId },
      data: { isActive: false },
    });

    this.logger.log(
      `Staff user deactivated: ${userId} by ${actorId}`,
    );
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
