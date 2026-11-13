import { HttpErrorResponse, HttpInterceptorFn } from '@angular/common/http';
import { inject } from '@angular/core';
import { Router } from '@angular/router';
import { catchError, throwError } from 'rxjs';

import { environment } from '../../environments/environment';
import { AuthService } from './auth.service';

const PUBLIC_PATHS = ['/api/auth/login', '/api/auth/register'];

export const authInterceptor: HttpInterceptorFn = (req, next) => {
  // Only talk to our own API: never leak the token to other hosts.
  if (!req.url.startsWith(environment.apiUrl)) {
    return next(req);
  }

  const auth = inject(AuthService);
  const router = inject(Router);

  const isPublic = PUBLIC_PATHS.some((path) => req.url === `${environment.apiUrl}${path}`);
  const token = auth.token();
  const request =
    token && !isPublic ? req.clone({ setHeaders: { Authorization: `Bearer ${token}` } }) : req;

  return next(request).pipe(
    catchError((err: unknown) => {
      if (err instanceof HttpErrorResponse && err.status === 401 && !isPublic) {
        auth.clearSession();
        // Before the first navigation (app initializer) the guards send the user to /login.
        if (router.navigated) {
          void router.navigateByUrl('/login');
        }
      }
      // 403 does not redirect: the page shows the message.
      return throwError(() => err);
    }),
  );
};