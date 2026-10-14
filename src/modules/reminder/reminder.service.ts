import { PrismaService } from '@database/PrismaService';
import { Injectable, Logger } from '@nestjs/common';
import { SaveReminderDto } from './dto/save-reminder.dto';
import { SaveSubscriptionDto } from './dto/save-subscription.dto';
import { localNow, minutesLate } from './local-time';
import { PushService } from './push.service';

/**
 * Tolerância de atraso: se a API ficou fora do ar na hora marcada, o lembrete
 * ainda sai quando ela voltar, desde que dentro desta janela. Sem isso um
 * reinício às 7h01 engoliria o lembrete das 7h.
 */
const LATE_WINDOW_MINUTES = 10;

@Injectable()
export class ReminderService {
  private readonly logger = new Logger(ReminderService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly push: PushService,
  ) {}

  async settings(userId: number) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { reminderEnabled: true, reminderTime: true, reminderTimezone: true },
    });
    const devices = await this.prisma.pushSubscription.count({ where: { userId } });

    return {
      enabled: user.reminderEnabled,
      time: user.reminderTime,
      timezone: user.reminderTimezone,
      /** Sem nenhum aparelho inscrito o lembrete não tem para onde ir. */
      devices,
      /** Falso quando o servidor está sem chave VAPID: a tela avisa em vez de mentir. */
      pushAvailable: this.push.configured,
    };
  }

  async save(userId: number, dto: SaveReminderDto) {
    await this.prisma.user.update({
      where: { id: userId },
      data: {
        reminderEnabled: dto.enabled,
        reminderTime: dto.enabled ? dto.time : null,
        reminderTimezone: dto.enabled ? dto.timezone : null,
        // Ligar de novo (ou mudar a hora) libera o envio de hoje.
        reminderSentOn: null,
      },
    });

    return this.settings(userId);
  }

  /** Guarda o navegador inscrito. O mesmo endpoint não entra duas vezes. */
  async subscribe(userId: number, dto: SaveSubscriptionDto) {
    await this.prisma.pushSubscription.upsert({
      where: { endpoint: dto.endpoint },
      update: { userId, p256dh: dto.p256dh, auth: dto.auth },
      create: { userId, endpoint: dto.endpoint, p256dh: dto.p256dh, auth: dto.auth },
    });

    return this.settings(userId);
  }

  async unsubscribe(userId: number, endpoint: string) {
    await this.prisma.pushSubscription.deleteMany({ where: { userId, endpoint } });
    return this.settings(userId);
  }

  /**
   * Uma passada do agendador: manda o lembrete de quem chegou na hora e ainda
   * não recebeu hoje. Chamado de minuto em minuto.
   */
  async dispatchDue(now: Date = new Date()): Promise<number> {
    const candidates = await this.prisma.user.findMany({
      where: { reminderEnabled: true, reminderTime: { not: null } },
      select: {
        id: true,
        name: true,
        reminderTime: true,
        reminderTimezone: true,
        reminderSentOn: true,
        pushSubscriptions: true,
      },
    });

    let sent = 0;
    for (const user of candidates) {
      const local = localNow(user.reminderTimezone, now);
      if (user.reminderSentOn === local.day) continue;

      const late = minutesLate(user.reminderTime!, local.time);
      if (late < 0 || late > LATE_WINDOW_MINUTES) continue;
      if (!user.pushSubscriptions.length) continue;

      await this.sendTo(user.id, user.name, user.pushSubscriptions);
      await this.prisma.user.update({
        where: { id: user.id },
        data: { reminderSentOn: local.day },
      });
      sent += 1;
    }

    return sent;
  }

  private async sendTo(
    userId: number,
    name: string,
    targets: { endpoint: string; p256dh: string; auth: string }[],
  ): Promise<void> {
    const payload = {
      title: 'Bom dia — conte seu sonho',
      body: `${name.split(' ')[0]}, o que você sonhou esta noite? Toque para registrar antes de esquecer.`,
      // Relativo ao app, SEM barra inicial: o service worker resolve contra o
      // próprio escopo (/<app>/) e vira /<app>/#/capturar. Com "/#/capturar" o
      // navegador joga para a raiz do domínio, fora do app (placeholder do nginx).
      url: '#/capturar',
    };

    for (const target of targets) {
      const alive = await this.push.send(target, payload);
      if (!alive) {
        // Inscrição morta (app desinstalado, permissão revogada): some do banco.
        await this.prisma.pushSubscription.deleteMany({ where: { endpoint: target.endpoint } });
        this.logger.log(`Inscrição removida (usuário ${userId}): o navegador não existe mais.`);
      }
    }
  }
}
