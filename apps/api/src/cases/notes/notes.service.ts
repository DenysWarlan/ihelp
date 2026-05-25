import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';

import { JwtPayload } from '../../auth/auth.model.js';
import { GdprService } from '../../gdpr/gdpr.service.js';
import { CreateNoteDto, NoteResponse, UpdateNoteDto } from './notes.model.js';
import { PiiScanResult } from '../../gdpr/gdpr.model.js';

const NOTE_INCLUDE = {
  author: { select: { id: true, name: true, role: true } },
} as const;

/** Response shape when PII warnings are present. */
export interface NoteWithPiiWarnings {
  readonly note: NoteResponse;
  readonly piiWarnings: string[];
}

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly gdprService: GdprService,
  ) {}

  async create(
    careCaseId: string,
    dto: CreateNoteDto,
    actor: JwtPayload,
  ): Promise<NoteResponse | NoteWithPiiWarnings> {
    // Verify case exists
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: careCaseId },
      select: { id: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    // S-E12-08: PII scanning — warn consultant but don't block
    const piiResult = await this.scanPii(dto.content);

    const note = await this.prisma.caseNote.create({
      data: {
        careCaseId,
        authorId: actor.sub,
        content: dto.content,
        isSupervisorNote: dto.isSupervisorNote ?? false,
      },
      include: NOTE_INCLUDE,
    });

    const noteResponse = note as NoteResponse;

    if (piiResult.hasPii) {
      this.logger.warn(
        `[MVP NOTIFICATION] PII detected in case note ${note.id} by ${actor.sub}: ${piiResult.warnings.join('; ')}`,
      );
      return { note: noteResponse, piiWarnings: piiResult.warnings };
    }

    return noteResponse;
  }

  async findAll(careCaseId: string): Promise<NoteResponse[]> {
    // Verify case exists
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: careCaseId },
      select: { id: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    const notes = await this.prisma.caseNote.findMany({
      where: { careCaseId },
      include: NOTE_INCLUDE,
      orderBy: { createdAt: 'desc' },
    });

    return notes as NoteResponse[];
  }

  async update(
    careCaseId: string,
    noteId: string,
    dto: UpdateNoteDto,
    actor: JwtPayload,
  ): Promise<NoteResponse | NoteWithPiiWarnings> {
    const note = await this.prisma.caseNote.findFirst({
      where: { id: noteId, careCaseId },
      select: { id: true, authorId: true },
    });

    if (!note) {
      throw new NotFoundException('Note not found');
    }

    if (note.authorId !== actor.sub) {
      throw new ForbiddenException('Only the author can edit this note');
    }

    // S-E12-08: PII scanning on update
    const piiResult = await this.scanPii(dto.content);

    const updated = await this.prisma.caseNote.update({
      where: { id: noteId },
      data: { content: dto.content },
      include: NOTE_INCLUDE,
    });

    const noteResponse = updated as NoteResponse;

    if (piiResult.hasPii) {
      this.logger.warn(
        `[MVP NOTIFICATION] PII detected in updated case note ${noteId} by ${actor.sub}: ${piiResult.warnings.join('; ')}`,
      );
      return { note: noteResponse, piiWarnings: piiResult.warnings };
    }

    return noteResponse;
  }

  // ---------------------------------------------------------------------------
  // PII scanning helper (S-E12-08)
  // ---------------------------------------------------------------------------

  private async scanPii(content: string): Promise<PiiScanResult> {
    try {
      return await this.gdprService.scanForPii(content);
    } catch (error) {
      // PII scanning must never block note creation
      this.logger.error(
        `PII scanning failed: ${error instanceof Error ? error.message : String(error)}`,
      );
      return { hasPii: false, warnings: [] };
    }
  }
}
