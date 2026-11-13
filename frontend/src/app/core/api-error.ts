import { HttpErrorResponse } from '@angular/common/http';
import { dayLabel } from './format';

const NETWORK_ERROR = 'Não foi possível conectar ao servidor.';
const UNEXPECTED_ERROR = 'Ocorreu um erro inesperado.';

// Exact-match dictionary: every message listed in API.md / API-v2.md that has no variable part.
const DICTIONARY = new Map<string, string>([
  // Generic
  ['Access is denied', 'Você não tem permissão para realizar esta ação.'],
  ['Unexpected error', UNEXPECTED_ERROR],
  ['Malformed or invalid request body', 'Requisição inválida. Verifique os dados informados.'],

  // Auth
  ['Invalid email or password', 'E-mail ou senha inválidos.'],
  ['Registration is disabled', 'O cadastro de contas está desativado.'],
  ['Email is already registered', 'E-mail já cadastrado.'],
  ['Email is required', 'E-mail é obrigatório.'],
  ['Invalid email', 'E-mail inválido.'],
  ['Name is required', 'Nome é obrigatório.'],
  ['Name must have at most 100 characters', 'O nome pode ter até 100 caracteres.'],
  ['Password is required', 'Senha é obrigatória.'],
  ['Password must have between 6 and 72 characters', 'A senha deve ter entre 6 e 72 caracteres.'],

  // Phone and customer fields
  ['Phone is required', 'Telefone é obrigatório.'],
  ['Invalid phone number', 'Telefone inválido. Use DDD + número, ex.: (81) 99999-8888.'],
  ['Allergies must have at most 2000 characters', 'Alergias: máximo de 2000 caracteres.'],
  ['Notes must have at most 2000 characters', 'Observações: máximo de 2000 caracteres.'],

  // Services
  ['Active flag is required', 'Informe se o serviço está ativo.'],
  ['At least one price option is required', 'Informe ao menos uma opção de preço.'],
  ['Price option label is required', 'O rótulo da opção de preço é obrigatório.'],
  ['Price is required', 'O preço é obrigatório.'],
  ['Price cannot be negative', 'O preço não pode ser negativo.'],
  ['Duration is required', 'A duração é obrigatória.'],
  ['Duration must be at least 1 minute', 'A duração deve ser de pelo menos 1 minuto.'],
  ['staffIds is required (use an empty list for none)', 'Informe a lista de profissionais.'],
  ['One or more staffIds do not exist', 'Um ou mais profissionais não existem.'],
  ['Service not found', 'Serviço não encontrado.'],
  ['Service is not active', 'O serviço não está ativo.'],
  ['Price option does not belong to this service', 'A opção de preço não pertence a este serviço.'],

  // Staff
  ['User is not a staff member', 'O usuário não é profissional.'],
  ['Staff member not found', 'Profissional não encontrado.'],
  ['Staff member has future bookings', 'O profissional possui agendamentos futuros.'],
  ['Staff member is not qualified for this service', 'O profissional não está qualificado para este serviço.'],

  // Customers
  ['Customer not found', 'Cliente não encontrado.'],

  // Working hours
  [
    'Exactly 7 items are required, one for each day of the week',
    'São necessários exatamente 7 itens, um para cada dia da semana.',
  ],
  ['Each item needs dayOfWeek and open', 'Cada item precisa do dia da semana e se está aberto.'],

  // Bookings
  ['customerId is required', 'Cliente é obrigatório.'],
  ['serviceId is required', 'Serviço é obrigatório.'],
  ['priceOptionId is required', 'Opção de preço é obrigatória.'],
  ['staffId is required', 'Profissional é obrigatório.'],
  ['startTime is required', 'Horário é obrigatório.'],
  ['Selected time slot is not available', 'Esse horário não está mais disponível.'],
  ['Booking not found', 'Agendamento não encontrado.'],
  ['You can only create bookings for yourself', 'Você só pode criar agendamentos para si mesmo(a).'],
  ['You cannot cancel this booking', 'Você não pode cancelar este agendamento.'],
  ['You cannot complete this booking', 'Você não pode concluir este agendamento.'],
  ['Booking is already COMPLETED', 'O agendamento já foi concluído.'],
  ['Booking is already CANCELLED', 'O agendamento já foi cancelado.'],
  ["'to' must not be before 'from'", 'A data final não pode ser anterior à data inicial.'],
]);

// Messages that contain names, ids or parameters.
const PATTERNS: { pattern: RegExp; build: (match: RegExpExecArray) => string }[] = [
  {
    pattern: /^User (\d+) is not a staff member$/,
    build: (m) => `O usuário ${m[1]} não é profissional.`,
  },
  {
    pattern: /^Price option (\d+) does not belong to this service$/,
    build: (m) => `A opção de preço ${m[1]} não pertence a este serviço.`,
  },
  {
    pattern: /^Price option '(.+)' has bookings and cannot be removed$/,
    build: (m) => `A opção '${m[1]}' possui agendamentos e não pode ser removida.`,
  },
  {
    pattern: /^Duplicate day: (\w+)$/,
    build: (m) => `Dia duplicado: ${dayLabel(m[1])}.`,
  },
  {
    pattern: /^Open days need openTime before closeTime \((\w+)\)$/,
    build: (m) => `${dayLabel(m[1])}: o horário de abertura deve ser antes do fechamento.`,
  },
  {
    pattern: /^Missing required parameter: (\w+)$/,
    build: (m) => `Parâmetro obrigatório ausente: ${m[1]}.`,
  },
  {
    pattern: /^Invalid value for parameter '(\w+)'$/,
    build: (m) => `Valor inválido para o parâmetro '${m[1]}'.`,
  },
];

// Validation errors arrive as "field: message; otherField: message".
const FIELD_PREFIX = /^[\w.[\]]+:\s+/;

function lookup(text: string): string | null {
  const exact = DICTIONARY.get(text);
  if (exact) {
    return exact;
  }
  for (const { pattern, build } of PATTERNS) {
    const match = pattern.exec(text);
    if (match) {
      return build(match);
    }
  }
  return null;
}

function translateMessage(message: string): string {
  const whole = lookup(message.trim());
  if (whole) {
    return whole;
  }

  const parts = message
    .split('; ')
    .map((part) => part.replace(FIELD_PREFIX, '').trim())
    .filter((part) => part.length > 0)
    .map((part) => lookup(part) ?? part);

  return [...new Set(parts)].join(' ');
}

function hasMessage(body: unknown): body is { message: string } {
  return (
    typeof body === 'object' &&
    body !== null &&
    typeof (body as { message?: unknown }).message === 'string'
  );
}

/** Turns any HTTP error into a pt-BR message that is safe to show to the user. */
export function apiErrorMessage(err: unknown): string {
  if (!(err instanceof HttpErrorResponse)) {
    return UNEXPECTED_ERROR;
  }
  if (err.status === 0) {
    return NETWORK_ERROR;
  }
  if (hasMessage(err.error)) {
    const translated = translateMessage(err.error.message);
    return translated.length > 0 ? translated : UNEXPECTED_ERROR;
  }
  return UNEXPECTED_ERROR;
}