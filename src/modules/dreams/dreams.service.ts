import { PrismaService } from '@database/PrismaService';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { AnamnesisQuestion, DreamElement, EmotionKey, Timeframe } from '@prisma/client';
import normalizeText from '@utils/normalizeText';
import { GeminiService, InsightEnvelope } from '../ai/gemini.service';
import { CreateDreamDto } from './dto/create-dream.dto';
import { UpdateElementsDto } from './dto/update-elements.dto';

const DREAM_INCLUDE = { elements: { orderBy: { sortOrder: 'asc' } }, insight: true } as const;

@Injectable()
export class DreamsService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly gemini: GeminiService,
  ) {}

  /**
   * Registra o sonho e extrai os elementos centrais em ordem de relevância
   * (IA com fallback local). Símbolos já conhecidos vêm pré-preenchidos com o
   * significado e a emoção do dicionário pessoal; pessoas são reconhecidas
   * pela extração e pelo dicionário.
   */
  async create(userId: number, dto: CreateDreamDto) {
    const [extracted, dictionary] = await Promise.all([
      this.gemini.extractElements(dto.text),
      this.prisma.dictionaryEntry.findMany({ where: { userId } }),
    ]);

    const dictBySymbol = new Map(dictionary.map((d) => [d.symbol.toLowerCase(), d]));

    return this.prisma.dream.create({
      data: {
        userId,
        text: dto.text,
        captureMode: dto.captureMode ?? 'Texto',
        eventToday: dto.eventToday?.trim() || null,
        elements: {
          create: extracted.map((element, index) => {
            const known = dictBySymbol.get(element.word.toLowerCase());
            return {
              word: element.word,
              type: element.type,
              sortOrder: index,
              meaning: known?.meaning ?? null,
              emotionKey: known?.emotionKey ?? null,
              fromDictionary: !!known,
              isPerson: element.isPerson || !!known?.isPerson,
              relation: known?.relation ?? null,
            };
          }),
        },
      },
      include: DREAM_INCLUDE,
    });
  }

  /** Atualiza as atribuições dos elementos: significado, emoção e tempo. */
  async updateElements(userId: number, dreamId: number, dto: UpdateElementsDto) {
    const dream = await this.findOwned(userId, dreamId);

    const elementIds = new Set(dream.elements.map((e) => e.id));
    const invalid = dto.elements.find((e) => !elementIds.has(e.id));
    if (invalid) throw new BadRequestException(`Elemento ${invalid.id} não pertence a este sonho.`);

    await this.prisma.$transaction(
      dto.elements.map((element) =>
        this.prisma.dreamElement.update({
          where: { id: element.id },
          data: {
            meaning: element.meaning ?? undefined,
            emotionKey: element.emotionKey ?? undefined,
            timeframe: element.timeframe === undefined ? undefined : element.timeframe,
          },
        }),
      ),
    );

    return this.findOwned(userId, dreamId);
  }

  /**
   * Decodifica o sonho: calcula as emoções predominantes a partir das
   * atribuições, monta o contexto (ficha anamnéstica inteira, símbolos que se
   * repetem, evento do dia, movimentos recentes) e pede à IA a decodificação no
   * formato do relatório do idealizador. Persiste o resultado, atualiza o
   * dicionário pessoal e a sequência de noites.
   */
  async generateInsight(userId: number, dreamId: number) {
    const dream = await this.findOwned(userId, dreamId);
    if (dream.insight) return dream;

    const assigned = dream.elements.filter((e) => e.emotionKey);
    if (assigned.length < 1) {
      throw new BadRequestException('Associe ao menos uma emoção antes de decodificar.');
    }

    const { main, secondary } = this.tally(assigned);

    const [answers, knownSymbols, recent, user] = await Promise.all([
      this.prisma.anamnesisAnswer.findMany({
        where: { userId, question: { active: true } },
        include: { question: true },
        orderBy: { question: { sortOrder: 'asc' } },
      }),
      this.prisma.dictionaryEntry.findMany({
        where: { userId, symbol: { in: assigned.map((e) => e.word) } },
        select: { symbol: true, count: true },
      }),
      this.prisma.dream.findMany({
        where: { userId, movement: { not: null }, id: { not: dreamId } },
        orderBy: { dreamedAt: 'desc' },
        take: 5,
        select: { movement: true },
      }),
      this.prisma.user.findUnique({ where: { id: userId } }),
    ]);

    const envelope: InsightEnvelope = {
      dreamText: dream.text,
      eventToday: dream.eventToday,
      mainEmotion: main,
      secondaryEmotion: secondary,
      elements: dream.elements.map((e) => ({
        word: e.word,
        meaning: e.meaning,
        emotionKey: e.emotionKey,
        timeframe: e.timeframe,
        isPerson: e.isPerson,
      })),
      recurrence: knownSymbols
        .filter((s) => s.count > 0)
        .sort((a, b) => b.count - a.count)
        .map((s) => ({ symbol: s.symbol, previousDreams: s.count })),
      anamnesis: this.applicableAnswers(answers).map((a) => ({
        question: a.question.prompt,
        answer: a.answer,
      })),
      recentMovements: recent.map((r) => r.movement!),
    };

    const generated = await this.gemini.generateInsight(envelope);

    const title = `O sonho de ${this.titleWord(assigned[0].word, dream.text)}`;
    const streak = this.nextStreak(user?.lastDreamAt ?? null, user?.streakDays ?? 0);

    await this.prisma.$transaction([
      this.prisma.insight.create({
        data: {
          dreamId,
          userId,
          mainEmotion: main,
          secondaryEmotion: secondary,
          movement: generated.movement,
          emotionalState: generated.emotionalState,
          message: generated.message,
          finalMessage: generated.finalMessage,
          aiModel: generated.aiModel ?? null,
          promptTokens: generated.promptTokens ?? null,
          outputTokens: generated.outputTokens ?? null,
        },
      }),
      this.prisma.dream.update({
        where: { id: dreamId },
        data: {
          status: 'Decodificado',
          title,
          mainEmotion: main,
          secondaryEmotion: secondary,
          movement: generated.movement,
          timeframe: this.predominantTimeframe(assigned),
        },
      }),
      ...assigned.map((element) =>
        this.prisma.dictionaryEntry.upsert({
          where: { userId_symbol: { userId, symbol: element.word } },
          update: {
            count: { increment: 1 },
            meaning: element.meaning ?? undefined,
            emotionKey: element.emotionKey!,
            isPerson: element.isPerson || undefined,
          },
          create: {
            userId,
            symbol: element.word,
            meaning: element.meaning ?? null,
            emotionKey: element.emotionKey!,
            isPerson: element.isPerson,
            relation: element.relation,
            count: 1,
          },
        }),
      ),
      this.prisma.user.update({
        where: { id: userId },
        data: { dreamsTotal: { increment: 1 }, streakDays: streak, lastDreamAt: new Date() },
      }),
    ]);

    return this.findOwned(userId, dreamId);
  }

  async findAll(userId: number) {
    return this.prisma.dream.findMany({
      where: { userId },
      orderBy: { dreamedAt: 'desc' },
      include: DREAM_INCLUDE,
    });
  }

  async findOwned(userId: number, dreamId: number) {
    const dream = await this.prisma.dream.findFirst({
      where: { id: dreamId, userId },
      include: DREAM_INCLUDE,
    });
    if (!dream) throw new NotFoundException('Sonho não encontrado.');
    return dream;
  }

  /**
   * Respostas que ainda valem: uma pergunta encadeada só entra se a resposta
   * atual da pergunta-mãe continua sendo a que a liberou (o sonhador pode ter
   * voltado e mudado a resposta da mãe depois de responder a filha).
   */
  private applicableAnswers<T extends { questionId: number; answer: string; question: AnamnesisQuestion }>(
    answers: T[],
  ): T[] {
    const byQuestion = new Map(answers.map((a) => [a.questionId, a.answer]));
    return answers.filter(
      (a) =>
        a.question.dependsOnId == null ||
        normalizeText(byQuestion.get(a.question.dependsOnId)) === normalizeText(a.question.dependsOnAnswer),
    );
  }

  private tally(assigned: DreamElement[]): { main: EmotionKey; secondary: EmotionKey | null } {
    const counts = new Map<EmotionKey, number>();
    for (const element of assigned) {
      counts.set(element.emotionKey!, (counts.get(element.emotionKey!) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { main: sorted[0][0], secondary: sorted[1]?.[0] ?? null };
  }

  /**
   * Palavra do título em minúscula, salvo nome próprio: quando o relato só traz
   * a palavra com inicial maiúscula ("Matheus"), ela fica como está.
   */
  private titleWord(word: string, text: string): string {
    const lower = word.toLowerCase();
    const properName = word !== lower && text.includes(word) && !text.includes(lower);
    return properName ? word : lower;
  }

  /** O tempo mais marcado entre os elementos; nulo quando nenhum foi marcado. */
  private predominantTimeframe(elements: DreamElement[]): Timeframe | null {
    const counts = new Map<Timeframe, number>();
    for (const e of elements) {
      if (e.timeframe) counts.set(e.timeframe, (counts.get(e.timeframe) ?? 0) + 1);
    }
    return [...counts.entries()].sort((a, b) => b[1] - a[1])[0]?.[0] ?? null;
  }

  private nextStreak(lastDreamAt: Date | null, current: number): number {
    if (!lastDreamAt) return 1;
    const startOfDay = (d: Date) => new Date(d.getFullYear(), d.getMonth(), d.getDate()).getTime();
    const today = startOfDay(new Date());
    const last = startOfDay(lastDreamAt);
    const oneDay = 24 * 60 * 60 * 1000;
    if (last === today) return Math.max(current, 1);
    if (today - last === oneDay) return current + 1;
    return 1;
  }
}
