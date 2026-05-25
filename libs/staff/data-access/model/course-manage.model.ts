export interface AdminCourse {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED';
  readonly lessonsCount: number;
  readonly enrollmentsCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCourseFormModel {
  readonly title: string;
  readonly description: string;
}
