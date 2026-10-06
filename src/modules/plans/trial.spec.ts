import { TRIAL_DAYS, trialDaysLeft, trialEndsAtFrom } from './trial';

const DAY = 86_400_000;

describe('teste grátis', () => {
  it('dura os 30 dias que o cliente definiu', () => {
    expect(TRIAL_DAYS).toBe(30);
  });

  it('termina 30 dias depois do cadastro', () => {
    const cadastro = new Date('2026-10-06T12:00:00.000Z');
    expect(trialEndsAtFrom(cadastro).toISOString()).toBe('2026-11-05T12:00:00.000Z');
  });

  it('conta os dias que faltam', () => {
    const agora = new Date('2026-10-06T12:00:00.000Z');
    expect(trialDaysLeft(new Date(agora.getTime() + 10 * DAY), agora)).toBe(10);
  });

  it('arredonda para cima: o último dia ainda é um dia', () => {
    const agora = new Date('2026-10-06T12:00:00.000Z');
    expect(trialDaysLeft(new Date(agora.getTime() + 2 * 3_600_000), agora)).toBe(1);
  });

  it('zera quando o prazo passou', () => {
    const agora = new Date('2026-10-06T12:00:00.000Z');
    expect(trialDaysLeft(new Date(agora.getTime() - DAY), agora)).toBe(0);
    expect(trialDaysLeft(agora, agora)).toBe(0);
  });

  it('zera para quem não tem prazo gravado', () => {
    expect(trialDaysLeft(null)).toBe(0);
  });
});
