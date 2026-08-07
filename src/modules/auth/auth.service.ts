import { PrismaService } from '@database/PrismaService';
import { ConflictException, Injectable } from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Status, User } from '@prisma/client';
import { compareSync, hashSync } from 'bcrypt';
import { LoginService } from '../login/login.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserPayload } from './models/UserPayload';
import { UserToken } from './models/UserToken';

@Injectable()
export class AuthService {
  constructor(
    private readonly loginService: LoginService,
    private readonly jwtService: JwtService,
    private readonly prisma: PrismaService,
  ) {}

  async login(userArg: User): Promise<UserToken> {
    const payload: UserPayload = {
      id: userArg.id,
      role: userArg.role,
    };

    const token: string = this.jwtService.sign(payload);
    const user = await this.loginService.findByEmail(userArg.email);

    return {
      token,
      id: user.id,
      name: user.name,
      email: user.email,
      plan: user.plan,
      role: user.role,
      adminPermissions: user.adminPermissions,
    };
  }

  /** Cadastro de sonhador: cria a conta ativa e já devolve a sessão. */
  async register(dto: RegisterUserDto): Promise<UserToken> {
    const existing = await this.loginService.findByEmail(dto.email);
    if (existing) throw new ConflictException('Este e-mail já está em uso.');

    const user = await this.prisma.user.create({
      data: {
        name: dto.name,
        email: dto.email,
        password: hashSync(dto.password, 10),
        status: Status.Active,
        provider: 'Email',
        profile: { create: {} },
      },
    });

    return this.login(user);
  }

  async validateUser(email: string, password: string): Promise<User> {
    const user = await this.loginService.findByEmail(email);

    if (user && user.status === Status.Active) {
      const isPasswordValid: boolean = compareSync(password, user.password);

      if (isPasswordValid) {
        return {
          ...user,
          password: undefined,
        };
      }
    }

    throw new Error('Acesso não autorizado.');
  }
}
