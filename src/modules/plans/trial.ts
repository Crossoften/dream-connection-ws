/**
 * Teste grátis: 30 dias contados do cadastro, como o cliente definiu em
 * 05/10/2026 ("30 dias gratuito. Após, cobraremos").
 */
export const TRIAL_DAYS = 30;

const DAY_MS = 86_400_000;

/** Fim do teste de quem se cadastra agora. */
export function trialEndsAtFrom(start: Date = new Date()): Date {
  return new Date(start.getTime() + TRIAL_DAYS * DAY_MS);
}

/** Dias que ainda faltam do teste — 0 quando já acabou ou nunca houve. */
export function trialDaysLeft(trialEndsAt: Date | null, now: Date = new Date()): number {
  if (!trialEndsAt) return 0;
  const left = trialEndsAt.getTime() - now.getTime();
  return left <= 0 ? 0 : Math.ceil(left / DAY_MS);
}
