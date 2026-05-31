import {
  ChangeDetectionStrategy,
  Component,
  inject,
  OnInit,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { TranslocoDirective } from '@jsverse/transloco';
import { ButtonComponent, IconComponent } from '@org/shared/ui';
import type { SelectOption } from '@org/shared/ui';
import { StaffFacade } from '@org/staff/data-access';
import type { ScheduleMeetingFormModel } from '@org/staff/data-access';

@Component({
  selector: 'app-schedule-meeting',
  standalone: true,
  imports: [
    TranslocoDirective,
    FormsModule,
    ButtonComponent,
    IconComponent,
  ],
  templateUrl: './schedule-meeting.component.html',
  styleUrl: './schedule-meeting.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ScheduleMeetingComponent implements OnInit {
  private readonly facade: StaffFacade = inject(StaffFacade);
  private readonly route: ActivatedRoute = inject(ActivatedRoute);
  private readonly router: Router = inject(Router);

  readonly isLoading: Signal<boolean> = this.facade.isLoading;
  readonly caseId: WritableSignal<string> = signal('');
  readonly personName: WritableSignal<string> = signal('');
  readonly topic: WritableSignal<string> = signal('');

  readonly formModel: WritableSignal<ScheduleMeetingFormModel> = signal({
    date: '',
    time: '14:00',
    duration: '30',
    platform: 'Google Meet',
    notes: '',
  });

  readonly durationOptions: SelectOption[] = [
    { value: '15', label: '15 хвилин' },
    { value: '30', label: '30 хвилин' },
    { value: '45', label: '45 хвилин' },
    { value: '60', label: '60 хвилин' },
  ];

  readonly platformOptions: SelectOption[] = [
    { value: 'Google Meet', label: 'Google Meet' },
    { value: 'Zoom', label: 'Zoom' },
    { value: 'Teams', label: 'Microsoft Teams' },
  ];

  ngOnInit(): void {
    const id: string = this.route.snapshot.params['caseId'] ?? '';
    if (id) {
      this.caseId.set(id);
      this.facade.loadCaseDetail(id);
    }
  }

  get personInfo(): { name: string; topic: string } {
    const caseDetail = this.facade.selectedCase();
    return {
      name: caseDetail?.personName ?? '',
      topic: caseDetail?.topic ?? '',
    };
  }

  updateField(field: keyof ScheduleMeetingFormModel, value: string): void {
    this.formModel.update((current: ScheduleMeetingFormModel) => ({
      ...current,
      [field]: value,
    }));
  }

  onSubmit(): void {
    const form: ScheduleMeetingFormModel = this.formModel();
    if (form.date && form.time) {
      this.facade.scheduleMeeting({
        caseId: this.caseId(),
        date: form.date,
        time: form.time,
        durationMinutes: parseInt(form.duration, 10),
        platform: form.platform,
        notes: form.notes,
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/staff/cases', this.caseId()]);
  }

  goBack(): void {
    this.router.navigate(['/staff/cases', this.caseId()]);
  }
}
