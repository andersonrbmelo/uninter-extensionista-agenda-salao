export type Role = 'ADMIN' | 'STAFF' | 'CUSTOMER';
export type BookingStatus = 'BOOKED' | 'COMPLETED' | 'CANCELLED';
export type DayOfWeek =
  | 'MONDAY' | 'TUESDAY' | 'WEDNESDAY' | 'THURSDAY' | 'FRIDAY' | 'SATURDAY' | 'SUNDAY';

export interface ErrorResponse { status: number; message: string; timestamp: string; }

export interface PageResponse<T> {
  content: T[];
  page: number;
  size: number;
  totalElements: number;
  totalPages: number;
}

// Auth
export interface UserSummary { id: number; name: string; email: string; role: Role; }
export interface AuthResponse { token: string; user: UserSummary; }
export interface LoginRequest { email: string; password: string; }

// Services
export interface PriceOption { id: number; label: string; price: number; durationMinutes: number; }
export interface StaffSummary { id: number; name: string; }
export interface SalonService {
  id: number; name: string; description: string | null; active: boolean;
  priceOptions: PriceOption[]; qualifiedStaff: StaffSummary[];
}
export interface PriceOptionRequest {
  id?: number | null; // omit/null = new option, filled = update that existing option
  label: string; price: number; durationMinutes: number;
}
export interface ServiceRequest {
  name: string; description?: string | null; active: boolean;
  priceOptions: PriceOptionRequest[]; staffIds: number[];
}

// Staff (customer types live in core/customers.service.ts)
export interface StaffResponse { id: number; name: string; email: string; phone: string | null; }
export interface CreateStaffRequest { name: string; email: string; password: string; phone: string; }
export interface ResetPasswordRequest { password: string; }

// Schedule
export interface WorkingHours {
  dayOfWeek: DayOfWeek; open: boolean;
  openTime: string | null; closeTime: string | null; // "HH:mm:ss", null on closed days
}

// Bookings
export interface BookingRequest {
  customerId: number; serviceId: number; priceOptionId: number; staffId: number;
  startTime: string; // "2026-11-16T09:00:00"
}
export interface Booking {
  id: number;
  customerId: number; customerName: string; customerPhone: string | null;
  staffId: number; staffName: string;
  serviceName: string; optionLabel: string; price: number; // snapshots taken at booking time
  startTime: string; endTime: string;
  status: BookingStatus;
  createdAt: string;
}