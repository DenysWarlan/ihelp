import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import { CreateCaseRequest, CreateCaseResponse } from '../model/case.model';

@Injectable({ providedIn: 'root' })
export class CasesService {
  private readonly http: HttpClient = inject(HttpClient);

  create(request: CreateCaseRequest): Observable<CreateCaseResponse> {
    return this.http.post<CreateCaseResponse>('/api/cases', request);
  }
}
