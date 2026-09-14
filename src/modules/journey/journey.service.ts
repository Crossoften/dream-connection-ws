import { PrismaService } from '@database/PrismaService';
import { Injectable } from '@nestjs/common';
import { EmotionKey } from '@prisma/client';
import { EMOTION_MAP, emotionLabel } from '../ai/emotion.catalog';

const WEEKDAY_LETTERS = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

@Injectable()
export class JourneyService {
  constructor(private readonly prisma: PrismaService) {}

  /**
   * Painel da Jornada: emoção do mês, últimos 7 dias, distribuição, símbolos
   * recorrentes e as pessoas que estiveram presentes nos sonhos.
   */
  async dashboard(userId: number) {
    const since = new Date();
    since.setDate(since.getDate() - 90);

    const [elements, topSymbols, monthDreams, weekDreams, personElements] = await Promise.all([
      this.prisma.dreamElement.findMany({
        where: { dream: { userId, dreamedAt: { gte: since } }, emotionKey: { not: null } },
        select: { emotionKey: true },
      }),
      this.prisma.dictionaryEntry.findMany({
        where: { userId },
        orderBy: { count: 'desc' },
        take: 5,
      }),
      this.prisma.dream.findMany({
        where: {
          userId,
          mainEmotion: { not: null },
          dreamedAt: { gte: new Date(new Date().getFullYear(), new Date().getMonth(), 1) },
        },
        select: { mainEmotion: true, movement: true },
      }),
      this.prisma.dream.findMany({
        where: { userId, dreamedAt: { gte: this.daysAgo(6) } },
        select: { dreamedAt: true, mainEmotion: true },
      }),
      this.prisma.dreamElement.findMany({
        where: { isPerson: true, dream: { userId, status: 'Decodificado' } },
        select: { word: true, emotionKey: true, dreamId: true },
      }),
    ]);

    const distribution: Partial<Record<EmotionKey, number>> = {};
    for (const el of elements) {
      distribution[el.emotionKey!] = (distribution[el.emotionKey!] ?? 0) + 1;
    }

    const monthTally = this.tally(monthDreams.map((d) => d.mainEmotion!));
    const emotionOfMonth = monthTally[0]?.key ?? null;
    const monthLabel = emotionOfMonth
      ? monthDreams.find((d) => d.mainEmotion === emotionOfMonth)?.movement ??
        EMOTION_MAP.get(emotionOfMonth)?.movement ??
        null
      : null;

    const weekly = this.buildWeekly(weekDreams);

    return {
      distribution,
      topSymbols: topSymbols.map((t) => ({
        symbol: t.symbol,
        count: t.count,
        emotionKey: t.emotionKey,
      })),
      weekly,
      emotionOfMonth,
      monthLabel,
      summary: this.buildSummary(monthTally),
      people: this.buildPeople(personElements),
    };
  }

  /** Quem esteve nos sonhos: em quantos sonhos cada pessoa apareceu e a emoção mais ligada a ela. */
  private buildPeople(elements: { word: string; emotionKey: EmotionKey | null; dreamId: number }[]) {
    const byName = new Map<string, { name: string; dreams: Set<number>; emotions: EmotionKey[] }>();
    for (const el of elements) {
      const key = el.word.toLowerCase();
      const entry = byName.get(key) ?? { name: el.word, dreams: new Set<number>(), emotions: [] };
      entry.dreams.add(el.dreamId);
      if (el.emotionKey) entry.emotions.push(el.emotionKey);
      byName.set(key, entry);
    }
    return [...byName.values()]
      .map((p) => ({
        name: p.name,
        count: p.dreams.size,
        emotionKey: this.tally(p.emotions)[0]?.key ?? null,
      }))
      .sort((a, b) => b.count - a.count)
      .slice(0, 5);
  }

  private buildWeekly(dreams: { dreamedAt: Date; mainEmotion: EmotionKey | null }[]) {
    const days: { d: string; v: number; e: EmotionKey | null }[] = [];
    for (let i = 6; i >= 0; i--) {
      const day = this.daysAgo(i);
      const next = this.daysAgo(i - 1);
      const inDay = dreams.filter((d) => d.dreamedAt >= day && d.dreamedAt < next);
      const tally = this.tally(inDay.map((d) => d.mainEmotion).filter(Boolean) as EmotionKey[]);
      days.push({
        d: WEEKDAY_LETTERS[day.getDay()],
        v: inDay.length,
        e: tally[0]?.key ?? null,
      });
    }
    return days;
  }

  private buildSummary(tally: { key: EmotionKey; count: number }[]): string | null {
    if (!tally.length) return null;
    const first = emotionLabel(tally[0].key);
    const second = tally[1] ? emotionLabel(tally[1].key) : null;
    if (second) {
      return `Suas últimas semanas falam de ${first.toLowerCase()} — com ${second.toLowerCase()} aparecendo ao fundo. Continue registrando: cada sonho deixa a leitura mais sua.`;
    }
    return `Suas últimas semanas falam de ${first.toLowerCase()}. Continue registrando: cada sonho deixa a leitura mais sua.`;
  }

  private tally(keys: EmotionKey[]): { key: EmotionKey; count: number }[] {
    const counts = new Map<EmotionKey, number>();
    for (const key of keys) counts.set(key, (counts.get(key) ?? 0) + 1);
    return [...counts.entries()]
      .map(([key, count]) => ({ key, count }))
      .sort((a, b) => b.count - a.count);
  }

  private daysAgo(days: number): Date {
    const now = new Date();
    const day = new Date(now.getFullYear(), now.getMonth(), now.getDate());
    day.setDate(day.getDate() - days);
    return day;
  }
}
