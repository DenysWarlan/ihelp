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
  AdminCourse,
  AdminCourseDetail,
  AdminLesson,
  CourseStatus,
  CreateCourseFormModel,
} from '../model/course-manage.model';
import { CourseManageService } from '../service/course-manage.service';

interface CourseManageState {
  courses: AdminCourse[];
  total: number;
  selectedCourse: AdminCourseDetail | null;
  isLoading: boolean;
  isSaving: boolean;
  error: string | null;
}

const initialState: CourseManageState = {
  courses: [],
  total: 0,
  selectedCourse: null,
  isLoading: false,
  isSaving: false,
  error: null,
};

export const CourseManageStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const service: CourseManageService = inject(CourseManageService);

    return {
      loadCourses: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getCourses().pipe(
              tap((result: { data: AdminCourse[]; total: number }) =>
                patchState(store, {
                  courses: result.data,
                  total: result.total,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load courses',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadStaffCourses: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            service.getStaffCourses().pipe(
              tap((courses: AdminCourse[]) =>
                patchState(store, {
                  courses: courses.map((c) => ({ ...c, lessonsCount: c.lessonsCount ?? 0, enrollmentsCount: 0 })),
                  total: courses.length,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load staff courses',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadCourseDetail: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
              selectedCourse: null,
            })
          ),
          switchMap((id: string) =>
            service.getCourseDetail(id).pipe(
              tap((course: AdminCourseDetail) =>
                patchState(store, {
                  selectedCourse: course,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load course',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      loadStaffCourseDetail: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
              selectedCourse: null,
            })
          ),
          switchMap((id: string) =>
            service.getStaffCourseDetail(id).pipe(
              tap((course: AdminCourseDetail) =>
                patchState(store, {
                  selectedCourse: course,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to load course',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      createCourse: rxMethod<CreateCourseFormModel>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((dto: CreateCourseFormModel) =>
            service.createCourse(dto).pipe(
              tap((course: AdminCourse) =>
                patchState(store, {
                  courses: [...store.courses(), course],
                  total: store.total() + 1,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to create course',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      updateCourse: rxMethod<{
        id: string;
        dto: Partial<{ title: string; description: string; visibility: string }>;
      }>(
        pipe(
          tap(() => patchState(store, { isSaving: true, error: null })),
          switchMap((payload) =>
            service.updateCourse(payload.id, payload.dto).pipe(
              tap((updated: AdminCourseDetail) =>
                patchState(store, {
                  selectedCourse: updated,
                  isSaving: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isSaving: false,
                  error: 'Failed to update course',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      deleteCourse: rxMethod<string>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((id: string) =>
            service.deleteCourse(id).pipe(
              tap(() =>
                patchState(store, {
                  courses: store.courses().filter(
                    (c: AdminCourse) => c.id !== id
                  ),
                  total: store.total() - 1,
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to delete course',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      changeStatus: rxMethod<{ id: string; status: CourseStatus }>(
        pipe(
          tap(() => patchState(store, { isSaving: true, error: null })),
          switchMap((payload: { id: string; status: CourseStatus }) =>
            service.changeStatus(payload.id, payload.status).pipe(
              tap((updated: AdminCourse) => {
                patchState(store, {
                  courses: store.courses().map((c: AdminCourse) =>
                    c.id === updated.id ? updated : c
                  ),
                  isSaving: false,
                });
                const current = store.selectedCourse();
                if (current && current.id === updated.id) {
                  patchState(store, {
                    selectedCourse: { ...current, status: updated.status },
                  });
                }
              }),
              catchError(() => {
                patchState(store, {
                  isSaving: false,
                  error: 'Failed to change course status',
                });
                return EMPTY;
              })
            )
          )
        )
      ),

      createLesson: rxMethod<{
        courseId: string;
        dto: {
          title: string;
          content: string;
          contentType: string;
          videoUrl?: string;
          imageUrl?: string;
        };
      }>(
        pipe(
          tap(() => patchState(store, { isSaving: true, error: null })),
          switchMap((payload) =>
            service
              .createLesson(payload.courseId, payload.dto)
              .pipe(
                tap((lesson: AdminLesson) => {
                  const current = store.selectedCourse();
                  if (current) {
                    patchState(store, {
                      selectedCourse: {
                        ...current,
                        lessons: [...current.lessons, lesson],
                        lessonCount: current.lessonCount + 1,
                      },
                      isSaving: false,
                    });
                  } else {
                    patchState(store, { isSaving: false });
                  }
                }),
                catchError(() => {
                  patchState(store, {
                    isSaving: false,
                    error: 'Failed to create lesson',
                  });
                  return EMPTY;
                })
              )
          )
        )
      ),

      updateLesson: rxMethod<{
        courseId: string;
        lessonId: string;
        dto: Partial<{
          title: string;
          content: string;
          contentType: string;
          videoUrl: string | null;
          imageUrl: string | null;
        }>;
      }>(
        pipe(
          tap(() => patchState(store, { isSaving: true, error: null })),
          switchMap((payload) =>
            service
              .updateLesson(payload.courseId, payload.lessonId, payload.dto)
              .pipe(
                tap((updated: AdminLesson) => {
                  const current = store.selectedCourse();
                  if (current) {
                    patchState(store, {
                      selectedCourse: {
                        ...current,
                        lessons: current.lessons.map((l: AdminLesson) =>
                          l.id === updated.id ? updated : l
                        ),
                      },
                      isSaving: false,
                    });
                  } else {
                    patchState(store, { isSaving: false });
                  }
                }),
                catchError(() => {
                  patchState(store, {
                    isSaving: false,
                    error: 'Failed to update lesson',
                  });
                  return EMPTY;
                })
              )
          )
        )
      ),

      deleteLesson: rxMethod<{ courseId: string; lessonId: string }>(
        pipe(
          tap(() => patchState(store, { isSaving: true, error: null })),
          switchMap((payload) =>
            service
              .deleteLesson(payload.courseId, payload.lessonId)
              .pipe(
                tap(() => {
                  const current = store.selectedCourse();
                  if (current) {
                    patchState(store, {
                      selectedCourse: {
                        ...current,
                        lessons: current.lessons.filter(
                          (l: AdminLesson) => l.id !== payload.lessonId
                        ),
                        lessonCount: current.lessonCount - 1,
                      },
                      isSaving: false,
                    });
                  } else {
                    patchState(store, { isSaving: false });
                  }
                }),
                catchError(() => {
                  patchState(store, {
                    isSaving: false,
                    error: 'Failed to delete lesson',
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
