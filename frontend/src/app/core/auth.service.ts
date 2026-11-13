import { HttpClient, HttpErrorResponse } from '@angular/common/http';
import { Injectable, computed, inject, signal } from '@angular/core';
import { Router } from '@angular/router';
import { Observable, map } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthResponse, LoginRequest, Role, UserSummary } from './models';

const TOKEN_KEY = 'salon.token';
const USER_KEY = 'salon.user';

/** Only the salon team (ADMIN and STAFF) can use the app. */
function isTeamRole(role: Role): boolean {
  return role === 'ADMIN' || role === 'STAFF';
}

/** Home route of a role, or /login when there is no role or it cannot use the app. */
export function homeForRole(role: Role | null): string {
  return role !== null && isTeamRole(role) ? '/calendar' : '/login';
}

/** Same shape as the API error, so apiErrorMessage shows "E-mail ou senha inválidos.". */
function notTeamError(): HttpErrorResponse {
  return new HttpErrorResponse({
    status: 401,
    error: { status: 401, message: 'Invalid email or password' },
  });
}

function isUserSummary(value: unknown): value is UserSummary {
  if (typeof value !== 'object' || value === null) {
    return false;
  }
  const candidate = value as Record<string, unknown>;
  return (
    typeof candidate['id'] === 'number' &&
    typeof candidate['name'] === 'string' &&
    typeof candidate['email'] === 'string' &&
    (candidate['role'] === 'ADMIN' || candidate['role'] === 'STAFF')
  );
}

function readToken(): string | null {
  try {
    return localStorage.getItem(TOKEN_KEY);
  } catch {
    return null;
  }
}

function readUser(): UserSummary | null {
  try {
    const raw = localStorage.getItem(USER_KEY);
    if (!raw) {
      return null;
    }
    const parsed: unknown = JSON.parse(raw);
    return isUserSummary(parsed) ? parsed : null;
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch {
    // Storage unavailable: the session just will not survive a reload.
  }
}

function removeStorage(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch {
    // Ignore.
  }
}

@Injectable({ providedIn: 'root' })
export class AuthService {
  private readonly http = inject(HttpClient);
  private readonly router = inject(Router);
  private readonly baseUrl = `${environment.apiUrl}/api/auth`;

  private readonly tokenState = signal<string | null>(readToken());
  private readonly userState = signal<UserSummary | null>(readUser());

  readonly token = this.tokenState.asReadonly();
  readonly user = this.userState.asReadonly();
  readonly isAuthenticated = computed(() => this.tokenState() !== null && this.userState() !== null);
  readonly role = computed<Role | null>(() => this.userState()?.role ?? null);

  /** Staff login. A CUSTOMER answer is treated as invalid credentials (no session is kept). */
  login(request: LoginRequest): Observable<AuthResponse> {
    return this.http.post<AuthResponse>(`${this.baseUrl}/login`, request).pipe(
      map((response) => {
        if (!isTeamRole(response.user.role)) {
          this.clearSession();
          throw notTeamError();
        }
        this.saveSession(response);
        return response;
      }),
    );
  }

  /** Reloads the logged user (and role) from the server. */
  refresh(): Observable<UserSummary> {
    return this.http.get<UserSummary>(`${this.baseUrl}/me`).pipe(
      map((user) => {
        if (!isTeamRole(user.role)) {
          this.clearSession();
          throw notTeamError();
        }
        this.userState.set(user);
        writeStorage(USER_KEY, JSON.stringify(user));
        return user;
      }),
    );
  }

  logout(): void {
    this.clearSession();
    void this.router.navigateByUrl('/login');
  }

  clearSession(): void {
    this.tokenState.set(null);
    this.userState.set(null);
    removeStorage(TOKEN_KEY);
    removeStorage(USER_KEY);
  }

  private saveSession(response: AuthResponse): void {
    this.tokenState.set(response.token);
    this.userState.set(response.user);
    writeStorage(TOKEN_KEY, response.token);
    writeStorage(USER_KEY, JSON.stringify(response.user));
  }
}