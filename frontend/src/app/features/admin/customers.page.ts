import {
  ChangeDetectionStrategy,
  Component,
  DestroyRef,
  computed,
  inject,
  signal,
} from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { FormControl, ReactiveFormsModule } from '@angular/forms';
import { RouterLink } from '@angular/router';
import { EMPTY, Observable, Subscription, debounceTime, expand, filter, map, reduce } from 'rxjs';

import { apiErrorMessage } from '../../core/api-error';
import {
  CustomerSummary,
  CustomersService,
  formatPhone,
  telUrl,
  whatsappUrl,
} from '../../core/customers.service';
import { PageResponse } from '../../core/models';
import { buildVCards, downloadVCard, vcardFileName } from '../../core/vcard';
import { Alert } from '../../shared/alert';
import { CustomerQuickCreate } from '../../shared/customer-quick-create';
import { Pagination } from '../../shared/pagination';

const PAGE_SIZE = 20;
// The API accepts at most 100 items per page.
const EXPORT_PAGE_SIZE = 100;

@Component({
  selector: 'app-customers-page',
  changeDetection: ChangeDetectionStrategy.OnPush,
  imports: [ReactiveFormsModule, RouterLink, Alert, Pagination, CustomerQuickCreate],
  template: `
    <div class="px-4 py-4">
      <div class="flex items-center justify-between gap-3">
        <h1 class="text-2xl font-semibold text-slate-900">Clientes</h1>
        @if (!creating()) {
          <button type="button" class="btn btn-primary" (click)="openCreate()">
            Novo cliente
          </button>
        }
      </div>

      @if (creating()) {
        <div class="mt-4">
          <app-customer-quick-create (created)="onCreated($event)" (cancelled)="closeCreate()" />
        </div>
      }

      <div class="mt-4">
        <label class="sr-only" for="customer-search">Buscar por nome ou telefone</label>
        <input
          id="customer-search"
          type="search"
          class="input"
          [formControl]="searchControl"
          placeholder="Buscar por nome ou telefone"
          autocomplete="off"
          autocapitalize="none"
          enterkeyhint="search"
          (keydown.enter)="searchNow($event)"
        />
      </div>

      <div class="mt-3">
        <button
          type="button"
          class="btn btn-secondary w-full"
          [disabled]="!canExport()"
          (click)="exportContacts()"
        >
          {{ exporting() ? 'Exportando...' : 'Exportar contatos' }}
        </button>
        <p class="mt-1 text-xs text-slate-500">
          Baixa todos os clientes em um arquivo .vcf para importar nos contatos do celular.
        </p>
      </div>

      <div class="mt-4 space-y-3">
        <app-alert type="success" [message]="success()" />
        <app-alert type="error" [message]="error()" />
      </div>

      @if (data(); as result) {
        @if (result.content.length === 0) {
          <p class="mt-6 text-sm text-slate-600">
            {{ activeSearch() ? 'Nenhum cliente encontrado.' : 'Nenhum cliente cadastrado.' }}
          </p>
        } @else {
          <p class="mt-4 text-sm text-slate-600">
            {{ result.totalElements }}
            {{ result.totalElements === 1 ? 'cliente' : 'clientes' }}
          </p>

          <ul class="mt-2 space-y-3" [class.opacity-60]="loading()">
            @for (customer of result.content; track customer.id) {
              <li class="card relative">
                <a
                  [routerLink]="['/customers', customer.id]"
                  class="block min-h-11 after:absolute after:inset-0 after:content-['']"
                >
                  <span class="block break-words font-medium text-slate-900">
                    {{ customer.name }}
                  </span>
                  <span class="block text-sm text-slate-600">{{ formatPhone(customer.phone) }}</span>
                </a>

                <div class="relative z-10 mt-3 space-y-2">
                  <a
                    class="btn btn-primary w-full"
                    routerLink="/book"
                    [queryParams]="{ customerId: customer.id }"
                  >
                    Agendar
                  </a>

                  @if (customer.phone; as phone) {
                    <div class="grid grid-cols-2 gap-2">
                      <a class="btn btn-secondary" [href]="telUrl(phone)">Ligar</a>
                      <a
                        class="btn btn-secondary"
                        [href]="whatsappUrl(phone)"
                        target="_blank"
                        rel="noopener"
                      >
                        WhatsApp
                      </a>
                    </div>
                  }
                </div>
              </li>
            }
          </ul>

          <div class="mt-4">
            <app-pagination [response]="result" [disabled]="loading()" (pageChange)="load($event)" />
          </div>
        }
      } @else if (loading()) {
        <p class="mt-6 text-sm text-slate-600" role="status">Carregando clientes...</p>
      } @else {
        <div class="mt-6">
          <button type="button" class="btn btn-secondary" (click)="load(0)">
            Tentar novamente
          </button>
        </div>
      }
    </div>
  `,
})
export class CustomersPage {
  private readonly customersService = inject(CustomersService);
  private readonly destroyRef = inject(DestroyRef);

