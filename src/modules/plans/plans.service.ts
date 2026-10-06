import { PrismaService } from '@database/PrismaService';
import { Injectable, NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Plan, PlanChangeStatus } from '@prisma/client';
import { TRIAL_DAYS, trialDaysLeft } from './trial';

@Injectable()
export class PlansService {
  constructor(private readonly prisma: PrismaService) {}

  /** Tudo o que a tela de planos mostra: catálogo, plano atual e teste grátis. */
  async overview(userId: number) {
    const [user, tiers, lastChange] = await Promise.all([
      this.prisma.user.findUniqueOrThrow({
        where: { id: userId },
        select: { plan: true, trialEndsAt: true },
      }),
      this.prisma.planTier.findMany({ where: { active: true }, orderBy: { ordering: 'asc' } }),
      this.prisma.planChange.findFirst({ where: { userId }, orderBy: { createdAt: 'desc' } }),
    ]);

    const daysLeft = trialDaysLeft(user.trialEndsAt);
    const onFreePlan = user.plan === Plan.Gratuito;

    return {
      current: user.plan,
      /** Plano pago escolhido, mas ainda sem cobrança — não há meio de pagamento integrado. */
      paymentPending:
        !onFreePlan &&
        lastChange?.toPlan === user.plan &&
        lastChange?.status === PlanChangeStatus.PendentePagamento,
      trial: {
        days: TRIAL_DAYS,
        endsAt: user.trialEndsAt,
        daysLeft,
        active: onFreePlan && daysLeft > 0,
        expired: onFreePlan && user.trialEndsAt != null && daysLeft === 0,
      },
      tiers: tiers.map((tier) => ({
        key: tier.key,
        name: tier.name,
        priceCents: tier.priceCents,
        description: tier.description,
        current: tier.key === user.plan,
        /** Sem preço definido não dá para assinar: o Prata e o Ouro ainda são "a definir". */
        available: tier.key === Plan.Gratuito || tier.priceCents != null,
      })),
    };
  }

  /**
   * Troca o plano do usuário — "o cliente possa alterar de plano, conforme a
   * sua utilização" (cliente, 05/10/2026). Plano pago entra como
   * `PendentePagamento`: a cobrança depende do meio de pagamento, que ainda
   * não foi escolhido nem integrado.
   */
  async change(userId: number, to: Plan) {
    const user = await this.prisma.user.findUniqueOrThrow({
      where: { id: userId },
      select: { plan: true },
    });

    if (user.plan === to) {
      throw new UnprocessableEntityException(`Você já está no plano ${to}.`);
    }

    const tier = await this.prisma.planTier.findUnique({ where: { key: to } });
    if (!tier || !tier.active) {
      throw new NotFoundException('Plano indisponível.');
    }

    if (to !== Plan.Gratuito && tier.priceCents == null) {
      throw new UnprocessableEntityException(
        `O preço do plano ${tier.name} ainda está a definir. Escolha outro plano.`,
      );
    }

    const status = to === Plan.Gratuito ? PlanChangeStatus.Ativo : PlanChangeStatus.PendentePagamento;

    await this.prisma.$transaction([
      this.prisma.user.update({ where: { id: userId }, data: { plan: to } }),
      this.prisma.planChange.create({
        data: { userId, fromPlan: user.plan, toPlan: to, status },
      }),
    ]);

    return this.overview(userId);
  }
}
