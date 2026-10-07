import { PrismaClient, Role, Status } from '@prisma/client';
import { hashSync } from 'bcrypt';
import { trialEndsAtFrom } from '../../src/modules/plans/trial';

/** Contas de teste no padrão da casa: <papel>@email.com / 12345678. */
const ACCOUNTS = [
  { name: 'Sonhador', email: 'sonhador@email.com' },
  { name: 'user one', email: 'user.one@email.com' },
];

export async function seedUser(prisma: PrismaClient) {
  for (const account of ACCOUNTS) {
    await prisma.user.upsert({
      where: { email: account.email },
      update: {},
      create: {
        name: account.name,
        email: account.email,
        password: hashSync('12345678', 12),
        role: Role.User,
        status: Status.Active,
        // Sem isto a conta de teste nasce sem teste grátis e a tela de planos
        // não mostra nem "correndo" nem "vencido" — logo quem vai testar o
        // card é quem não veria a função.
        trialEndsAt: trialEndsAtFrom(),
      },
    });
  }

  console.log('Users seed added successfully 🌱.');
}
