import { ChangeDetectionStrategy, Component, inject, OnInit } from '@angular/core';
import { ActivatedRoute } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  BadgeComponent,
  ButtonComponent,
  CardComponent,
  IconComponent,
  ProgressBarComponent,
} from '@org/shared/ui';
import { PersonFacade } from '@org/person/data-access';

@Component({
  selector: 'app-course-detail',
  standalone: true,
  imports: [
    TranslocoDirective,
    CardComponent,
    IconComponent,
    BadgeComponent,
    ProgressBarComponent,
    ButtonComponent,
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
