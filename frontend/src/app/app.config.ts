import { provideHttpClient, withInterceptors } from '@angular/common/http';
import {
  ApplicationConfig,
  inject,
  provideAppInitializer,
  provideBrowserGlobalErrorListeners,
} from '@angular/core';
import { provideRouter, withComponentInputBinding } from '@angular/router';
import { firstValueFrom } from 'rxjs';

import { routes } from './app.routes';
import { authInterceptor } from './core/auth.interceptor';
import { AuthService } from './core/auth.service';

export const appConfig: ApplicationConfig = {
  providers: [
    provideBrowserGlobalErrorListeners(),
    provideRouter(routes, withComponentInputBinding()),
    provideHttpClient(withInterceptors([authInterceptor])),
    // On start, refresh the stored user (and role). If it fails, drop the session.
    provideAppInitializer(() => {
      const auth = inject(AuthService);
      if (!auth.token()) {
        return Promise.resolve();
      }
      return firstValueFrom(auth.refresh())
        .then(() => undefined)
        .catch(() => auth.clearSession());
    }),
  ],
};