  private subscription: Subscription | null = null;

  protected readonly searchControl = new FormControl('', { nonNullable: true });

  protected readonly data = signal<PageResponse<CustomerSummary> | null>(null);
  protected readonly loading = signal(false);
  protected readonly error = signal<string | null>(null);
  protected readonly success = signal<string | null>(null);
  protected readonly creating = signal(false);
  protected readonly exporting = signal(false);
  /** The term used by the last search (what the list on screen refers to). */
  protected readonly activeSearch = signal('');

  /** Disabled while exporting or when the registry is known to be empty. */
  protected readonly canExport = computed(() => {
    if (this.exporting()) {
      return false;
    }
    const result = this.data();
    return !(result && !this.activeSearch() && result.totalElements === 0);
  });

  protected readonly formatPhone = formatPhone;
  protected readonly telUrl = telUrl;
  protected readonly whatsappUrl = whatsappUrl;

  constructor() {
    this.searchControl.valueChanges
      .pipe(
        debounceTime(300),
        map((value) => value.trim()),
        filter((term) => term !== this.activeSearch()),
        takeUntilDestroyed(),
      )
      .subscribe((term) => this.applySearch(term));

    this.destroyRef.onDestroy(() => this.subscription?.unsubscribe());
    this.load(0);
  }

  protected openCreate(): void {
    this.success.set(null);
    this.creating.set(true);
  }

  protected closeCreate(): void {
    this.creating.set(false);
  }

  protected onCreated(customer: CustomerSummary): void {
    this.creating.set(false);
    this.success.set(`Cliente ${customer.name} cadastrado com sucesso.`);
    this.load(0);
  }

  /** Enter skips the debounce and closes the on-screen keyboard. */
  protected searchNow(event: Event): void {
    const term = this.searchControl.value.trim();
    if (term !== this.activeSearch()) {
      this.applySearch(term);
    }
    (event.target as HTMLInputElement).blur();
  }

  protected load(page: number): void {
    this.subscription?.unsubscribe();
    this.loading.set(true);
    this.error.set(null);
    this.subscription = this.customersService
      .list({ search: this.activeSearch(), page, size: PAGE_SIZE })
      .subscribe({
        next: (result) => {
          this.data.set(result);
          this.loading.set(false);
        },
        error: (err: unknown) => {
          this.error.set(apiErrorMessage(err));
          this.loading.set(false);
        },
      });
  }

  /** Downloads every customer (not only the current search) as a .vcf file. */
  protected exportContacts(): void {
    if (this.exporting()) {
      return;
    }
    this.exporting.set(true);
    this.error.set(null);
    this.success.set(null);

    this.fetchAllCustomers()
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe({
        next: (customers) => {
          this.exporting.set(false);
          if (customers.length === 0) {
            this.error.set('Nenhum cliente para exportar.');
            return;
          }
          downloadVCard(buildVCards(customers), vcardFileName());
          const total = customers.length;
          this.success.set(`${total} ${total === 1 ? 'contato exportado' : 'contatos exportados'}.`);
        },
        error: (err: unknown) => {
          this.error.set(apiErrorMessage(err));
          this.exporting.set(false);
        },
      });
  }

  private fetchAllCustomers(): Observable<CustomerSummary[]> {
    const fetchPage = (page: number) =>
      this.customersService.list({ page, size: EXPORT_PAGE_SIZE });

    return fetchPage(0).pipe(
      expand((result) => (result.page + 1 < result.totalPages ? fetchPage(result.page + 1) : EMPTY)),
      reduce((all, result) => all.concat(result.content), [] as CustomerSummary[]),
    );
  }

  private applySearch(term: string): void {
    this.activeSearch.set(term);
    this.success.set(null);
    this.load(0);
  }
}