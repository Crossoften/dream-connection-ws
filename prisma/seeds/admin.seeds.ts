import { AdminPermissions, PrismaClient, Role, Status } from '@prisma/client';
import { hashSync } from 'bcrypt';

export async function seedAdmin(prisma: PrismaClient) {
  const master = await prisma.user.upsert({
    where: { email: 'admin.master@email.com' },
    update: {},
    create: {
      name: 'Admin Master',
      email: 'admin.master@email.com',
      password: hashSync('12345678', 12),
      role: Role.Master,
      status: Status.Active,
    },
  });

  for (const permission of Object.values(AdminPermissions)) {
    await prisma.adminPermission.upsert({
      where: { name: permission },
      update: { admin: { connect: { id: master.id } } },
      create: { name: permission, admin: { connect: { id: master.id } } },
    });
  }

  console.log('Admins seed added successfully 🌱.');
}
