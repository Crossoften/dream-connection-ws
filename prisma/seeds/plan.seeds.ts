import { Plan, PrismaClient } from '@prisma/client';

/**
 * Os planos como o cliente os passou em 05/10/2026:
 * "30 dias gratuito. Após, cobraremos: Bronze - R$ 10,00 / prata - a definir /
 * Ouro - a definir".
 *
 * `priceCents: null` é literalmente o "a definir" dele — plano sem preço
 * aparece na tela, mas não pode ser escolhido. Quando o Juarez fechar os
 * valores, basta trocar o número aqui e rodar `npm run seed`.
 */
const TIERS = [
  {
    key: Plan.Gratuito,
    name: 'Gratuito',
    priceCents: 0,
    description: '30 dias para conhecer o app, com a decodificação completa.',
    ordering: 1,
  },
  {
    key: Plan.Bronze,
    name: 'Bronze',
    priceCents: 1000,
    description: 'Mantém o app depois dos 30 dias de teste.',
    ordering: 2,
  },
  {
    key: Plan.Prata,
    name: 'Prata',
    priceCents: null,
    description: 'Benefícios e preço a definir com o cliente.',
    ordering: 3,
  },
  {
    key: Plan.Ouro,
    name: 'Ouro',
    priceCents: null,
    description: 'Benefícios e preço a definir com o cliente.',
    ordering: 4,
  },
];

export async function seedPlan(prisma: PrismaClient) {
  for (const tier of TIERS) {
    await prisma.planTier.upsert({
      where: { key: tier.key },
      update: tier,
      create: tier,
    });
  }

  console.log('Plans seed added successfully 🌱.');
}
