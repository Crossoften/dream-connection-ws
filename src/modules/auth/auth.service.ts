import { PrismaService } from '@database/PrismaService';
import {
  ConflictException,
  Injectable,
  Logger,
  ServiceUnavailableException,
  UnauthorizedException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { Status, User } from '@prisma/client';
import { compareSync, hashSync } from 'bcrypt';
import { randomBytes } from 'crypto';
import { LoginService } from '../login/login.service';
import { RegisterUserDto } from './dto/register-user.dto';
import { UserPayload } from './models/UserPayload';
import { UserToken } from './models/UserToken';
import { trialEndsAtFrom } from '../plans/trial';
import { InvalidFirebaseTokenError, verifyFirebaseIdToken } from './firebase/verify-firebase-token';

@Injectable()
export class AuthService {
  private readonly logger = new Logger(AuthService.name);

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
        password: hashSync(dto.password, 12),
        status: Status.Active,
        provider: 'Email',
        trialEndsAt: trialEndsAtFrom(),
      },
    });

    return this.login(user);
  }

  /**
   * Login com Google: valida o idToken do Firebase (assinatura com as chaves
   * públicas do Firebase + emissor/audiência do projeto) e cria/reaproveita a conta.
   * Obs.: o endpoint oauth2.googleapis.com/tokeninfo não aceita ID tokens do Firebase.
   */
  async googleLogin(idToken: string): Promise<UserToken> {
    const projectId = process.env.FIREBASE_PROJECT_ID;
    if (!projectId) throw new UnauthorizedException('Login com Google não configurado.');

    let claims: any;
    try {
      claims = await verifyFirebaseIdToken(idToken, projectId);
    } catch (error) {
      if (error instanceof InvalidFirebaseTokenError) {
        this.logger.warn(`Token Google recusado: ${error.message}`);
        throw new UnauthorizedException('Token Google inválido.');
      }
      this.logger.error(`Falha ao validar token Google: ${error?.message}`);
      throw new ServiceUnavailableException('Não foi possível validar o login com Google.');
    }
    if (!claims.email || claims.email_verified === false) {
      throw new UnauthorizedException('Token Google inválido.');
    }

    const email = String(claims.email).toLowerCase();
    const name = String(claims.name || email.split('@')[0]);

    let user = await this.loginService.findByEmail(email);
    if (!user) {
      user = (await this.prisma.user.create({
        data: {
          name,
          email,
          password: hashSync(randomBytes(24).toString('hex'), 12),
          status: Status.Active,
          provider: 'Google',
          trialEndsAt: trialEndsAtFrom(),
        },
      })) as any;
    }

    return this.login(user as User);
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
