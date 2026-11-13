import { whatsappUrl } from './customers.service';
import { formatTime, parseDateString } from './date-utils';
import { Booking } from './models';

const weekdayFormat = new Intl.DateTimeFormat('pt-BR', { weekday: 'long' });
const dayMonthFormat = new Intl.DateTimeFormat('pt-BR', { day: '2-digit', month: '2-digit' });

/** "segunda-feira" -> "segunda". */
function shortWeekday(date: Date): string {
  return weekdayFormat.format(date).split('-')[0];
}

function firstName(fullName: string): string {
  return fullName.trim().split(/\s+/)[0] ?? '';
}

/** Builds the reminder text sent to the customer (pt-BR). */
export function reminderMessage(booking: Booking): string {
  // startTime is a salon-local string: its first 10 chars are the local date.
  const day = parseDateString(booking.startTime.slice(0, 10));
  const when = `${shortWeekday(day)}, ${dayMonthFormat.format(day)} às ${formatTime(booking.startTime)}`;
  const name = firstName(booking.customerName);
  const greeting = name ? `Olá, ${name}!` : 'Olá!';

  return (
    `${greeting} Passando para lembrar do seu agendamento de ` +
    `${booking.serviceName} (${booking.optionLabel}) com ${booking.staffName}, ${when}. ` +
    'Qualquer imprevisto, é só avisar.'
  );
}

/** WhatsApp link with the reminder already typed in. */
export function reminderUrl(booking: Booking, phone: string): string {
  return `${whatsappUrl(phone)}?text=${encodeURIComponent(reminderMessage(booking))}`;
}