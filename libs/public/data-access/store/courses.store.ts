import { inject } from '@angular/core';
import {
  patchState,
  signalStore,
  withMethods,
  withState,
} from '@ngrx/signals';
import { rxMethod } from '@ngrx/signals/rxjs-interop';
import { EMPTY, pipe, switchMap, tap, catchError } from 'rxjs';

import { CourseDetail, CourseListItem } from '../model/course.model';
import { CoursesService } from '../service/courses.service';

interface CoursesState {
  courses: CourseListItem[];
  selectedCourse: CourseDetail | null;
  isLoading: boolean;
  error: string | null;
}

const initialState: CoursesState = {
  courses: [],
  selectedCourse: null,
  isLoading: false,
  error: null,
};

export const CoursesStore = signalStore(
  { providedIn: 'root' },
  withState(initialState),
  withMethods((store) => {
    const coursesService = inject(CoursesService);

    return {
      loadCourses: rxMethod<void>(
        pipe(
          tap(() => patchState(store, { isLoading: true, error: null })),
          switchMap(() =>
            coursesService.getAll().pipe(
              tap((courses: CourseListItem[]) =>
                patchState(store, { courses, isLoading: false })
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

      loadCourse: rxMethod<string>(
        pipe(
          tap(() =>
            patchState(store, {
              isLoading: true,
              error: null,
              selectedCourse: null,
            })
          ),
          switchMap((id: string) =>
            coursesService.getById(id).pipe(
              tap((course: CourseDetail) =>
                patchState(store, { selectedCourse: course, isLoading: false })
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
    };
  })
);
