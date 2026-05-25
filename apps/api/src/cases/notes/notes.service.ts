import {
  ForbiddenException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';

import { JwtPayload } from '../../auth/auth.model.js';
import { CreateNoteDto, NoteResponse, UpdateNoteDto } from './notes.model.js';

const NOTE_INCLUDE = {
  author: { select: { id: true, name: true, role: true } },
} as const;

@Injectable()
export class NotesService {
  private readonly logger = new Logger(NotesService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    careCaseId: string,
    dto: CreateNoteDto,
    actor: JwtPayload,
  ): Promise<NoteResponse> {
    // Verify case exists
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: careCaseId },
      select: { id: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    const note = await this.prisma.caseNote.create({
      data: {
        careCaseId,
        authorId: actor.sub,
        content: dto.content,
        isSupervisorNote: dto.isSupervisorNote ?? false,
      },
      include: NOTE_INCLUDE,
    });

    return note as NoteResponse;
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
  ): Promise<NoteResponse> {
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

    const updated = await this.prisma.caseNote.update({
      where: { id: noteId },
      data: { content: dto.content },
      include: NOTE_INCLUDE,
    });

    return updated as NoteResponse;
  }
}
