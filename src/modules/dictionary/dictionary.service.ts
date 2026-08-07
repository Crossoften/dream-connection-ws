import { PrismaService } from '@database/PrismaService';
import { Injectable } from '@nestjs/common';

@Injectable()
export class DictionaryService {
  constructor(private readonly prisma: PrismaService) {}

  async findAll(userId: number, query?: string) {
    const entries = await this.prisma.dictionaryEntry.findMany({
      where: {
        userId,
        ...(query?.trim()
          ? {
              OR: [
                { symbol: { contains: query.trim() } },
                { meaning: { contains: query.trim() } },
              ],
            }
          : {}),
      },
      orderBy: [{ count: 'desc' }, { updatedAt: 'desc' }],
    });

    const total = await this.prisma.dictionaryEntry.count({ where: { userId } });
    return { total, entries };
  }
}
