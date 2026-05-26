import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { IconComponent } from '@org/shared/ui';
import { PersonCourseDetail } from '@org/person/data-access';
import { PersonFacade } from '@org/person/data-access';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [
    TranslocoDirective,
    IconComponent,
  ],
  templateUrl: './course-detail.component.html',
  styleUrl: './course-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class CourseDetailComponent implements OnInit {
  readonly facade: PersonFacade = inject(PersonFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);

  ngOnInit(): void {
    const id: string = this.route.snapshot.params['id'];
    if (id) {
      this.facade.loadCourseDetail(id);
    }
  }

  completedCount(course: PersonCourseDetail): number {
    return course.lessons.filter(l => l.isCompleted).length;
  }

  getLessonIcon(contentType: string): string {
    switch (contentType) {
      case 'VIDEO': return 'Play';
      case 'QUIZ': return 'HelpCircle';
      case 'ASSIGNMENT': return 'Edit3';
      case 'DOCUMENT': return 'FileText';
      default: return 'BookOpen';
    }
  }

  getLessonTypeLabel(contentType: string, t: (key: string) => string): string {
    switch (contentType) {
      case 'VIDEO': return t('courseDetail.typeVideo');
      case 'QUIZ': return t('courseDetail.typeQuiz');
      case 'ASSIGNMENT': return t('courseDetail.typeAssignment');
      case 'DOCUMENT': return t('courseDetail.typeDocument');
      default: return t('courseDetail.typeLesson');
    }
  }

  onOpenLesson(lessonId: string): void {
    const course = this.facade.selectedCourse();
    if (course) {
      this.facade.navigateToLesson(course.id, lessonId);
    }
  }

  onCompleteLesson(lessonId: string): void {
    const course = this.facade.selectedCourse();
    if (course) {
      this.facade.completeLesson(course.id, lessonId);
    }
  }

  onBack(): void {
    this.facade.navigateToCourses();
  }
}
