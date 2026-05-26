import { ChangeDetectionStrategy, Component, computed, inject, OnInit, Signal } from '@angular/core';
import { DomSanitizer, SafeResourceUrl } from '@angular/platform-browser';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import { IconComponent } from '@org/shared/ui';
import { PersonFacade } from '@org/person/data-access';

@Component({
  selector: 'app-lesson-detail',
  standalone: true,
  imports: [
    TranslocoDirective,
    IconComponent,
  ],
  templateUrl: './lesson-detail.component.html',
  styleUrl: './lesson-detail.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class LessonDetailComponent implements OnInit {
  readonly facade: PersonFacade = inject(PersonFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly sanitizer: DomSanitizer = inject(DomSanitizer);

  private courseId = '';

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

  ngOnInit(): void {
    this.courseId = this.route.snapshot.params['courseId'];
    const lessonId: string = this.route.snapshot.params['lessonId'];
    if (this.courseId && lessonId) {
      this.facade.loadLessonDetail(this.courseId, lessonId);
    }
  }

  onBack(): void {
    this.facade.navigateToCourse(this.courseId);
  }

  onCompleteLesson(): void {
    const lesson = this.facade.selectedLesson();
    if (lesson && this.courseId) {
      this.facade.completeLesson(this.courseId, lesson.id);
    }
  }

  private extractYoutubeId(url: string): string | null {
    const match = url.match(/(?:youtube\.com\/watch\?.*v=|youtu\.be\/)([a-zA-Z0-9_-]{11})/);
    return match ? match[1] : null;
  }
}
