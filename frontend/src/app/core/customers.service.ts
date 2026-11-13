import { HttpClient, HttpParams } from '@angular/common/http';
import { Injectable, inject } from '@angular/core';
import { Observable } from 'rxjs';

import { environment } from '../../environments/environment';
import { Booking, PageResponse } from './models';

export interface CustomerSummary {
  id: number;
  name: string;
  email: string | null;
  phone: string | null; // digits only
  createdAt: string;
}

export interface CustomerDetail extends CustomerSummary {
  allergies: string | null;
  notes: string | null;
  bookings: Booking[]; // newest first, all statuses, NOT paginated
}

export interface CustomerRequest {
  name: string;
  phone: string;
  email?: string;
  allergies?: string;
  notes?: string;
}

export interface CustomerListQuery {
  search?: string;
  page?: number;
  size?: number;
}

// Brazilian phone: area code without leading 0 + 9-digit mobile or 8-digit landline.
const PHONE_PATTERN = /^[1-9][0-9](9[0-9]{8}|[0-9]{8})$/;

/** Keeps digits only; drops a leading 55 only when 12 or 13 digits remain. */
export function normalizePhone(raw: string): string {
  const digits = raw.replace(/\D/g, '');
  if ((digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
    return digits.slice(2);
  }
  return digits;
}

/** Expects an already normalised value. */
export function isValidPhone(normalized: string): boolean {
  return PHONE_PATTERN.test(normalized);
}

/** "81999998888" -> "(81) 99999-8888"; "8133334444" -> "(81) 3333-4444"; empty -> "—". */
export function formatPhone(digits: string | null | undefined): string {
  if (!digits) {
    return '—';
  }
  if (digits.length === 11) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 7)}-${digits.slice(7)}`;
  }
  if (digits.length === 10) {
    return `(${digits.slice(0, 2)}) ${digits.slice(2, 6)}-${digits.slice(6)}`;
  }
  return digits;
}

export function telUrl(digits: string): string {
  return `tel:${digits}`;
}

export function whatsappUrl(digits: string): string {
  return `https://wa.me/55${digits}`;
}

@Injectable({ providedIn: 'root' })
export class CustomersService {
  private readonly http = inject(HttpClient);
  private readonly baseUrl = `${environment.apiUrl}/api/customers`;

  /** Paginated, sorted by name. `search` matches name, e-mail or phone digits. */
  list(query: CustomerListQuery = {}): Observable<PageResponse<CustomerSummary>> {
    let params = new HttpParams();
    const search = query.search?.trim();
    if (search) {
      params = params.set('search', search);
    }
    if (query.page !== undefined) {
      params = params.set('page', query.page);
    }
    if (query.size !== undefined) {
      params = params.set('size', query.size);
    }
    return this.http.get<PageResponse<CustomerSummary>>(this.baseUrl, { params });
  }

  /** Customer with the full booking history (newest first, not paginated). */
  get(id: number): Observable<CustomerDetail> {
    return this.http.get<CustomerDetail>(`${this.baseUrl}/${id}`);
  }

  create(request: CustomerRequest): Observable<CustomerSummary> {
    return this.http.post<CustomerSummary>(this.baseUrl, request);
  }
}