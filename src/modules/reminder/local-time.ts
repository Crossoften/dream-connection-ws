/** Hora e dia do usuário, no fuso dele — é o que o lembrete compara. */
export interface LocalNow {
  /** HH:mm */
  time: string;
  /** YYYY-MM-DD */
  day: string;
}

const FALLBACK_TZ = 'America/Sao_Paulo';

/**
 * Converte um instante para a hora local de um fuso IANA. Fuso inválido
 * (digitado errado, navegador exótico) cai em São Paulo em vez de derrubar o
 * agendador inteiro.
 */
export function localNow(timezone: string | null, now: Date = new Date()): LocalNow {
  let parts: Intl.DateTimeFormatPart[];
  try {
    parts = formatter(timezone || FALLBACK_TZ).formatToParts(now);
  } catch {
    parts = formatter(FALLBACK_TZ).formatToParts(now);
  }

  const get = (type: string) => parts.find((p) => p.type === type)?.value ?? '00';
  return {
    time: `${get('hour')}:${get('minute')}`,
    day: `${get('year')}-${get('month')}-${get('day')}`,
  };
}

function formatter(timeZone: string): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat('en-GB', {
    timeZone,
    hour12: false,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
  });
}

/** Minutos de atraso de `now` em relação a HH:mm, no mesmo dia. Negativo = ainda não chegou. */
export function minutesLate(reminderTime: string, current: string): number {
  return toMinutes(current) - toMinutes(reminderTime);
}

function toMinutes(hhmm: string): number {
  const [h, m] = hhmm.split(':');
  return Number(h) * 60 + Number(m);
}
