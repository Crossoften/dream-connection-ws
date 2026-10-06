import { Injectable, Logger } from '@nestjs/common';
import { Cron, CronExpression } from '@nestjs/schedule';
import { ReminderService } from './reminder.service';

/**
 * De minuto em minuto: quem marcou lembrete para agora recebe a notificação.
 * A conta de "agora" é feita no fuso de cada usuário, não no do servidor.
 */
@Injectable()
export class ReminderScheduler {
  private readonly logger = new Logger(ReminderScheduler.name);
  /** Uma passada por vez: se uma demorar, a seguinte não entra por cima. */
  private running = false;

  constructor(private readonly reminder: ReminderService) {}

  @Cron(CronExpression.EVERY_MINUTE)
  async tick(): Promise<void> {
    if (this.running) return;
    this.running = true;
    try {
      const sent = await this.reminder.dispatchDue();
      if (sent) this.logger.log(`Lembrete enviado para ${sent} usuário(s).`);
    } catch (error: any) {
      // Um erro aqui não pode matar o agendador: ele precisa rodar no minuto seguinte.
      this.logger.error(`Falha na rodada do lembrete: ${error?.message}`);
    } finally {
      this.running = false;
    }
  }
}
