import type { CustomerSummary } from './customers.service';
import { toDateString } from './date-utils';

const CRLF = '\r\n';
// RFC 2426: content lines should be folded at 75 octets (the continuation space counts).
const MAX_LINE_BYTES = 75;
const encoder = new TextEncoder();

/** Escapes a vCard text value: backslash, semicolon, comma and line breaks. */
function escapeText(value: string): string {
  return value
    .replace(/\\/g, '\\\\')
    .replace(/\r?\n/g, '\\n')
    .replace(/;/g, '\\;')
    .replace(/,/g, '\\,');
}

/** Folds a long line without splitting a multi-byte (UTF-8) character. */
function foldLine(line: string): string {
  const parts: string[] = [];
  let current = '';
  let bytes = 0;
  let limit = MAX_LINE_BYTES;

  for (const char of line) {
    const size = encoder.encode(char).length;
    if (bytes + size > limit) {
      parts.push(current);
      current = '';
      bytes = 0;
      limit = MAX_LINE_BYTES - 1;
    }
    current += char;
    bytes += size;
  }
  parts.push(current);

  return parts.join(`${CRLF} `);
}

function buildVCard(customer: CustomerSummary): string {
  const name = escapeText(customer.name.trim());
  const lines = ['BEGIN:VCARD', 'VERSION:3.0', `N:;${name};;;`, `FN:${name}`];

  const digits = customer.phone?.replace(/\D/g, '') ?? '';
  if (digits) {
    // Stored phones are Brazilian numbers without the country code.
    lines.push(`TEL;TYPE=${digits.length === 11 ? 'CELL' : 'VOICE'}:+55${digits}`);
  }

  const email = customer.email?.trim();
  if (email) {
    lines.push(`EMAIL;TYPE=INTERNET:${escapeText(email)}`);
  }

  lines.push('END:VCARD');
  return lines.map(foldLine).join(CRLF) + CRLF;
}

/** vCard 3.0 text with one card per customer (name, phone and e-mail only). */
export function buildVCards(customers: readonly CustomerSummary[]): string {
  return customers.map(buildVCard).join('');
}

/** "clientes-2026-11-11.vcf" (local date). */
export function vcardFileName(date: Date = new Date()): string {
  return `clientes-${toDateString(date)}.vcf`;
}

/** Starts the browser download of a .vcf file. */
export function downloadVCard(content: string, fileName: string): void {
  const blob = new Blob([content], { type: 'text/vcard;charset=utf-8' });
  const url = URL.createObjectURL(blob);

  const link = document.createElement('a');
  link.href = url;
  link.download = fileName;
  link.style.display = 'none';
  document.body.appendChild(link);
  link.click();
  link.remove();

  setTimeout(() => URL.revokeObjectURL(url), 1000);
}