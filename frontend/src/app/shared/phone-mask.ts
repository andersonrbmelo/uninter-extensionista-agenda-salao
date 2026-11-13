import { AfterViewInit, DestroyRef, Directive, HostListener, inject } from '@angular/core';
import { takeUntilDestroyed } from '@angular/core/rxjs-interop';
import { NgControl } from '@angular/forms';

const MOBILE_DIGITS = 11; // area code + 9 digits
const LANDLINE_DIGITS = 10; // area code + 8 digits

function onlyDigits(value: string): string {
  return value.replace(/\D/g, '');
}

/**
 * Formats a Brazilian phone number while the user types it:
 * (81) 98888-8888 for mobile, (81) 3333-4444 for landline.
 * The form control keeps the formatted text; submit code must still send
 * the digits only (normalizePhone).
 */
@Directive({
  selector: 'input[appPhoneMask]',
})
export class PhoneMask implements AfterViewInit {
  private readonly ngControl = inject(NgControl, { optional: true, self: true });
  private readonly destroyRef = inject(DestroyRef);

  private previous = '';
  private pasted = false;

  @HostListener('paste')
  protected onPaste(): void {
    this.pasted = true;
  }

  ngAfterViewInit(): void {
    const control = this.ngControl?.control;
    if (!control) {
      return;
    }
    this.apply(control.value);
    control.valueChanges
      .pipe(takeUntilDestroyed(this.destroyRef))
      .subscribe((value) => this.apply(value));
  }

  private apply(value: unknown): void {
    const raw = typeof value === 'string' ? value : '';
    const formatted = this.format(raw);

    this.pasted = false;
    this.previous = formatted;

    if (formatted !== raw) {
      // Writes the formatted text back into the input and notifies the other
      // subscribers with the final value (this call runs apply() once more,
      // but formatting is idempotent, so it stops there).
      this.ngControl?.control?.setValue(formatted);
    }
  }

  private format(raw: string): string {
    let digits = onlyDigits(raw);

    // The user erased only a formatting character, e.g. "(81) " -> "(81)":
    // treat it as erasing the last digit, otherwise the mask would put it back.
    if (raw.length < this.previous.length && digits === onlyDigits(this.previous)) {
      digits = digits.slice(0, -1);
    }

    // Pasted with the country code (+55): drop it, like the backend does.
    if (this.pasted && (digits.length === 12 || digits.length === 13) && digits.startsWith('55')) {
      digits = digits.slice(2);
    }

    const limit = digits.length >= 3 && digits[2] !== '9' ? LANDLINE_DIGITS : MOBILE_DIGITS;
    digits = digits.slice(0, limit);

    if (digits.length === 0) {
      return '';
    }
    const area = digits.slice(0, 2);
    if (digits.length === 1) {
      return `(${area}`;
    }

    const rest = digits.slice(2);
    if (rest.length === 0) {
      return `(${area}) `;
    }
    const split = rest[0] === '9' ? 5 : 4;
    return rest.length <= split
      ? `(${area}) ${rest}`
      : `(${area}) ${rest.slice(0, split)}-${rest.slice(split)}`;
  }
}