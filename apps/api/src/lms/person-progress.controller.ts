import {
  Controller,
  Get,
  Param,
  ParseUUIDPipe,
  NotFoundException,
} from '@nestjs/common';
import {
  ApiTags,
  ApiOperation,
  ApiOkResponse,
  ApiNotFoundResponse,
  ApiBearerAuth,
} from '@nestjs/swagger';
import { PrismaService } from '@org/prisma-client';
import { CaseSource } from '@prisma/client';
import { Roles } from '../auth/decorators/roles.decorator.js';
import { ProgressService } from './progress.service.js';
import { PersonProgressDto } from './dto/progress.dto.js';

@ApiTags('person-progress')
@ApiBearerAuth()
@Roles('CONSULTANT', 'SUPERVISOR', 'COORDINATOR', 'ADMIN')
@Controller('cases')
export class PersonProgressController {
  constructor(
    private readonly progressService: ProgressService,
    private readonly prisma: PrismaService,
  ) {}

  @Get(':caseId/person-progress')
  @ApiOperation({ summary: 'Get person course progress for a care case (consultant view)' })
  @ApiOkResponse({ type: PersonProgressDto, description: 'Person progress across all enrollments' })
  @ApiNotFoundResponse({ description: 'Case not found' })
  async getPersonProgress(
    @Param('caseId', ParseUUIDPipe) caseId: string,
  ): Promise<PersonProgressDto> {
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: caseId },
      select: { personId: true },
    });

    if (!careCase) {
      throw new NotFoundException(`Case with id "${caseId}" not found`);
    }

    const progress = await this.progressService.getPersonProgress(careCase.personId);

    // Enrich with struggling info: mark lessons where the person triggered "I'm struggling"
    const strugglingCases = await this.prisma.careCase.findMany({
      where: {
        personId: careCase.personId,
        source: CaseSource.COURSE,
        sourceLessonId: { not: null },
      },
      select: {
        sourceLessonId: true,
        sourceCourseId: true,
        id: true,
        status: true,
        createdAt: true,
      },
    });

    // Build a set of lessonIds that had struggling triggers
    const strugglingLessonIds = new Set(
      strugglingCases.map((c) => c.sourceLessonId).filter(Boolean),
    );

    // Add struggling flag to lesson progress items
    for (const enrollment of progress.enrollments) {
      for (const lesson of enrollment.lessons) {
        (lesson as Record<string, unknown>)['hadStruggling'] =
          strugglingLessonIds.has(lesson.lessonId);
      }
    }

    return progress;
  }
}
