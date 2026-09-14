import { PrismaService } from '@database/PrismaService';
import {
  BadRequestException,
  Injectable,
  Logger,
  UnprocessableEntityException,
} from '@nestjs/common';
import { User } from '@prisma/client';
import generateCode from '@utils/generateCode';
import { hashSync } from 'bcrypt';
import { NewContactDto } from '../mail/dto/new-contact.dto';
import { MailService } from '../mail/mail.service';
import { ResetPasswordDto } from './dto/reset-password.dto';
import { TextQueriesDto } from './dto/text-queries.dto';
import { VerifyCodeDto } from './dto/verify-code.dto';

/** Validade do código de redefinição de senha. */
const CODE_TTL_MS = 60 * 60 * 1000;

@Injectable()
export class NoAuthService {
  private readonly logger = new Logger(NoAuthService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly mailService: MailService,
  ) {}

  /**
   * Envia o código de redefinição. Responde igual exista ou não a conta, para
   * que a rota não sirva para descobrir quais e-mails estão cadastrados.
   */
  async forgot(email: string): Promise<void> {
    const user: User | null = await this.prisma.user.findFirst({ where: { email } });
    if (!user) return;

    const code = generateCode();
    await this.prisma.user.update({
      where: { id: user.id },
      data: { code, codeExpiresIn: new Date(Date.now() + CODE_TTL_MS) },
    });

    try {
      await this.mailService.forgotPassword(email, code);
    } catch (error) {
      this.logger.error(`Falha ao enviar o código de redefinição: ${error.message}`);
    }
  }

  async verifyCode(payload: VerifyCodeDto): Promise<void> {
    await this.consumeCode(payload.email, payload.code);
  }

  async reset(payload: ResetPasswordDto): Promise<void> {
    const { email, code, password, confirmPassword } = payload;

    if (password !== confirmPassword) {
      throw new BadRequestException('Senhas devem ser iguais.');
    }

    const user = await this.consumeCode(email, code);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        code: null,
        codeExpiresIn: null,
        password: hashSync(password, 12),
      },
    });
  }

  async contactUs(payload: NewContactDto): Promise<void> {
    await this.mailService.contactUs(payload);
  }

  async texts(query: TextQueriesDto) {
    const { type } = query;

    return this.prisma.text.findFirst({ where: { type } });
  }

  async mySelf(id: number) {
    const user = await this.prisma.user.findFirst({
      where: { id },
      select: {
        id: true,
        name: true,
        email: true,
        phone: true,
        role: true,
        status: true,
        fileUrl: true,
        fileKey: true,
        plan: true,
        streakDays: true,
        dreamsTotal: true,
        lastDreamAt: true,
        createdAt: true,
        updatedAt: true,
      },
    });
    if (!user) return user;

    const { lastDreamAt, ...rest } = user;
    return { ...rest, streakDays: this.currentStreak(lastDreamAt, user.streakDays) };
  }

  /** A sequência só vale se o último sonho foi hoje ou ontem; senão já se quebrou. */
  private currentStreak(lastDreamAt: Date | null, streakDays: number): number {
    if (!lastDreamAt) return 0;
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const days = Math.round((startOfDay(new Date()) - startOfDay(lastDreamAt)) / 86_400_000);
    return days <= 1 ? streakDays : 0;
  }

  /**
   * Confere e-mail + código. Código errado invalida o código na hora: uma
   * única tentativa por código, então não há força bruta nos 6 dígitos — quem
   * errou pede outro.
   */
  private async consumeCode(email: string, code: string): Promise<User> {
    const user: User | null = await this.prisma.user.findFirst({ where: { email } });

    if (!user || !user.code || !user.codeExpiresIn) {
      throw new BadRequestException('Código inválido. Solicite um novo.');
    }

    if (user.code !== code) {
      await this.clearCode(user.id);
      throw new BadRequestException('Código inválido. Solicite um novo.');
    }

    if (Date.now() >= user.codeExpiresIn.getTime()) {
      await this.clearCode(user.id);
      throw new UnprocessableEntityException('Código expirou. Solicite um novo.');
    }

    return user;
  }

  private async clearCode(userId: number): Promise<void> {
    await this.prisma.user.update({
      where: { id: userId },
      data: { code: null, codeExpiresIn: null },
    });
  }
}
