import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

import { AdminCourse, CreateCourseFormModel } from '../model/course-manage.model';
import { CourseManageService } from '../service/course-manage.service';

interface CourseManageState {
  courses: AdminCourse[];
  total: number;
  isLoading: boolean;
  error: string | null;
}

const initialState: CourseManageState = {
  courses: [],
  total: 0,
  isLoading: false,
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

      changeStatus: rxMethod<{ id: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap((payload: { id: string; status: 'DRAFT' | 'PUBLISHED' | 'ARCHIVED' }) =>
            service.changeStatus(payload.id, payload.status).pipe(
              tap((updated: AdminCourse) =>
                patchState(store, {
                  courses: store.courses().map((c: AdminCourse) =>
                    c.id === updated.id ? updated : c
                  ),
                  isLoading: false,
                })
              ),
              catchError(() => {
                patchState(store, {
                  isLoading: false,
                  error: 'Failed to change course status',
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
