import { ChangeDetectionStrategy, Component, computed, effect, inject, Signal } from '@angular/core';
import { toSignal } from '@angular/core/rxjs-interop';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute, Params, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { ButtonComponent, IconComponent } from '@org/shared/ui';
import { PersonFacade, PersonLesson, PersonLessonDetail } from '@org/person/data-access';

@Component({
  selector: 'app-lesson-detail',
  standalone: true,
  imports: [
    TranslocoDirective,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './lesson-detail.component.html',
  styleUrl: './lesson-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonDetailComponent {
  readonly facade: PersonFacade = inject(PersonFacade);
  private readonly router: Router = inject(Router);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly sanitizer: DomSanitizer = inject(DomSanitizer);

  private readonly params: Signal<Params | undefined> = toSignal(this.route.params);

  readonly courseId: Signal<string> = computed(() => this.params()?.['courseId'] ?? '');
  private readonly lessonId: Signal<string> = computed(() => this.params()?.['lessonId'] ?? '');

  constructor() {
    this.facade.loadDashboard();
    effect(() => {
      const courseId = this.courseId();
      const lessonId = this.lessonId();
      if (courseId && lessonId) {
        this.facade.loadLessonDetail(courseId, lessonId);
        const course = this.facade.selectedCourse();
        if (!course || course.id !== courseId) {
          this.facade.loadCourseDetail(courseId);
        }
      }
    });
  }

  readonly youtubeEmbedUrl: Signal<SafeResourceUrl | null> = computed(() => {
    const lesson = this.facade.selectedLesson();
    if (!lesson?.videoUrl) return null;
    const videoId = this.extractYoutubeId(lesson.videoUrl);
    if (!videoId) return null;
    return this.sanitizer.bypassSecurityTrustResourceUrl(
      `https://www.youtube.com/embed/${videoId}`,
    );
  });

  readonly isYoutube: Signal<boolean> = computed(() => {
    const lesson = this.facade.selectedLesson();
    if (!lesson?.videoUrl) return false;
    return lesson.videoUrl.includes('youtube.com') || lesson.videoUrl.includes('youtu.be');
  });

  readonly nextLesson: Signal<PersonLesson | null> = computed(() => {
    const lesson = this.facade.selectedLesson();
    const course = this.facade.selectedCourse();
    if (!lesson || !course) return null;
    const sorted: PersonLesson[] = [...course.lessons].sort(
      (a: PersonLesson, b: PersonLesson) => a.orderIndex - b.orderIndex,
    );
    const currentIndex: number = sorted.findIndex((l: PersonLesson) => l.id === lesson.id);
    if (currentIndex < 0 || currentIndex >= sorted.length - 1) return null;
    return sorted[currentIndex + 1];
  });

  readonly canGoToNext: Signal<boolean> = computed(() => {
    const lesson = this.facade.selectedLesson();
    return !!lesson?.isCompleted && !!this.nextLesson();
  });

  readonly sortedLessons: Signal<PersonLesson[]> = computed(() => {
    const course = this.facade.selectedCourse();
    if (!course) return [];
    return [...course.lessons].sort(
      (a: PersonLesson, b: PersonLesson) => a.orderIndex - b.orderIndex,
    );
  });

  readonly currentLessonIndex: Signal<number> = computed(() => {
    const lesson: PersonLessonDetail | null = this.facade.selectedLesson();
    const sorted: PersonLesson[] = this.sortedLessons();
    if (!lesson || sorted.length === 0) return -1;
    return sorted.findIndex((l: PersonLesson) => l.id === lesson.id);
  });

  onGoToLesson(lesson: PersonLesson): void {
    const courseId = this.courseId();
    if (courseId) {
      this.facade.navigateToLesson(courseId, lesson.id);
    }
  }

  onBack(): void {
    this.facade.navigateToCourse(this.courseId());
  }

  onBackToCourses(): void {
    this.facade.navigateToCourses();
  }

  onCompleteLesson(): void {
    const lesson = this.facade.selectedLesson();
    const courseId = this.courseId();
    if (lesson && courseId) {
      this.facade.completeLesson(courseId, lesson.id);
    }
  }

  onNextLesson(): void {
    const next = this.nextLesson();
    const courseId = this.courseId();
    if (next && courseId) {
      this.facade.navigateToLesson(courseId, next.id);
    }
  }

  onWriteConsultant(): void {
    if (this.facade.dashboard()?.consultantName) {
      this.router.navigate(['/person/chat']);
    } else {
      this.router.navigate(['/person/request-help']);
    }
  }

  private extractYoutubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }
}
