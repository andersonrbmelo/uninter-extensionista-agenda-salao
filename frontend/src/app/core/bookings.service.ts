import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Booking, BookingRequest, PageResponse } from './models';

@Injectable({ providedIn: 'root' })
export class BookingsService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/bookings`;

  create(request: BookingRequest): Observable<Booking> {
    return this.http.post<Booking>(this.baseUrl, request);
  }

  /** Logged customer's bookings, newest first. */
  my(page = 0, size = 10): Observable<PageResponse<Booking>> {
    const params = new HttpParams().set('page', page).set('size', size);
    return this.http.get<PageResponse<Booking>>(`${this.baseUrl}/my`, { params });
  }

  cancel(id: number): Observable<Booking> {
    return this.http.patch<Booking>(`${this.baseUrl}/${id}/cancel`, null);
  }

  complete(id: number): Observable<Booking> {
    return this.http.patch<Booking>(`${this.baseUrl}/${id}/complete`, null);
  }

  /** Calendar feed. `from` and `to` are YYYY-MM-DD, both inclusive. Includes CANCELLED bookings. */
  calendar(from: string, to: string): Observable<Booking[]> {
    const params = new HttpParams().set('from', from).set('to', to);
    return this.http.get<Booking[]>(this.baseUrl, { params });
  }
}