import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, of, pipe, switchMap, tap, catchError } from 'rxjs';

import {
  PersonCourse,
  PersonCourseDetail,
  PersonDashboard,
  PersonLessonDetail,
  PersonMeeting,
  PersonProfile,
  PersonLesson,
} from '../model/person.model';
import { PersonService } from '../service/person.service';

interface PersonState {
  dashboard: PersonDashboard | null;
  courses: PersonCourse[];
  selectedCourse: PersonCourseDetail | null;
  selectedLesson: PersonLessonDetail | null;
  meetings: PersonMeeting[];
  profile: PersonProfile | null;
  isLoading: boolean;
  isSaving: boolean;
  isSettingPassword: boolean;
  passwordSuccess: boolean;
  error: string | null;
}

const initialState: PersonState = {
  dashboard: null,
  courses: [],
  selectedCourse: null,
  selectedLesson: null,
  meetings: [],
  profile: null,
  isLoading: false,
  isSaving: false,
  isSettingPassword: false,
  passwordSuccess: false,
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

      loadLessonDetail: rxMethod<{ courseId: string; lessonId: string }>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
              selectedLesson: null,
            }),
          ),
          switchMap(({ courseId, lessonId }) =>
            personService.getLessonDetail(courseId, lessonId).pipe(
              tap((lesson: PersonLessonDetail) =>
                patchState(store, {
                  selectedLesson: lesson,
                  isLoading: false,
                }),
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load lesson',
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

      enrollAndStart: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
              selectedCourse: null,
            }),
          ),
          switchMap((courseId: string) =>
            personService.enrollInCourse(courseId).pipe(
              catchError(() => of(undefined)),
              switchMap(() => personService.getCourseDetail(courseId)),
              tap((course: PersonCourseDetail) => {
                patchState(store, {
                  selectedCourse: course,
                  isLoading: false,
                });
              }),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to start course',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      enrollInCourse: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isSaving: true, error: null })),
          switchMap((courseId: string) =>
            personService.enrollInCourse(courseId).pipe(
              tap(() => patchState(store, { isSaving: false })),
              switchMap(() =>
                personService.getCourses().pipe(
                  tap((courses: PersonCourse[]) =>
                    patchState(store, { courses }),
                  ),
                  catchError(() => EMPTY),
                ),
              ),
              catchError(() => {
                patchState(store, {
                  isSaving: false,
                  error: 'Failed to enroll in course',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      setPassword: rxMethod<{ password: string; currentPassword?: string }>(
        pipe(
          tap(() => patchState(store, { isSettingPassword: true, passwordSuccess: false, error: null })),
          switchMap(({ password, currentPassword }) =>
            personService.setPassword(password, currentPassword).pipe(
              tap(() => {
                const currentProfile = store.profile();
                patchState(store, {
                  isSettingPassword: false,
                  passwordSuccess: true,
                  profile: currentProfile ? { ...currentProfile, hasPassword: true } : currentProfile,
                });
              }),
              catchError(() => {
                patchState(store, {
                  isSettingPassword: false,
                  error: 'Failed to set password',
                });
                return EMPTY;
              }),
            ),
          ),
        ),
      ),

      completeLesson: rxMethod<{ courseId: string; lessonId: string }>(
        pipe(
          tap(() => patchState(store, { isSaving: true })),
          switchMap(({ courseId, lessonId }) =>
            personService.completeLesson(courseId, lessonId).pipe(
              tap(() => {
                // Update selectedCourse
                const current = store.selectedCourse();
                if (current) {
                  const updatedLessons: PersonLesson[] = current.lessons.map(
                    (l: PersonLesson) =>
                      l.id === lessonId ? { ...l, isCompleted: true } : l,
                  );
                  const completedCount = updatedLessons.filter(
                    (l: PersonLesson) => l.isCompleted,
                  ).length;
                  const progress = Math.round(
                    (completedCount / updatedLessons.length) * 100,
                  );
                  patchState(store, {
                    selectedCourse: {
                      ...current,
                      lessons: updatedLessons,
                      progress,
                    },
                  });

                  // Update courses list
                  const courses = store.courses();
                  if (courses.length > 0) {
                    patchState(store, {
                      courses: courses.map((c: PersonCourse) =>
                        c.id === courseId
                          ? { ...c, completedLessons: completedCount, progress }
                          : c,
                      ),
                    });
                  }
                }

                // Update selectedLesson
                const lesson = store.selectedLesson();
                if (lesson && lesson.id === lessonId) {
                  patchState(store, {
                    selectedLesson: { ...lesson, isCompleted: true, completedAt: new Date().toISOString() },
                    isSaving: false,
                  });
                } else {
                  patchState(store, { isSaving: false });
                }
              }),
              catchError(() => {
                patchState(store, {
                  error: 'Failed to complete lesson',
                  isSaving: false,
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
