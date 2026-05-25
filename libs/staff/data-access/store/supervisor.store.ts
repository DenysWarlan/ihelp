import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

import type { TeamAnalytics, TeamMember } from '../model/supervisor.model';
import { SupervisorService } from '../service/supervisor.service';

interface SupervisorState {
  teamAnalytics: TeamAnalytics | null;
  teamMembers: TeamMember[];
  isLoading: boolean;
  error: string | null;
}

const initialState: SupervisorState = {
  teamAnalytics: null,
  teamMembers: [],
  isLoading: false,
  error: null,
};

export const SupervisorStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const service: SupervisorService = inject(SupervisorService);

    return {
      loadTeamAnalytics: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getTeamAnalytics().pipe(
              tap((teamAnalytics: TeamAnalytics) =>
                patchState(store, { teamAnalytics, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load team analytics',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadTeamMembers: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getTeamMembers().pipe(
              tap((teamMembers: TeamMember[]) =>
                patchState(store, { teamMembers, isLoading: false })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load team members',
                });
                return EMPTY;
              })
            )
          )
        )
      ),
    };
  })
);
