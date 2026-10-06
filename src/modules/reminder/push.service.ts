import { Injectable, Logger } from '@nestjs/common';
import * as webPush from 'web-push';

export interface PushTarget {
  endpoint: string;
  p256dh: string;
  auth: string;
}

/** O que o navegador recebe e mostra na notificação. */
export interface PushPayload {
  title: string;
  body: string;
  url: string;
}

/**
 * Envio de Web Push no padrão VAPID — sem Firebase: as chaves são nossas e
 * ficam no `.env`. Funciona no Chrome/Android e, no iPhone, a partir do iOS
 * 16.4 **com o app instalado na tela inicial**.
 */
@Injectable()
export class PushService {
  private readonly logger = new Logger(PushService.name);
  readonly configured: boolean;

  constructor() {
    const publicKey = process.env.VAPID_PUBLIC_KEY;
    const privateKey = process.env.VAPID_PRIVATE_KEY;
    this.configured = Boolean(publicKey && privateKey);

    if (!this.configured) {
      // Sem chave o resto da API continua de pé: só o lembrete fica mudo.
      this.logger.warn('VAPID ausente no .env — o lembrete não será enviado.');
      return;
    }

    webPush.setVapidDetails(
      process.env.VAPID_SUBJECT || 'mailto:no-reply@dreamconnection.app',
      publicKey,
      privateKey,
    );
  }

  /**
   * Entrega a notificação. Devolve `false` quando a inscrição morreu (o
   * navegador foi desinstalado, a permissão foi revogada) — quem chama apaga.
   */
  async send(target: PushTarget, payload: PushPayload): Promise<boolean> {
    if (!this.configured) return true;

    try {
      await webPush.sendNotification(
        { endpoint: target.endpoint, keys: { p256dh: target.p256dh, auth: target.auth } },
        JSON.stringify(payload),
      );
      return true;
    } catch (error: any) {
      const status = error?.statusCode;
      if (status === 404 || status === 410) return false;
      this.logger.error(`Falha ao enviar push (${status ?? 'sem status'}): ${error?.message}`);
      return true;
    }
  }
}
