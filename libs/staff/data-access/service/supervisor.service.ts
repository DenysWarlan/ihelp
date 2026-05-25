import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';

import type { TeamAnalytics, TeamMember } from '../model/supervisor.model';

@Injectable({ providedIn: 'root' })
export class SupervisorService {
  private readonly http: HttpClient = inject(HttpClient);

  getTeamAnalytics(): Observable<TeamAnalytics> {
    return this.http.get<TeamAnalytics>('/api/analytics/team');
  }

  getTeamMembers(): Observable<TeamMember[]> {
    return this.http.get<TeamMember[]>('/api/analytics/team/members');
  }
}
