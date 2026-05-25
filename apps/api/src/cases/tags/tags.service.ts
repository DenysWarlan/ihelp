import {
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { Prisma } from '@prisma/client';

import { JwtPayload } from '../../auth/auth.model.js';
import {
  AddTagDto,
  CaseTagResponse,
  CreateTagDto,
  TagResponse,
} from './tags.model.js';

/** Audit action constants for tag operations. */
const AUDIT_ACTION_TAG_ADDED = 'TAG_ADDED' as const;
const AUDIT_ACTION_TAG_REMOVED = 'TAG_REMOVED' as const;

const CASE_TAG_INCLUDE = {
  tag: true,
} as const;

@Injectable()
export class TagsService {
  private readonly logger = new Logger(TagsService.name);

  constructor(private readonly prisma: PrismaService) {}

  // ---------------------------------------------------------------------------
  // Tag CRUD
  // ---------------------------------------------------------------------------

  async createTag(dto: CreateTagDto): Promise<TagResponse> {
    try {
      const tag = await this.prisma.tag.create({
        data: { name: dto.name },
      });

      return tag as TagResponse;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(`Tag "${dto.name}" already exists`);
      }
      throw error;
    }
  }

  async findAllTags(): Promise<TagResponse[]> {
    const tags = await this.prisma.tag.findMany({
      orderBy: { name: 'asc' },
    });

    return tags as TagResponse[];
  }

  // ---------------------------------------------------------------------------
  // Case-Tag operations
  // ---------------------------------------------------------------------------

  async addTagToCase(
    careCaseId: string,
    dto: AddTagDto,
    actor: JwtPayload,
  ): Promise<CaseTagResponse> {
    // Verify case exists
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: careCaseId },
      select: { id: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    // Verify tag exists
    const tag = await this.prisma.tag.findUnique({
      where: { id: dto.tagId },
      select: { id: true, name: true },
    });

    if (!tag) {
      throw new NotFoundException('Tag not found');
    }

    try {
      const caseTag = await this.prisma.caseTag.create({
        data: { careCaseId, tagId: dto.tagId },
        include: CASE_TAG_INCLUDE,
      });

      // Audit: tag added
      await this.createAuditEntry(careCaseId, actor.sub, AUDIT_ACTION_TAG_ADDED, {
        tagId: dto.tagId,
        tagName: tag.name,
      });

      return caseTag as CaseTagResponse;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException('Tag is already assigned to this case');
      }
      throw error;
    }
  }

  async removeTagFromCase(
    careCaseId: string,
    tagId: string,
    actor: JwtPayload,
  ): Promise<void> {
    // Verify case exists
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: careCaseId },
      select: { id: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    const caseTag = await this.prisma.caseTag.findFirst({
      where: { careCaseId, tagId },
      include: { tag: { select: { name: true } } },
    });

    if (!caseTag) {
      throw new NotFoundException('Tag is not assigned to this case');
    }

    await this.prisma.caseTag.delete({
      where: { id: caseTag.id },
    });

    // Audit: tag removed
    await this.createAuditEntry(careCaseId, actor.sub, AUDIT_ACTION_TAG_REMOVED, {
      tagId,
      tagName: caseTag.tag.name,
    });
  }

  // ---------------------------------------------------------------------------
  // Private helpers
  // ---------------------------------------------------------------------------

  private async createAuditEntry(
    careCaseId: string,
    actorId: string,
    action: string,
    details: Record<string, unknown>,
  ): Promise<void> {
    await this.prisma.caseAuditEntry.create({
      data: {
        careCaseId,
        actorId,
        action,
        details: details as Prisma.InputJsonValue,
      },
    });
  }
}
