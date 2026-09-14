import { PrismaClient, Role, Status } from '@prisma/client';
import { hashSync } from 'bcrypt';

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
      },
    });
  }

  console.log('Users seed added successfully 🌱.');
}
