import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { WorkingHours } from './models';

export interface AvailabilityQuery {
  serviceId: number;
  priceOptionId: number;
  staffId: number;
  date: string; // YYYY-MM-DD
}

@Injectable({ providedIn: 'root' })
export class ScheduleService {
  private readonly http = inject(HttpClient);
  private readonly apiUrl = environment.apiUrl;

  /** Always 7 items, MONDAY to SUNDAY. */
  getWorkingHours(): Observable<WorkingHours[]> {
    return this.http.get<WorkingHours[]>(`${this.apiUrl}/api/working-hours`);
  }

  /** The body is a plain array with exactly 7 items. */
  saveWorkingHours(items: WorkingHours[]): Observable<WorkingHours[]> {
    return this.http.put<WorkingHours[]>(`${this.apiUrl}/api/working-hours`, items);
  }

  /** Selectable start times ("2026-11-16T09:00:00"), ascending. Send them back unchanged when booking. */
  getAvailability(query: AvailabilityQuery): Observable<string[]> {
    const params = new HttpParams()
      .set('serviceId', query.serviceId)
      .set('priceOptionId', query.priceOptionId)
      .set('staffId', query.staffId)
      .set('date', query.date);
    return this.http.get<string[]>(`${this.apiUrl}/api/availability`, { params });
  }
}