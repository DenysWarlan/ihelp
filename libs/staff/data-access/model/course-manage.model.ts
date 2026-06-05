export type CourseStatus = 'DRAFT' | 'PUBLISHED' | 'HIDDEN' | 'ARCHIVED';

export interface AdminCourse {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: CourseStatus;
  readonly lessonsCount: number;
  readonly enrollmentsCount: number;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export type CourseVisibility = 'PUBLIC' | 'STAFF';

export interface AdminCourseDetail {
  readonly id: string;
  readonly title: string;
  readonly description: string;
  readonly status: CourseStatus;
  readonly visibility: CourseVisibility;
  readonly imageUrl: string | null;
  readonly language: string | null;
  readonly tags: string[];
  readonly lessonCount: number;
  readonly lessons: AdminLesson[];
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface AdminLesson {
  readonly id: string;
  readonly title: string;
  readonly content: string;
  readonly contentType: 'TEXT' | 'VIDEO' | 'MIXED';
  readonly videoUrl: string | null;
  readonly imageUrl: string | null;
  readonly sortOrder: number;
  readonly hasTriggerWarning: boolean;
  readonly createdAt: string;
  readonly updatedAt: string;
}

export interface CreateCourseFormModel {
  readonly title: string;
  readonly description: string;
}

export interface LessonFormModel {
  readonly title: string;
  readonly content: string;
  readonly contentType: 'TEXT' | 'VIDEO' | 'MIXED';
  readonly videoUrl: string;
  readonly imageUrl: string;
  readonly hasTriggerWarning: boolean;
}
