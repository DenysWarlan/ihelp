import { HttpClient } from '@angular/common/http';
import { inject, Injectable } from '@angular/core';
import { Observable } from 'rxjs';
import {
  PersonLoginRequest,
  PersonLoginResponse,
  PersonRegisterRequest,
  PhoneLoginRequest,
  StaffLoginRequest,
  StaffLoginResponse,
  TokenPair,
  UserProfile,
} from '../model/auth.model';

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http: HttpClient = inject(HttpClient);

  staffLogin(request: StaffLoginRequest): Observable<StaffLoginResponse> {
    return this.http.post<StaffLoginResponse>(
      '/api/auth/staff/login',
      request,
    );
  }

  personLogin(request: PersonLoginRequest): Observable<PersonLoginResponse> {
    return this.http.post<PersonLoginResponse>(
      '/api/auth/person/login',
      request,
    );
  }

  personLoginByPhone(request: PhoneLoginRequest): Observable<PersonLoginResponse> {
    return this.http.post<PersonLoginResponse>(
      '/api/auth/person/login/phone',
      request,
    );
  }

  personRegister(request: PersonRegisterRequest): Observable<TokenPair> {
    return this.http.post<TokenPair>(
      '/api/auth/person/register',
      request,
    );
  }

  refreshToken(refreshToken: string): Observable<TokenPair> {
    return this.http.post<TokenPair>('/api/auth/refresh', { refreshToken });
  }

  logout(refreshToken: string): Observable<void> {
    return this.http.post<void>('/api/auth/logout', { refreshToken });
  }

  getMe(): Observable<UserProfile> {
    return this.http.get<UserProfile>('/api/auth/me');
  }
}
