import { HttpClient } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { SalonService, ServiceRequest } from './models';

@Injectable({ providedIn: 'root' })
export class CatalogService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/services`;

  /** Active services only, sorted by name. */
  list(): Observable<SalonService[]> {
    return this.http.get<SalonService[]>(this.baseUrl);
  }

  /** Also returns inactive services. */
  get(id: number): Observable<SalonService> {
    return this.http.get<SalonService>(`${this.baseUrl}/${id}`);
  }

  create(request: ServiceRequest): Observable<SalonService> {
    return this.http.post<SalonService>(this.baseUrl, request);
  }

  update(id: number, request: ServiceRequest): Observable<SalonService> {
    return this.http.put<SalonService>(`${this.baseUrl}/${id}`, request);
  }

  /** Soft delete (sets active=false). */
  remove(id: number): Observable<void> {
    return this.http.delete<void>(`${this.baseUrl}/${id}`);
  }
}