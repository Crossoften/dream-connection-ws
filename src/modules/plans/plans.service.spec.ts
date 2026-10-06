import { NotFoundException, UnprocessableEntityException } from '@nestjs/common';
import { Plan, PlanChangeStatus } from '@prisma/client';
import { PlansService } from './plans.service';

const DAY = 86_400_000;

/** O catálogo como o cliente mandou em 05/10: só o Bronze tem preço. */
const CATALOGO = [
  { key: Plan.Gratuito, name: 'Gratuito', priceCents: 0, description: '…', ordering: 1, active: true },
  { key: Plan.Bronze, name: 'Bronze', priceCents: 1000, description: '…', ordering: 2, active: true },
  { key: Plan.Prata, name: 'Prata', priceCents: null, description: '…', ordering: 3, active: true },
  { key: Plan.Ouro, name: 'Ouro', priceCents: null, description: '…', ordering: 4, active: true },
];

function makePrisma(user: { plan: Plan; trialEndsAt: Date | null }, lastChange: any = null) {
  /** O Prisma devolve um objeto novo a cada leitura; o mock faz o mesmo, senão
   *  o `update` alteraria o objeto que o service ainda vai ler. */
  let planoAtual = user.plan;
  return {
    user: {
      findUniqueOrThrow: jest.fn(() =>
        Promise.resolve({ plan: planoAtual, trialEndsAt: user.trialEndsAt }),
      ),
      update: jest.fn(({ data }) => {
        planoAtual = data.plan;
        return Promise.resolve({ plan: planoAtual, trialEndsAt: user.trialEndsAt });
      }),
    },
    planTier: {
      findMany: jest.fn().mockResolvedValue(CATALOGO),
      findUnique: jest.fn(({ where }) => Promise.resolve(CATALOGO.find((t) => t.key === where.key) ?? null)),
    },
    planChange: {
      findFirst: jest.fn().mockResolvedValue(lastChange),
      create: jest.fn().mockResolvedValue({}),
    },
    /** O service manda um array de promises; aqui basta resolvê-las. */
    $transaction: jest.fn((ops: Promise<unknown>[]) => Promise.all(ops)),
  } as any;
}

describe('PlansService', () => {
  describe('overview', () => {
    it('mostra o teste grátis correndo e os dias que faltam', async () => {
      const prisma = makePrisma({ plan: Plan.Gratuito, trialEndsAt: new Date(Date.now() + 12 * DAY) });
      const out = await new PlansService(prisma).overview(1);

      expect(out.current).toBe(Plan.Gratuito);
      expect(out.trial.active).toBe(true);
      expect(out.trial.expired).toBe(false);
      expect(out.trial.daysLeft).toBe(12);
      expect(out.trial.days).toBe(30);
    });

    it('marca o teste como vencido quando o prazo passou', async () => {
      const prisma = makePrisma({ plan: Plan.Gratuito, trialEndsAt: new Date(Date.now() - DAY) });
      const out = await new PlansService(prisma).overview(1);

      expect(out.trial.active).toBe(false);
      expect(out.trial.expired).toBe(true);
      expect(out.trial.daysLeft).toBe(0);
    });

    it('plano sem preço não pode ser escolhido — é o "a definir" do cliente', async () => {
      const prisma = makePrisma({ plan: Plan.Gratuito, trialEndsAt: new Date() });
      const out = await new PlansService(prisma).overview(1);

      const porChave = Object.fromEntries(out.tiers.map((t) => [t.key, t]));
      expect(porChave[Plan.Bronze].available).toBe(true);
      expect(porChave[Plan.Bronze].priceCents).toBe(1000);
      expect(porChave[Plan.Prata].available).toBe(false);
      expect(porChave[Plan.Ouro].available).toBe(false);
      expect(porChave[Plan.Gratuito].current).toBe(true);
    });

    it('avisa o pagamento pendente do plano pago atual', async () => {
      const prisma = makePrisma(
        { plan: Plan.Bronze, trialEndsAt: new Date(Date.now() - DAY) },
        { toPlan: Plan.Bronze, status: PlanChangeStatus.PendentePagamento },
      );
      const out = await new PlansService(prisma).overview(1);

      expect(out.paymentPending).toBe(true);
      // Fora do gratuito não há teste correndo nem vencido para mostrar.
      expect(out.trial.active).toBe(false);
      expect(out.trial.expired).toBe(false);
    });
  });

  describe('change', () => {
    it('recusa trocar para o plano em que já se está', async () => {
      const prisma = makePrisma({ plan: Plan.Gratuito, trialEndsAt: new Date() });
      await expect(new PlansService(prisma).change(1, Plan.Gratuito)).rejects.toBeInstanceOf(
        UnprocessableEntityException,
      );
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('recusa plano cujo preço ainda está a definir', async () => {
      const prisma = makePrisma({ plan: Plan.Gratuito, trialEndsAt: new Date() });
      await expect(new PlansService(prisma).change(1, Plan.Prata)).rejects.toThrow(/a definir/);
      expect(prisma.user.update).not.toHaveBeenCalled();
    });

    it('recusa plano que não está no catálogo', async () => {
      const prisma = makePrisma({ plan: Plan.Gratuito, trialEndsAt: new Date() });
      prisma.planTier.findUnique = jest.fn().mockResolvedValue(null);

      await expect(new PlansService(prisma).change(1, Plan.Bronze)).rejects.toBeInstanceOf(
        NotFoundException,
      );
    });

    it('troca para o Bronze e registra como pagamento pendente', async () => {
      const prisma = makePrisma({ plan: Plan.Gratuito, trialEndsAt: new Date() });
      const out = await new PlansService(prisma).change(1, Plan.Bronze);

      expect(prisma.user.update).toHaveBeenCalledWith({ where: { id: 1 }, data: { plan: Plan.Bronze } });
      expect(prisma.planChange.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          fromPlan: Plan.Gratuito,
          toPlan: Plan.Bronze,
          status: PlanChangeStatus.PendentePagamento,
        },
      });
      expect(out.current).toBe(Plan.Bronze);
    });

    it('voltar para o Gratuito é imediato — não há o que cobrar', async () => {
      const prisma = makePrisma({ plan: Plan.Bronze, trialEndsAt: new Date() });
      await new PlansService(prisma).change(1, Plan.Gratuito);

      expect(prisma.planChange.create).toHaveBeenCalledWith({
        data: {
          userId: 1,
          fromPlan: Plan.Bronze,
          toPlan: Plan.Gratuito,
          status: PlanChangeStatus.Ativo,
        },
      });
    });
  });
});
