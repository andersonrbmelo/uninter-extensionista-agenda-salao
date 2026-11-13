import { ChangeDetectionStrategy, Component, computed, inject, signal } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NavigationEnd, Router, RouterLink, RouterLinkActive, RouterOutlet } from '@angular/router';
import { filter } from 'rxjs';

import { AuthService } from '../core/auth.service';

type NavIcon = 'calendar' | 'plus' | 'users';

interface NavItem {
  path: string;
  label: string;
  icon: NavIcon;
}

interface MoreItem {
  path: string;
  label: string;
}

const NAV_ITEMS: NavItem[] = [
  { path: '/calendar', label: 'Agenda', icon: 'calendar' },
  { path: '/book', label: 'Agendar', icon: 'plus' },
  { path: '/customers', label: 'Clientes', icon: 'users' },
];

const MORE_ITEMS: MoreItem[] = [
  { path: '/admin/services', label: 'Serviços' },
  { path: '/admin/working-hours', label: 'Horários' },
  { path: '/admin/staff', label: 'Profissionais' },
];

const NAV_ITEM_BASE =
  'flex min-h-14 flex-1 flex-col items-center justify-center gap-0.5 text-xs font-medium transition-colors focus:outline-none focus-visible:bg-slate-100';

const SHEET_ITEM_BASE =
  'flex min-h-12 items-center rounded-lg px-4 text-base font-medium transition-colors';

@Component({
  selector: 'app-shell',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [RouterLink, RouterLinkActive, RouterOutlet],
  host: {
    '(document:keydown.escape)': 'closeMore()',
  },
  template: `
    <header class="sticky top-0 z-20 border-b border-slate-200 bg-white">
      <div class="mx-auto flex w-full max-w-md items-center justify-between gap-3 px-4 py-2">
        <a
          routerLink="/calendar"
          class="inline-flex min-h-11 items-center text-lg font-bold text-rose-600"
        >
          Salão
        </a>

        <div class="flex min-w-0 items-center gap-3">
          @if (firstName(); as name) {
            <span class="truncate text-sm text-slate-600">{{ name }}</span>
          }
          <button type="button" class="btn btn-secondary" (click)="auth.logout()">Sair</button>
        </div>
      </div>
    </header>

    <main class="mx-auto w-full max-w-md pb-28">
      <router-outlet />
    </main>

    @if (moreOpen()) {
      <div class="fixed inset-0 z-30 bg-slate-900/40" aria-hidden="true" (click)="closeMore()"></div>

      <div class="fixed inset-x-0 z-30" style="bottom: calc(3.5rem + env(safe-area-inset-bottom))">
        <div class="mx-auto w-full max-w-md px-3 pb-2">
          <div class="rounded-xl border border-slate-200 bg-white p-2 shadow-lg">
            @for (item of moreItems; track item.path) {
              <a
                [routerLink]="item.path"
                routerLinkActive
                #sheetLink="routerLinkActive"
                [class]="sheetItemClass(sheetLink.isActive)"
                (click)="closeMore()"
              >
                {{ item.label }}
              </a>
            }
          </div>
        </div>
      </div>
    }

    <nav
      class="bottom-nav fixed inset-x-0 bottom-0 z-40 border-t border-slate-200 bg-white"
      aria-label="Navegação principal"
    >
      <div class="mx-auto flex w-full max-w-md">
        @for (item of navItems; track item.path) {
          <a
            [routerLink]="item.path"
            routerLinkActive
            #link="routerLinkActive"
            [class]="itemClass(link.isActive)"
            [attr.aria-current]="link.isActive ? 'page' : null"
            (click)="closeMore()"
          >
            @switch (item.icon) {
              @case ('calendar') {
                <svg
                  class="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <rect x="3" y="5" width="18" height="16" rx="2" />
                  <path d="M16 3v4M8 3v4M3 11h18" />
                </svg>
              }
              @case ('plus') {
                <svg
                  class="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="12" r="9" />
                  <path d="M12 8v8M8 12h8" />
                </svg>
              }
              @case ('users') {
                <svg
                  class="h-6 w-6"
                  viewBox="0 0 24 24"
                  fill="none"
                  stroke="currentColor"
                  stroke-width="1.8"
                  stroke-linecap="round"
                  stroke-linejoin="round"
                  aria-hidden="true"
                >
                  <circle cx="12" cy="8" r="4" />
                  <path d="M4 21a8 8 0 0 1 16 0" />
                </svg>
              }
            }
            <span>{{ item.label }}</span>
          </a>
        }

        @if (isAdmin()) {
          <button
            type="button"
            [class]="itemClass(moreHighlighted())"
            aria-haspopup="true"
            [attr.aria-expanded]="moreOpen()"
            (click)="toggleMore()"
          >
            <svg
              class="h-6 w-6"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              stroke-width="1.8"
              aria-hidden="true"
            >
              <circle cx="5" cy="12" r="1.5" fill="currentColor" />
              <circle cx="12" cy="12" r="1.5" fill="currentColor" />
              <circle cx="19" cy="12" r="1.5" fill="currentColor" />
            </svg>
            <span>Mais</span>
          </button>
        }
      </div>
    </nav>
  `,
})
export class Shell {
  protected readonly auth = inject(AuthService);
  private readonly router = inject(Router);

  protected readonly navItems = NAV_ITEMS;
  protected readonly moreItems = MORE_ITEMS;

  protected readonly moreOpen = signal(false);
  private readonly url = signal(this.router.url);

  protected readonly isAdmin = computed(() => this.auth.role() === 'ADMIN');

  protected readonly firstName = computed(
    () => this.auth.user()?.name.trim().split(/\s+/)[0] ?? '',
  );

  /** "Mais" is highlighted while the sheet is open and on every /admin/* page. */
  protected readonly moreHighlighted = computed(
    () => this.moreOpen() || this.url().startsWith('/admin'),
  );

  constructor() {
    this.router.events
      .pipe(
        filter((event): event is NavigationEnd => event instanceof NavigationEnd),
        takeUntilDestroyed(),
      )
      .subscribe((event) => {
        this.url.set(event.urlAfterRedirects);
        this.moreOpen.set(false);
      });
  }

  protected toggleMore(): void {
    this.moreOpen.update((open) => !open);
  }

  protected closeMore(): void {
    this.moreOpen.set(false);
  }

  protected itemClass(active: boolean): string {
    return `${NAV_ITEM_BASE} ${active ? 'text-rose-600' : 'text-slate-500'}`;
  }

  protected sheetItemClass(active: boolean): string {
    return `${SHEET_ITEM_BASE} ${active ? 'bg-rose-50 text-rose-700' : 'text-slate-700 active:bg-slate-100'}`;
  }
}