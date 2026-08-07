import { PrismaClient } from '@prisma/client';
import { seedAdmin } from './admin.seeds';
import { seedUser } from './user.seeds';
import { seedText } from './text.seeds';
import { seedAnamnesis } from './anamnesis.seeds';

const prisma = new PrismaClient();

async function main() {
  await seedAdmin(prisma);
  await seedUser(prisma);
  await seedText(prisma);
  await seedAnamnesis(prisma);
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => await prisma.$disconnect());
