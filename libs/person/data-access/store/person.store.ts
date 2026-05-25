import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

import {
  PersonCourse,
  PersonCourseDetail,
  PersonDashboard,
  PersonMeeting,
  PersonProfile,
  PersonLesson,
} from '../model/person.model';
import { PersonService } from '../service/person.service';

interface PersonState {
  dashboard: PersonDashboard | null;
  courses: PersonCourse[];
  selectedCourse: PersonCourseDetail | null;
  meetings: PersonMeeting[];
  profile: PersonProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

const initialState: PersonState = {
  dashboard: null,
  courses: [],
  selectedCourse: null,
  meetings: [],
  profile: null,
  isLoading: false,
  isSaving: false,
  error: null,
};

export const PersonStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const personService = inject(PersonService);

    return {
      loadDashboard: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            personService.getDashboard().pipe(
              tap((dashboard: PersonDashboard) =>
                patchState(store, { dashboard, isLoading: false }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load dashboard',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      loadCourses: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            personService.getCourses().pipe(
              tap((courses: PersonCourse[]) =>
                patchState(store, { courses, isLoading: false }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load courses',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      loadCourseDetail: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
              selectedCourse: null,
            }),
          ),
          switchMap((id: string) =>
            personService.getCourseDetail(id).pipe(
              tap((course: PersonCourseDetail) =>
                patchState(store, {
                  selectedCourse: course,
                  isLoading: false,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load course',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      loadMeetings: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            personService.getMeetings().pipe(
              tap((meetings: PersonMeeting[]) =>
                patchState(store, { meetings, isLoading: false }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load meetings',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      loadProfile: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            personService.getProfile().pipe(
              tap((profile: PersonProfile) =>
                patchState(store, { profile, isLoading: false }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load profile',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      updateProfile: rxMethod<Partial<PersonProfile>>(
        pipe(
          tap(() => patchState(store, { isSaving: true, error: null })),
          switchMap((data: Partial<PersonProfile>) =>
            personService.updateProfile(data).pipe(
              tap((profile: PersonProfile) =>
                patchState(store, { profile, isSaving: false }),
              ),
              catchError(() => {
                patchState(store, {
                  isSaving: false,
                  error: 'Failed to update profile',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      completeLesson: rxMethod<{ courseId: string; lessonId: string }>(
        pipe(
          switchMap(({ courseId, lessonId }) =>
            personService.completeLesson(courseId, lessonId).pipe(
              tap(() => {
                const current = store.selectedCourse();
                if (current) {
                  const updatedLessons: PersonLesson[] = current.lessons.map(
                    (l: PersonLesson) =>
                      l.id === lessonId ? { ...l, isCompleted: true } : l,
                  );
                  const completedCount = updatedLessons.filter(
                    (l: PersonLesson) => l.isCompleted,
                  ).length;
                  patchState(store, {
                    selectedCourse: {
                      ...current,
                      lessons: updatedLessons,
                      progress: Math.round(
                        (completedCount / updatedLessons.length) * 100,
                      ),
                    },
                  });
                }
              }),
              catchError(() => {
                patchState(store, {
                  error: 'Failed to complete lesson',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),
    };
  }),
);
