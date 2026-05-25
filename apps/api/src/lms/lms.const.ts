import { CourseStatus } from '@prisma/client';

/**
 * State-machine: allowed course status transitions.
 * Key = current status, value = list of statuses it can transition to.
 */
export const ALLOWED_COURSE_TRANSITIONS: Record<CourseStatus, CourseStatus[]> = {
  [CourseStatus.DRAFT]: [CourseStatus.PUBLISHED],
  [CourseStatus.PUBLISHED]: [CourseStatus.HIDDEN, CourseStatus.DRAFT],
  [CourseStatus.HIDDEN]: [CourseStatus.ARCHIVED, CourseStatus.DRAFT],
  [CourseStatus.ARCHIVED]: [],
};

/** Number of days enrolled users retain access after a course is archived. */
export const ARCHIVE_GRACE_PERIOD_DAYS = 90;
