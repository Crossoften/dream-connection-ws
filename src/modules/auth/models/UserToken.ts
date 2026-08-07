import { AdminPermission, Plan, Role } from '@prisma/client';

export interface UserToken {
  token: string;
  id: number;
  name: string;
  email: string;
  plan: Plan;
  role: Role;
  adminPermissions: AdminPermission[];
}
