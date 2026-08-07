import { PrismaService } from '@database/PrismaService';
import { BadRequestException, Injectable, NotFoundException } from '@nestjs/common';
import { Dream, DreamElement, EmotionKey, Prisma } from '@prisma/client';
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
   * Registra o sonho e já o decodifica: extrai os elementos centrais
   * (IA com fallback local) e pré-preenche significados/emoções a partir
   * do dicionário pessoal e das pessoas do círculo do usuário.
   */
  async create(userId: number, dto: CreateDreamDto) {
    const extracted = await this.gemini.extractElements(dto.text);

    const [dictionary, people] = await Promise.all([
      this.prisma.dictionaryEntry.findMany({ where: { userId } }),
      this.prisma.person.findMany({ where: { userId } }),
    ]);

    const dictBySymbol = new Map(dictionary.map((d) => [d.symbol.toLowerCase(), d]));
    const personByName = new Map(people.map((p) => [p.name.toLowerCase(), p]));

    const dream = await this.prisma.dream.create({
      data: {
        userId,
        text: dto.text,
        captureMode: dto.captureMode ?? 'Texto',
        eventToday: dto.eventToday?.trim() || null,
        timeframe: dto.timeframe ?? null,
        elements: {
          create: extracted.map((element, index) => {
            const known = dictBySymbol.get(element.word.toLowerCase());
            const person = personByName.get(element.word.toLowerCase());
            return {
              word: element.word,
              type: element.type,
              sortOrder: index,
              meaning: known?.meaning ?? null,
              emotionKey: known?.emotionKey ?? null,
              fromDictionary: !!known,
              isPerson: !!person || !!known?.isPerson,
              relation: person?.relation ?? known?.relation ?? null,
            };
          }),
        },
      },
      include: DREAM_INCLUDE,
    });

    return dream;
  }

  /** Atualiza as atribuições (significado pessoal + emoção) dos elementos. */
  async updateElements(userId: number, dreamId: number, dto: UpdateElementsDto) {
    const dream = await this.findOwned(userId, dreamId);

    const elementIds = new Set(dream.elements.map((e) => e.id));
    const invalid = dto.elements.find((e) => !elementIds.has(e.id));
    if (invalid) throw new BadRequestException(`Elemento ${invalid.id} não pertence a este sonho.`);

    await this.prisma.$transaction(
      dto.elements.map((element) =>
        this.prisma.dreamElement.update({
          where: { id: element.id },
          data: { meaning: element.meaning ?? undefined, emotionKey: element.emotionKey ?? undefined },
        }),
      ),
    );

    return this.findOwned(userId, dreamId);
  }

  /**
   * Gera o insight do sonho: calcula a emoção predominante a partir das
   * atribuições, monta o envelope de contexto (ficha + anamnese + histórico)
   * e pede a leitura à IA. Persiste o insight, atualiza o dicionário pessoal
   * e a sequência (streak) do usuário.
   */
  async generateInsight(userId: number, dreamId: number) {
    const dream = await this.findOwned(userId, dreamId);
    if (dream.insight) return dream;

    const assigned = dream.elements.filter((e) => e.emotionKey);
    if (assigned.length < 1) {
      throw new BadRequestException('Associe ao menos uma emoção antes de gerar o insight.');
    }

    const { main, secondary } = this.tally(assigned);

    const [profile, answers, recent, user] = await Promise.all([
      this.prisma.dreamerProfile.findUnique({ where: { userId } }),
      this.prisma.anamnesisAnswer.findMany({
        where: { userId },
        include: { question: true },
        orderBy: { updatedAt: 'desc' },
        take: 12,
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
      timeframe: dream.timeframe,
      mainEmotion: main,
      secondaryEmotion: secondary,
      elements: dream.elements.map((e) => ({
        word: e.word,
        meaning: e.meaning,
        emotionKey: e.emotionKey,
        isPerson: e.isPerson,
      })),
      profile: profile
        ? {
            nickname: profile.nickname,
            lifeMoment: profile.lifeMoment,
            work: profile.work,
            workFeel: profile.workFeel,
            passions: (profile.passions as string[]) ?? [],
            fears: (profile.fears as string[]) ?? [],
            currentEmotion: profile.currentEmotion,
            seeking: profile.seeking,
          }
        : null,
      anamnesis: answers.map((a) => ({ question: a.question.prompt, answer: a.answer })),
      recentMovements: recent.map((r) => r.movement!),
    };

    const generated = await this.gemini.generateInsight(envelope);

    const firstAssigned = assigned[0];
    const title = firstAssigned ? `O sonho de ${firstAssigned.word.toLowerCase()}` : 'Novo sonho';

    const streak = this.nextStreak(user?.lastDreamAt ?? null, user?.streakDays ?? 0);

    await this.prisma.$transaction([
      this.prisma.insight.create({
        data: {
          dreamId,
          userId,
          mainEmotion: main,
          secondaryEmotion: secondary,
          movement: generated.movement,
          message: generated.message,
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
        },
      }),
      ...assigned.map((element) =>
        this.prisma.dictionaryEntry.upsert({
          where: { userId_symbol: { userId, symbol: element.word } },
          update: {
            count: { increment: 1 },
            meaning: element.meaning ?? undefined,
            emotionKey: element.emotionKey!,
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

  private tally(assigned: DreamElement[]): { main: EmotionKey; secondary: EmotionKey | null } {
    const counts = new Map<EmotionKey, number>();
    for (const element of assigned) {
      counts.set(element.emotionKey!, (counts.get(element.emotionKey!) ?? 0) + 1);
    }
    const sorted = [...counts.entries()].sort((a, b) => b[1] - a[1]);
    return { main: sorted[0][0], secondary: sorted[1]?.[0] ?? null };
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
