import { PrismaService } from '@database/PrismaService';
import { Injectable } from '@nestjs/common';
import { AnamnesisQuestion } from '@prisma/client';
import normalizeText from '@utils/normalizeText';
import { AnswerQuestionsDto } from './dto/answer-questions.dto';

/** Tamanho de cada bloco da ficha: a abertura e cada nova liberação. */
const QUESTION_BATCH_SIZE = 5;

/**
 * Sonhos decodificados para liberar cada novo bloco (padrão 5). Com
 * ANAMNESIS_DREAMS_PER_RELEASE=0 a ficha inteira fica liberada, de 5 em 5,
 * sem esperar sonhos — usado para demonstrar o app ao cliente.
 */
const dreamsPerRelease = (): number => {
  const value = Number(process.env.ANAMNESIS_DREAMS_PER_RELEASE ?? QUESTION_BATCH_SIZE);
  return Number.isInteger(value) && value >= 0 ? value : QUESTION_BATCH_SIZE;
};

/** Categorias que sobem na fila conforme o conteúdo recente dos sonhos. */
const PEOPLE_CATEGORIES = ['familia', 'afetivo'];
const RECURRENCE_CATEGORIES = ['sonhos', 'simbolos'];

@Injectable()
export class DreamerService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Progresso da ficha. Pergunta de seguimento só conta quando se aplica: quem
   * respondeu "Não" para "Possui filhos?" não fica devendo "Quantos filhos?".
   */
  async progress(userId: number) {
    const [answers, questions] = await Promise.all([
      this.prisma.anamnesisAnswer.findMany({
        where: { userId, question: { active: true } },
        select: { questionId: true, answer: true },
      }),
      this.prisma.anamnesisQuestion.findMany({ where: { active: true } }),
    ]);

    const answerById = new Map(answers.map((a) => [a.questionId, a.answer]));
    const applicable = questions.filter((q) => q.dependsOnId == null || this.released(q, answerById));
    const answered = applicable.filter((q) => answerById.has(q.id)).length;
    const total = applicable.length;

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
   * Perguntas de seguimento ("Se sim, quantos?") vêm antes de tudo e não gastam
   * o saldo: no formulário do idealizador elas moram na mesma linha da
   * pergunta-mãe, então aparecem logo depois dela, mesmo no fim de um bloco.
   *
   * A fila respeita a ordem da ficha, mas sobe as categorias ligadas ao que tem
   * aparecido nos sonhos: pessoas puxam família e vida afetiva; símbolos que se
   * repetem puxam os sonhos e o repertório simbólico (as cores).
   *
   * Cada pergunta devolvida traz `followUpWhen`: as respostas que liberam uma
   * pergunta de seguimento, para o app saber se ainda há um passo depois dela.
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

    const answerById = new Map(answers.map((a) => [a.questionId, a.answer]));
    const unanswered = questions.filter((q) => !answerById.has(q.id));
    const followUps = unanswered.filter((q) => q.dependsOnId != null && this.released(q, answerById));
    const base = unanswered.filter((q) => q.dependsOnId == null);

    const every = dreamsPerRelease();
    const allowance =
      every === 0
        ? Number.POSITIVE_INFINITY
        : QUESTION_BATCH_SIZE * (1 + Math.floor((user?.dreamsTotal ?? 0) / every));
    const answeredBase = questions.filter((q) => q.dependsOnId == null && answerById.has(q.id)).length;
    const remaining = Math.max(0, allowance - answeredBase);

    let ordered = base;
    if (remaining > 0) {
      const priority = await this.priorityCategories(userId);
      if (priority.length) ordered = this.prioritize(base, priority);
    }

    const followUpWhen = new Map<number, string[]>();
    for (const q of questions) {
      if (q.dependsOnId == null || !q.dependsOnAnswer) continue;
      followUpWhen.set(q.dependsOnId, [...(followUpWhen.get(q.dependsOnId) ?? []), q.dependsOnAnswer]);
    }

    return [...followUps, ...ordered.slice(0, Math.min(QUESTION_BATCH_SIZE, remaining))].map((q) => ({
      ...q,
      followUpWhen: followUpWhen.get(q.id) ?? [],
    }));
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

  /** Pergunta de seguimento liberada: a mãe tem exatamente a resposta esperada. */
  private released(question: AnamnesisQuestion, answerById: Map<number, string>): boolean {
    return (
      question.dependsOnId != null &&
      answerById.has(question.dependsOnId) &&
      normalizeText(answerById.get(question.dependsOnId)) === normalizeText(question.dependsOnAnswer)
    );
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
