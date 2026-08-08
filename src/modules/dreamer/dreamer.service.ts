import { PrismaService } from '@database/PrismaService';
import { Injectable, NotFoundException } from '@nestjs/common';
import { UpsertProfileDto } from './dto/upsert-profile.dto';
import { CreatePersonDto } from './dto/person.dto';
import { AnswerQuestionsDto } from './dto/answer-questions.dto';

/** Quantas perguntas da anamnese contínua são servidas por vez. */
const QUESTION_BATCH_SIZE = 5;

@Injectable()
export class DreamerService {
  constructor(private readonly prisma: PrismaService) {}

  async getProfile(userId: number) {
    const [profile, people, answered, totalQuestions] = await Promise.all([
      this.prisma.dreamerProfile.findUnique({ where: { userId } }),
      this.prisma.person.findMany({ where: { userId }, orderBy: { createdAt: 'asc' } }),
      this.prisma.anamnesisAnswer.count({ where: { userId } }),
      this.prisma.anamnesisQuestion.count({ where: { active: true } }),
    ]);

    return {
      profile,
      people,
      completionPct: this.completionPct(profile, people.length),
      anamnesis: { answered, total: totalQuestions },
    };
  }

  async upsertProfile(userId: number, dto: UpsertProfileDto) {
    const data = {
      nickname: dto.nickname,
      lifeMoment: dto.lifeMoment,
      work: dto.work,
      workFeel: dto.workFeel,
      passions: dto.passions,
      fears: dto.fears,
      currentEmotion: dto.currentEmotion,
      seeking: dto.seeking,
    };

    await this.prisma.dreamerProfile.upsert({
      where: { userId },
      update: data,
      create: { userId, ...data },
    });

    return this.getProfile(userId);
  }

  async addPerson(userId: number, dto: CreatePersonDto) {
    return this.prisma.person.create({ data: { userId, name: dto.name, relation: dto.relation } });
  }

  async removePerson(userId: number, personId: number) {
    const person = await this.prisma.person.findFirst({ where: { id: personId, userId } });
    if (!person) throw new NotFoundException('Pessoa não encontrada.');
    await this.prisma.person.delete({ where: { id: personId } });
    return { message: 'Pessoa removida.' };
  }

  /**
   * Anamnese contínua: blocos de 5 perguntas, enriquecidos pelo uso —
   * o usuário recebe 5 perguntas iniciais e libera mais 5 a cada 5 sonhos
   * registrados. Dentro do saldo liberado, serve as pendentes (máx. 5 por vez).
   */
  async nextQuestions(userId: number) {
    const [answered, user] = await Promise.all([
      this.prisma.anamnesisAnswer.findMany({
        where: { userId },
        select: { questionId: true },
      }),
      this.prisma.user.findUnique({
        where: { id: userId },
        select: { dreamsTotal: true },
      }),
    ]);

    const allowance =
      QUESTION_BATCH_SIZE * (1 + Math.floor((user?.dreamsTotal ?? 0) / QUESTION_BATCH_SIZE));
    const remaining = allowance - answered.length;
    if (remaining <= 0) return [];

    const answeredIds = answered.map((a) => a.questionId);
    return this.prisma.anamnesisQuestion.findMany({
      where: { active: true, id: { notIn: answeredIds.length ? answeredIds : [0] } },
      orderBy: { sortOrder: 'asc' },
      take: Math.min(QUESTION_BATCH_SIZE, remaining),
    });
  }

  async answerQuestions(userId: number, dto: AnswerQuestionsDto) {
    await this.prisma.$transaction(
      dto.answers.map((a) =>
        this.prisma.anamnesisAnswer.upsert({
          where: { userId_questionId: { userId, questionId: a.questionId } },
          update: { answer: a.answer },
          create: { userId, questionId: a.questionId, answer: a.answer },
        }),
      ),
    );
    return this.nextQuestions(userId);
  }

  private completionPct(
    profile: {
      nickname: string | null;
      lifeMoment: string | null;
      work: string | null;
      workFeel: string | null;
      passions: unknown;
      fears: unknown;
      currentEmotion: string | null;
    } | null,
    peopleCount: number,
  ): number {
    if (!profile) return 0;
    const slots = [
      profile.nickname,
      profile.lifeMoment,
      peopleCount > 0,
      profile.work,
      profile.workFeel,
      Array.isArray(profile.passions) && profile.passions.length > 0,
      Array.isArray(profile.fears) && profile.fears.length > 0,
      profile.currentEmotion,
    ];
    const done = slots.filter(Boolean).length;
    return Math.round((done / slots.length) * 100);
  }
}
