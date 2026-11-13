import { DayOfWeek, Role } from './models';

const moneyFormat = new Intl.NumberFormat('pt-BR', { style: 'currency', currency: 'BRL' });

export function formatMoney(value: number): string {
  return moneyFormat.format(value);
}

/** 90 -> "1h 30min", 60 -> "1h", 45 -> "45min". */
export function formatDuration(minutes: number): string {
  const hours = Math.floor(minutes / 60);
  const rest = minutes % 60;
  if (hours === 0) {
    return `${rest}min`;
  }
  if (rest === 0) {
    return `${hours}h`;
  }
  return `${hours}h ${rest}min`;
}

export const ROLE_LABELS: Record<Role, string> = {
  CUSTOMER: 'Cliente',
  STAFF: 'Profissional',
  ADMIN: 'Administrador',
};

export const DAY_LABELS: Record<DayOfWeek, string> = {
  MONDAY: 'Segunda-feira',
  TUESDAY: 'Terça-feira',
  WEDNESDAY: 'Quarta-feira',
  THURSDAY: 'Quinta-feira',
  FRIDAY: 'Sexta-feira',
  SATURDAY: 'Sábado',
  SUNDAY: 'Domingo',
};

/** Translates an API day name; unknown values are returned unchanged. */
export function dayLabel(value: string): string {
  return value in DAY_LABELS ? DAY_LABELS[value as DayOfWeek] : value;
}