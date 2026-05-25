export interface CourseListItem {
  id: string;
  title: string;
  description: string;
  tags: string[];
  lessonCount: number;
  imageUrl: string | null;
}

export interface CourseDetail extends CourseListItem {
  lessons: LessonListItem[];
}

export interface LessonListItem {
  id: string;
  title: string;
  sortOrder: number;
}
