import { inject } from '@angular/core';
import { CanActivateFn, Router } from '@angular/router';

import { AuthService, homeForRole } from './auth.service';
import { Role } from './models';

/** Must be logged in. */
export const authGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? true : router.createUrlTree(['/login']);
};

/** Login/register only for logged-out users. */
export const guestGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return auth.isAuthenticated() ? router.parseUrl(homeForRole(auth.role())) : true;
};

/** Only the given roles; anyone else goes to the home of their own role. */
export function roleGuard(...roles: Role[]): CanActivateFn {
  return () => {
    const auth = inject(AuthService);
    const router = inject(Router);
    const role = auth.role();
    if (!auth.isAuthenticated() || role === null) {
      return router.createUrlTree(['/login']);
    }
    return roles.includes(role) ? true : router.parseUrl(homeForRole(role));
  };
}

/** Used by the `/` route: sends the user to the home of the role (or /login). */
export const homeRedirectGuard: CanActivateFn = () => {
  const auth = inject(AuthService);
  const router = inject(Router);
  return router.parseUrl(auth.isAuthenticated() ? homeForRole(auth.role()) : '/login');
};