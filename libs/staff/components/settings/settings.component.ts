import {
  ChangeDetectionStrategy,
  Component,
  inject,
  Signal,
  signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import { ButtonComponent } from '@org/shared/ui';
import { AdminFacade } from '@org/staff/data-access';

interface SlaLimitsModel {
  readonly crisis: number;
  readonly high: number;
  readonly medium: number;
  readonly low: number;
}

interface PointsModel {
  readonly resolvedCase: number;
  readonly meetingCompleted: number;
  readonly positiveReview: number;
}

interface DutyScheduleItem {
  readonly coordinatorName: string;
  readonly time: string;
  readonly consultantName: string;
}

@Component({
  selector: 'app-settings',
  standalone: true,
  imports: [TranslocoDirective, FormsModule, ButtonComponent],
  templateUrl: './settings.component.html',
  styleUrl: './settings.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class SettingsComponent {
  private readonly facade: AdminFacade = inject(AdminFacade);

  readonly isLoading: Signal<boolean> = this.facade.isLoading;

  readonly slaLimits: WritableSignal<SlaLimitsModel> = signal({
    crisis: 1,
    high: 8,
    medium: 12,
    low: 24,
  });

  readonly points: WritableSignal<PointsModel> = signal({
    resolvedCase: 10,
    meetingCompleted: 5,
    positiveReview: 15,
  });

  readonly crisisKeywords: WritableSignal<string> = signal(
    'суїцид, не хочу жити, harm/self, вбивство, скористигтися, допомога, безвихідь, немає сенсу, хочу зробити кінець'
  );

  readonly dutySchedule: WritableSignal<DutyScheduleItem[]> = signal([
    { coordinatorName: 'Корнієнко Євгенійко', time: '12:00', consultantName: 'Олена Петрівко' },
  ]);

  updateSlaField(field: keyof SlaLimitsModel, value: number): void {
    this.slaLimits.update((current: SlaLimitsModel) => ({ ...current, [field]: value }));
  }

  updatePointsField(field: keyof PointsModel, value: number): void {
    this.points.update((current: PointsModel) => ({ ...current, [field]: value }));
  }

  onSave(): void {
    // Will integrate with backend API later
  }
}
