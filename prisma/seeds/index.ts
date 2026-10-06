import { PrismaClient } from '@prisma/client';
import { seedAdmin } from './admin.seeds';
import { seedUser } from './user.seeds';
import { seedText } from './text.seeds';
import { seedAnamnesis } from './anamnesis.seeds';
import { seedPlan } from './plan.seeds';

const prisma = new PrismaClient();

async function main() {
  if (process.env.NODE_ENV === 'production') {
    throw new Error('Seed recusado: NODE_ENV=production. As contas de teste nunca vão para produção.');
  }

  await seedAdmin(prisma);
  await seedUser(prisma);
  await seedText(prisma);
  await seedAnamnesis(prisma);
  await seedPlan(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
