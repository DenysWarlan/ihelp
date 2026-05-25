import {
  ChangeDetectionStrategy,
  Component,
  effect,
  inject,
  OnInit,
  signal,
  WritableSignal,
} from '@angular/core';
import { FormsModule } from '@angular/forms';
import { TranslocoDirective } from '@jsverse/transloco';

import {
  ButtonComponent,
  CardComponent,
  IconComponent,
  InputComponent,
  SelectComponent,
} from '@org/shared/ui';
import { PersonFacade } from '@org/person/data-access';

import type { SelectOption } from '@org/shared/ui';

interface ProfileFormModel {
  readonly name: string;
  readonly email: string;
  readonly timezone: string;
}

const TIMEZONE_OPTIONS: SelectOption[] = [
  { value: 'Europe/Kyiv', label: 'Europe/Kyiv (UTC+2)' },
  { value: 'Europe/Warsaw', label: 'Europe/Warsaw (UTC+1)' },
  { value: 'Europe/Berlin', label: 'Europe/Berlin (UTC+1)' },
  { value: 'Europe/London', label: 'Europe/London (UTC+0)' },
  { value: 'America/New_York', label: 'America/New_York (UTC-5)' },
  { value: 'America/Chicago', label: 'America/Chicago (UTC-6)' },
  { value: 'America/Los_Angeles', label: 'America/Los_Angeles (UTC-8)' },
];

@Component({
  selector: 'app-profile',
  standalone: true,
  imports: [
    TranslocoDirective,
    FormsModule,
    CardComponent,
    IconComponent,
    InputComponent,
    SelectComponent,
    ButtonComponent,
  ],
  templateUrl: './profile.component.html',
  styleUrl: './profile.component.scss',
  changeDetection: ChangeDetectionStrategy.OnPush,
})
export class ProfileComponent implements OnInit {
  readonly facade: PersonFacade = inject(PersonFacade);

  readonly formModel: WritableSignal<ProfileFormModel> = signal({
    name: '',
    email: '',
    timezone: '',
  });

  readonly timezoneOptions: SelectOption[] = TIMEZONE_OPTIONS;

  constructor() {
    effect(() => {
      const profile = this.facade.profile();
      if (profile) {
        this.formModel.set({
          name: profile.name,
          email: profile.email,
          timezone: profile.timezone,
        });
      }
    });
  }

  ngOnInit(): void {
    this.facade.loadProfile();
  }

  updateField(field: keyof ProfileFormModel, value: string): void {
    this.formModel.update((current: ProfileFormModel) => ({
      ...current,
      [field]: value,
    }));
  }

  onSave(): void {
    const form = this.formModel();
    this.facade.updateProfile({
      name: form.name,
      timezone: form.timezone,
    });
  }
}
