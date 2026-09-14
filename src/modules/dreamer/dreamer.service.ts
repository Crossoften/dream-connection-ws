import { PrismaService } from '@database/PrismaService';
import { Injectable } from '@nestjs/common';
import { AnamnesisQuestion } from '@prisma/client';
import normalizeText from '@utils/normalizeText';
import { AnswerQuestionsDto } from './dto/answer-questions.dto';

/** Tamanho de cada bloco da ficha: a abertura e cada nova liberação. */
const QUESTION_BATCH_SIZE = 5;

/** Categorias que sobem na fila conforme o conteúdo recente dos sonhos. */
const PEOPLE_CATEGORIES = ['familia', 'afetivo'];
const RECURRENCE_CATEGORIES = ['sonhos'];

@Injectable()
export class DreamerService {
  constructor(private readonly prisma: PrismaService) {}

  /** Progresso da ficha: quantas perguntas o sonhador já respondeu. */
  async progress(userId: number) {
    const [answered, total] = await Promise.all([
      this.prisma.anamnesisAnswer.count({ where: { userId, question: { active: true } } }),
      this.prisma.anamnesisQuestion.count({ where: { active: true } }),
    ]);
    return {
      answered,
      total,
      completionPct: total ? Math.round((answered / total) * 100) : 0,
    };
  }

  /**
   * Próximo bloco da ficha anamnéstica. O sonhador recebe 5 perguntas no
   * primeiro acesso e libera mais 5 a cada 5 sonhos decodificados; dentro do
   * saldo liberado, serve no máximo 5 por vez.
   *
   * Uma pergunta encadeada só entra quando a pergunta-mãe foi respondida com o
   * valor esperado. A fila respeita a ordem da ficha, mas sobe as categorias
   * ligadas ao que tem aparecido nos sonhos: pessoas puxam família e vida
   * afetiva; símbolos que se repetem puxam as perguntas sobre sonhos.
   */
  async nextQuestions(userId: number) {
    const [answers, user, questions] = await Promise.all([
      this.prisma.anamnesisAnswer.findMany({
        where: { userId },
        select: { questionId: true, answer: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId }, select: { dreamsTotal: true } }),
      this.prisma.anamnesisQuestion.findMany({
        where: { active: true },
        orderBy: { sortOrder: 'asc' },
      }),
    ]);

    const allowance =
      QUESTION_BATCH_SIZE * (1 + Math.floor((user?.dreamsTotal ?? 0) / QUESTION_BATCH_SIZE));
    const activeIds = new Set(questions.map((q) => q.id));
    const answeredActive = answers.filter((a) => activeIds.has(a.questionId)).length;
    const remaining = allowance - answeredActive;
    if (remaining <= 0) return [];

    const answerById = new Map(answers.map((a) => [a.questionId, a.answer]));
    const eligible = questions.filter(
      (q) =>
        !answerById.has(q.id) &&
        (q.dependsOnId == null ||
          (answerById.has(q.dependsOnId) &&
            normalizeText(answerById.get(q.dependsOnId)) === normalizeText(q.dependsOnAnswer))),
    );

    const priority = await this.priorityCategories(userId);
    const ordered = priority.length ? this.prioritize(eligible, priority) : eligible;

    return ordered.slice(0, Math.min(QUESTION_BATCH_SIZE, remaining));
  }

  async answerQuestions(userId: number, dto: AnswerQuestionsDto) {
    const answers = dto.answers.filter((a) => a.answer?.trim());
    await this.prisma.$transaction(
      answers.map((a) =>
        this.prisma.anamnesisAnswer.upsert({
          where: { userId_questionId: { userId, questionId: a.questionId } },
          update: { answer: a.answer.trim() },
          create: { userId, questionId: a.questionId, answer: a.answer.trim() },
        }),
      ),
    );
    return this.nextQuestions(userId);
  }

  private async priorityCategories(userId: number): Promise<string[]> {
    const recentDreams = await this.prisma.dream.findMany({
      where: { userId, status: 'Decodificado' },
      orderBy: { dreamedAt: 'desc' },
      take: QUESTION_BATCH_SIZE,
      select: { id: true },
    });
    if (!recentDreams.length) return [];

    const [peopleInDreams, recurringSymbols] = await Promise.all([
      this.prisma.dreamElement.count({
        where: { isPerson: true, dreamId: { in: recentDreams.map((d) => d.id) } },
      }),
      this.prisma.dictionaryEntry.count({ where: { userId, count: { gte: 3 } } }),
    ]);

    return [
      ...(peopleInDreams > 0 ? PEOPLE_CATEGORIES : []),
      ...(recurringSymbols > 0 ? RECURRENCE_CATEGORIES : []),
    ];
  }

  private prioritize(questions: AnamnesisQuestion[], categories: string[]): AnamnesisQuestion[] {
    const first = questions.filter((q) => categories.includes(q.category));
    const rest = questions.filter((q) => !categories.includes(q.category));
    return [...first, ...rest];
  }
}
