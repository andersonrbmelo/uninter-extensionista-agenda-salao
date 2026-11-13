import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { CreateStaffRequest, ResetPasswordRequest, StaffResponse } from './models';

@Injectable({ providedIn: 'root' })
export class StaffService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/staff`;

  /** Active professionals only, sorted by name. */
  list(): Observable<StaffResponse[]> {
    return this.http.get<StaffResponse[]>(this.baseUrl);
  }

  /** ADMIN only. Creates an active professional. */
  create(request: CreateStaffRequest): Observable<StaffResponse> {
    return this.http.post<StaffResponse>(this.baseUrl, request);
  }

  /** ADMIN only. Answers 204. */
  resetPassword(id: number, request: ResetPasswordRequest): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/password`, request);
  }

  /** ADMIN only. Answers 204; 409 while the professional has future bookings. */
  deactivate(id: number): Observable<void> {
    return this.http.patch<void>(`${this.baseUrl}/${id}/deactivate`, null);
  }
}