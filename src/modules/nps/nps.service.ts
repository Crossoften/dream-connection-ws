import { PrismaService } from '@database/PrismaService';
import { Injectable } from '@nestjs/common';

@Injectable()
export class NpsService {
  constructor(private readonly prisma: PrismaService) {}

  async status(userId: number) {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { npsAnswered: true, dreamsTotal: true },
    });
    const shouldAsk =
      !!user && !user.npsAnswered && user.dreamsTotal > 0 && user.dreamsTotal % 5 === 0;
    return { shouldAsk };
  }

  async create(userId: number, score: number, comment?: string) {
    await this.prisma.$transaction([
      this.prisma.npsResponse.create({ data: { userId, score, comment: comment ?? null } }),
      this.prisma.user.update({ where: { id: userId }, data: { npsAnswered: true } }),
    ]);
    return { message: 'Obrigado pela avaliação!' };
  }
}
