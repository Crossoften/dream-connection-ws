import { localNow, minutesLate } from './local-time';

describe('hora local do usuário', () => {
  it('converte o instante para o fuso dele', () => {
    // 10:00 UTC é 07:00 em São Paulo (UTC-3).
    const out = localNow('America/Sao_Paulo', new Date('2026-10-06T10:00:00.000Z'));
    expect(out.time).toBe('07:00');
    expect(out.day).toBe('2026-10-06');
  });

  it('o dia vira no fuso do usuário, não no do servidor', () => {
    // 02:00 UTC do dia 7 ainda é 23:00 do dia 6 em São Paulo.
    const out = localNow('America/Sao_Paulo', new Date('2026-10-07T02:00:00.000Z'));
    expect(out.day).toBe('2026-10-06');
    expect(out.time).toBe('23:00');
  });

  it('atende quem está em outro fuso', () => {
    const out = localNow('Europe/Lisbon', new Date('2026-10-06T10:00:00.000Z'));
    expect(out.time).toBe('11:00');
  });

  it('fuso inválido cai em São Paulo em vez de derrubar o agendador', () => {
    const out = localNow('Marte/Olympus', new Date('2026-10-06T10:00:00.000Z'));
    expect(out.time).toBe('07:00');
  });

  it('sem fuso gravado, também cai em São Paulo', () => {
    expect(localNow(null, new Date('2026-10-06T10:00:00.000Z')).time).toBe('07:00');
  });

  it('mede o atraso em relação à hora marcada', () => {
    expect(minutesLate('07:00', '07:00')).toBe(0);
    expect(minutesLate('07:00', '07:08')).toBe(8);
    expect(minutesLate('07:00', '06:59')).toBe(-1);
  });
});
