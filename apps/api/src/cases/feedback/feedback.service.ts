import {
  BadRequestException,
  ConflictException,
  Injectable,
  Logger,
  NotFoundException,
} from '@nestjs/common';
import { PrismaService } from '@org/prisma-client';
import { Prisma } from '@prisma/client';

import { JwtPayload } from '../../auth/auth.model.js';
import { CreateFeedbackDto, FeedbackResponse } from './feedback.model.js';

@Injectable()
export class FeedbackService {
  private readonly logger = new Logger(FeedbackService.name);

  constructor(private readonly prisma: PrismaService) {}

  async create(
    careCaseId: string,
    dto: CreateFeedbackDto,
    actor: JwtPayload,
  ): Promise<FeedbackResponse> {
    // Verify case exists and the actor is the case person
    const careCase = await this.prisma.careCase.findUnique({
      where: { id: careCaseId },
      select: { id: true, personId: true },
    });

    if (!careCase) {
      throw new NotFoundException('Case not found');
    }

    if (careCase.personId !== actor.sub) {
      throw new BadRequestException(
        'Only the case person can submit feedback',
      );
    }

    try {
      const feedback = await this.prisma.caseFeedback.create({
        data: {
          careCaseId,
          rating: dto.rating,
          comment: dto.comment ?? null,
        },
      });

      return feedback as FeedbackResponse;
    } catch (error) {
      if (
        error instanceof Prisma.PrismaClientKnownRequestError &&
        error.code === 'P2002'
      ) {
        throw new ConflictException(
          'Feedback has already been submitted for this case',
        );
      }
      throw error;
    }
  }

  async findOne(careCaseId: string): Promise<FeedbackResponse> {
    const feedback = await this.prisma.caseFeedback.findUnique({
      where: { careCaseId },
    });

    if (!feedback) {
      throw new NotFoundException('Feedback not found for this case');
    }

    return feedback as FeedbackResponse;
  }
}
