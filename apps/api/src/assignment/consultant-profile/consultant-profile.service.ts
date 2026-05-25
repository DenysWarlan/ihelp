import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { Prisma } from '@prisma/client';

import {
  ConsultantProfileResponse,
  CreateConsultantProfileDto,
  UpdateConsultantProfileDto,
} from './consultant-profile.model.js';

@Injectable()
export class ConsultantProfileService {
  private readonly logger = new Logger(ConsultantProfileService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Create
  // ---------------------------------------------------------------------------

  async create(
    dto: CreateConsultantProfileDto,
  ): Promise<ConsultantProfileResponse> {
    // Verify the user exists
    const user = await this.prisma.user.findUnique({
      where: { id: dto.userId },
      select: { id: true, role: true },
    });

    if (!user) {
      throw new NotFoundException('User not found');
    }

    try {
      const profile = await this.prisma.consultantProfile.create({
        data: {
          userId: dto.userId,
          specializations: dto.specializations ?? [],
          languages: dto.languages ?? [],
          maxCases: dto.maxCases ?? 10,
          maxCrisisCases: dto.maxCrisisCases ?? 3,
        },
      });

      this.logger.log(
        `Created consultant profile for userId=${dto.userId}`,
      );

      return profile;
    } catch (error: unknown) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Consultant profile already exists for this user',
        );
      }
      throw error;
    }
  }

  // ---------------------------------------------------------------------------
  // Read
  // ---------------------------------------------------------------------------

  async findAll(): Promise<ConsultantProfileResponse[]> {
    return this.prisma.consultantProfile.findMany({
      orderBy: { createdAt: 'desc' },
    });
  }

  async findByUserId(userId: string): Promise<ConsultantProfileResponse> {
    const profile = await this.prisma.consultantProfile.findUnique({
      where: { userId },
    });

    if (!profile) {
      throw new NotFoundException(
        `Consultant profile not found for userId=${userId}`,
      );
    }

    return profile;
  }

  // ---------------------------------------------------------------------------
  // Update
  // ---------------------------------------------------------------------------

  async update(
    userId: string,
    dto: UpdateConsultantProfileDto,
  ): Promise<ConsultantProfileResponse> {
    // Ensure profile exists
    const existing = await this.prisma.consultantProfile.findUnique({
      where: { userId },
    });

    if (!existing) {
      throw new NotFoundException(
        `Consultant profile not found for userId=${userId}`,
      );
    }

    // S-E09-06: Validate maxCrisisCases <= maxCases
    const effectiveMaxCases = dto.maxCases ?? existing.maxCases;
    const effectiveMaxCrisisCases =
      dto.maxCrisisCases ?? existing.maxCrisisCases;

    if (effectiveMaxCrisisCases > effectiveMaxCases) {
      throw new BadRequestException(
        `maxCrisisCases (${effectiveMaxCrisisCases}) cannot exceed maxCases (${effectiveMaxCases})`,
      );
    }

    const profile = await this.prisma.consultantProfile.update({
      where: { userId },
      data: {
        ...(dto.specializations !== undefined && {
          specializations: dto.specializations,
        }),
        ...(dto.languages !== undefined && { languages: dto.languages }),
        ...(dto.maxCases !== undefined && { maxCases: dto.maxCases }),
        ...(dto.maxCrisisCases !== undefined && {
          maxCrisisCases: dto.maxCrisisCases,
        }),
        ...(dto.status !== undefined && { status: dto.status }),
      },
    });

    this.logger.log(`Updated consultant profile for userId=${userId}`);

    return profile;
  }
}
