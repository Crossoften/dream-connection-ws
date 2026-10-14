import { ReminderService } from './reminder.service';

/** 10:00 UTC = 07:00 em São Paulo. */
const DEZ_UTC = new Date('2026-10-06T10:00:00.000Z');

const INSCRICAO = { endpoint: 'https://push.exemplo/abc', p256dh: 'p', auth: 'a' };

function cenario(overrides: any = {}, push: any = {}) {
  const user = {
    id: 1,
    name: 'Sonhador Teste',
    reminderTime: '07:00',
    reminderTimezone: 'America/Sao_Paulo',
    reminderSentOn: null,
    pushSubscriptions: [INSCRICAO],
    ...overrides,
  };

  const prisma = {
    user: {
      findMany: jest.fn().mockResolvedValue([user]),
      update: jest.fn().mockResolvedValue(user),
    },
    pushSubscription: { deleteMany: jest.fn().mockResolvedValue({ count: 1 }) },
  } as any;

  const pushService = {
    configured: true,
    send: jest.fn().mockResolvedValue(true),
    ...push,
  } as any;

  return { prisma, pushService, service: new ReminderService(prisma, pushService) };
}

describe('disparo do lembrete', () => {
  it('manda na hora marcada e anota o dia, para não repetir', async () => {
    const { service, prisma, pushService } = cenario();

    expect(await service.dispatchDue(DEZ_UTC)).toBe(1);
    expect(pushService.send).toHaveBeenCalledTimes(1);
    expect(prisma.user.update).toHaveBeenCalledWith({
      where: { id: 1 },
      data: { reminderSentOn: '2026-10-06' },
    });
  });

  it('aponta para a tela de contar o sonho, relativa ao app (sem barra inicial)', async () => {
    const { service, pushService } = cenario();

    await service.dispatchDue(DEZ_UTC);

    const payload = pushService.send.mock.calls[0][1];
    // Com barra inicial o clique caía na raiz do domínio, fora do app (card #459).
    expect(payload.url).toBe('#/capturar');
    expect(payload.url.startsWith('/')).toBe(false);
  });

  it('não manda duas vezes no mesmo dia', async () => {
    const { service, pushService } = cenario({ reminderSentOn: '2026-10-06' });

    expect(await service.dispatchDue(DEZ_UTC)).toBe(0);
    expect(pushService.send).not.toHaveBeenCalled();
  });

  it('não manda antes da hora', async () => {
    const { service, pushService } = cenario({ reminderTime: '07:30' });

    expect(await service.dispatchDue(DEZ_UTC)).toBe(0);
    expect(pushService.send).not.toHaveBeenCalled();
  });

  it('ainda manda com alguns minutos de atraso — a API pode ter reiniciado', async () => {
    const { service, pushService } = cenario({ reminderTime: '06:53' });

    expect(await service.dispatchDue(DEZ_UTC)).toBe(1);
    expect(pushService.send).toHaveBeenCalled();
  });

  it('não ressuscita o lembrete horas depois', async () => {
    const { service, pushService } = cenario({ reminderTime: '03:00' });

    expect(await service.dispatchDue(DEZ_UTC)).toBe(0);
    expect(pushService.send).not.toHaveBeenCalled();
  });

  it('respeita o fuso do usuário: 07:00 em Lisboa não é 07:00 aqui', async () => {
    const { service, pushService } = cenario({ reminderTimezone: 'Europe/Lisbon' });

    // Em Lisboa são 11:00 — passou muito da hora, não manda.
    expect(await service.dispatchDue(DEZ_UTC)).toBe(0);
    expect(pushService.send).not.toHaveBeenCalled();
  });

  it('sem aparelho inscrito não há o que enviar', async () => {
    const { service, prisma, pushService } = cenario({ pushSubscriptions: [] });

    expect(await service.dispatchDue(DEZ_UTC)).toBe(0);
    expect(pushService.send).not.toHaveBeenCalled();
    expect(prisma.user.update).not.toHaveBeenCalled();
  });

  it('inscrição morta é apagada do banco', async () => {
    const { service, prisma } = cenario({}, { send: jest.fn().mockResolvedValue(false) });

    await service.dispatchDue(DEZ_UTC);
    expect(prisma.pushSubscription.deleteMany).toHaveBeenCalledWith({
      where: { endpoint: INSCRICAO.endpoint },
    });
  });
});
