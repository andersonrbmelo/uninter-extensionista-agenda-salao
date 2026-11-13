import { Routes } from '@angular/router';

import { authGuard, guestGuard, homeRedirectGuard, roleGuard } from './core/guards';

const staffOrAdmin = roleGuard('STAFF', 'ADMIN');
const adminOnly = roleGuard('ADMIN');

export const routes: Routes = [
  // Public route (outside the shell).
  {
    path: 'login',
    canActivate: [guestGuard],
    loadComponent: () => import('./features/auth/login.page').then((m) => m.LoginPage),
  },

  // "/" goes to /calendar (or /login).
  { path: '', pathMatch: 'full', canActivate: [homeRedirectGuard], children: [] },

  // Authenticated routes live inside the shell.
  {
    path: '',
    canActivate: [authGuard],
    loadComponent: () => import('./layout/shell').then((m) => m.Shell),
    children: [
      // STAFF and ADMIN
      {
        path: 'calendar',
        canActivate: [staffOrAdmin],
        loadComponent: () => import('./features/calendar/calendar.page').then((m) => m.CalendarPage),
      },
      {
        path: 'book',
        canActivate: [staffOrAdmin],
        loadComponent: () => import('./features/customer/book.page').then((m) => m.BookPage),
      },
      {
        path: 'customers',
        canActivate: [staffOrAdmin],
        loadComponent: () =>
          import('./features/admin/customers.page').then((m) => m.CustomersPage),
      },
      {
        path: 'customers/:id',
        canActivate: [staffOrAdmin],
        loadComponent: () =>
          import('./features/admin/customer-detail.page').then((m) => m.CustomerDetailPage),
      },

      // ADMIN only
      {
        path: 'admin/services',
        canActivate: [adminOnly],
        loadComponent: () => import('./features/admin/services.page').then((m) => m.ServicesPage),
      },
      // "new" must come before ":id" so it is not read as an id.
      {
        path: 'admin/services/new',
        canActivate: [adminOnly],
        loadComponent: () =>
          import('./features/admin/service-form.page').then((m) => m.ServiceFormPage),
      },
      {
        path: 'admin/services/:id',
        canActivate: [adminOnly],
        loadComponent: () =>
          import('./features/admin/service-form.page').then((m) => m.ServiceFormPage),
      },
      {
        path: 'admin/working-hours',
        canActivate: [adminOnly],
        loadComponent: () =>
          import('./features/admin/working-hours.page').then((m) => m.WorkingHoursPage),
      },
      {
        path: 'admin/staff',
        canActivate: [adminOnly],
        loadComponent: () => import('./features/admin/staff.page').then((m) => m.StaffPage),
      },
    ],
  },

  { path: '**', redirectTo: '' },
];