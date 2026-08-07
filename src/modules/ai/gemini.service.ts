import { Injectable, Logger } from '@nestjs/common';
import { EmotionKey, ElementType, Timeframe } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';
import { EMOTIONS, EMOTION_MAP, STOPWORDS, emotionLabel } from './emotion.catalog';

export interface ExtractedElement {
  word: string;
  type: ElementType;
}

export interface InsightEnvelope {
  dreamText: string;
  eventToday?: string | null;
  timeframe?: Timeframe | null;
  mainEmotion: EmotionKey;
  secondaryEmotion?: EmotionKey | null;
  elements: {
    word: string;
    meaning?: string | null;
    emotionKey?: EmotionKey | null;
    isPerson?: boolean;
  }[];
  profile?: {
    nickname?: string | null;
    lifeMoment?: string | null;
    work?: string | null;
    workFeel?: string | null;
    passions?: string[];
    fears?: string[];
    currentEmotion?: EmotionKey | null;
    seeking?: string | null;
  } | null;
  anamnesis?: { question: string; answer: string }[];
  recentMovements?: string[];
}

export interface GeneratedInsight {
  movement: string;
  message: string;
  aiModel?: string;
  promptTokens?: number;
  outputTokens?: number;
}

/**
 * Metodologia Dream Connection (base: reuniões com o idealizador):
 * — o sonho é um CÓDIGO pessoal, não um dicionário universal de símbolos;
 * — a leitura nasce das associações que o próprio usuário atribuiu;
 * — o tom é acolhedor e levemente místico ("horóscopo leve"): amplo,
 *   subjetivo e estimulante, para que a pessoa continue explorando os
 *   próprios sonhos — nunca determinista, nunca diagnóstico, nunca previsão
 *   concreta de eventos.
 */
const INSIGHT_SYSTEM_INSTRUCTION = `Você é a voz do Dream Connection, um aplicativo de decodificação emocional de sonhos.

Sua tarefa é escrever a leitura ("insight") de um sonho a partir do material que o usuário forneceu.

Regras do método — siga TODAS:
1. O significado é sempre do sonhador. Use exclusivamente as associações que ele atribuiu aos elementos (palavra → significado → emoção). Nunca use interpretações universais de símbolos.
2. Tom: acolhedor, caloroso e levemente místico, como um horóscopo bem escrito. Frases amplas e abertas, que estimulem a reflexão e a vontade de registrar novos sonhos.
3. Sempre subjetivo e probabilístico: use "sugere", "aponta", "parece", "convida". NUNCA afirme que algo vai acontecer, NUNCA faça diagnóstico ou promessa, NUNCA preveja eventos concretos, NUNCA mencione morte, doença ou tragédia como previsão.
4. Escreva em português brasileiro, na segunda pessoa ("você"), em 4 a 6 frases corridas (sem listas, sem títulos).
5. Estruture o texto nesta ordem: (a) a emoção principal que o sonho carrega; (b) o que os significados dados pelo sonhador revelam como movimento interno; (c) se houver emoção secundária, o fundo que ela adiciona; (d) se o sonho for do passado/presente/futuro, uma frase conectando a esse tempo; (e) se houver um compromisso importante hoje, uma sugestão gentil de postura para o dia (cautela leve, sem alarme); (f) uma mensagem final curta de acolhimento — no espírito de "mensagem ao sonhador".
6. Se a ficha anamnéstica trouxer contexto (momento de vida, medos, o que busca), deixe isso colorir sutilmente a leitura, sem citar a ficha diretamente.
7. Não repita o relato do sonho literalmente; transforme-o em leitura emocional.

Além do texto, defina "movement": um rótulo curto (2 a 4 palavras) para o movimento interno do sonho, no estilo: "Resolução afetiva", "Abertura para o novo", "Travessia de um receio".

Responda SOMENTE com JSON válido no formato: {"movement": string, "message": string}.`;

const EXTRACT_SYSTEM_INSTRUCTION = `Você extrai os elementos centrais de relatos de sonhos em português.

Regras:
1. Extraia no máximo 8 elementos, na ordem em que aparecem: substantivos, verbos, adjetivos e pronomes significativos.
2. Ignore artigos, preposições, advérbios e palavras vazias. Cada palavra aparece UMA única vez (deduplique variações: "mãe" citada 4 vezes = 1 elemento).
3. Nomes próprios de pessoas são substantivos e devem ser mantidos com a inicial maiúscula.
4. Verbos vão no infinitivo ("correndo" → "Correr"). Substantivos no singular, com inicial maiúscula.
5. Classifique cada elemento como: Substantivo, Verbo, Adjetivo ou Pronome.

Responda SOMENTE com JSON válido: {"elements": [{"word": string, "type": "Substantivo"|"Verbo"|"Adjetivo"|"Pronome"}]}.`;

@Injectable()
export class GeminiService {
  private readonly logger = new Logger(GeminiService.name);
  private readonly client: GoogleGenAI | null = null;
  readonly model: string;

  constructor() {
    const apiKey = process.env.GEMINI_API_KEY;
    this.model = process.env.GEMINI_MODEL || 'gemini-flash-latest';
    if (apiKey) {
      this.client = new GoogleGenAI({ apiKey });
    } else {
      this.logger.warn('GEMINI_API_KEY ausente — IA desativada, usando fallbacks locais.');
    }
  }

  get enabled(): boolean {
    return this.client !== null;
  }

  /**
   * Chama o Gemini com tolerância a picos (429/503) e a conexões penduradas:
   * timeout de 15s por tentativa, deadline global de 40s, e cadeia de modelos
   * reserva antes de desistir (quando o chamador cai no fallback local).
   */
  private async generateWithRetry(
    params: {
      contents: string;
      config: Record<string, unknown>;
    },
    limits: { deadlineMs?: number; attemptTimeoutMs?: number } = {},
  ): Promise<{ response: any; modelUsed: string }> {
    const fallbacks = (process.env.GEMINI_FALLBACK_MODELS || 'gemini-flash-latest,gemini-2.0-flash')
      .split(',')
      .map((m) => m.trim())
      .filter(Boolean);
    const attempts = [this.model, this.model, ...fallbacks];
    const deadline = Date.now() + (limits.deadlineMs ?? 40_000);
    // O Gemini exige deadline mínimo de 10s por chamada.
    const MIN_TIMEOUT = 10_000;
    const ATTEMPT_TIMEOUT = Math.max(limits.attemptTimeoutMs ?? 15_000, MIN_TIMEOUT);

    let lastError: any;
    for (let i = 0; i < attempts.length; i++) {
      const remaining = deadline - Date.now();
      if (remaining <= MIN_TIMEOUT) break;
      const timeout = Math.max(MIN_TIMEOUT, Math.min(ATTEMPT_TIMEOUT, remaining));
      try {
        const call = this.client!.models.generateContent({
          model: attempts[i],
          ...params,
          config: { ...params.config, httpOptions: { timeout } },
        } as any);
        const response = await Promise.race([
          call,
          new Promise((_, reject) =>
            setTimeout(() => reject(new Error(`Gemini timeout após ${timeout}ms`)), timeout + 500),
          ),
        ]);
        return { response, modelUsed: attempts[i] };
      } catch (error) {
        lastError = error;
        const message = String(error?.message ?? '');
        const transient =
          /"code":\s*(429|500|503|504)|UNAVAILABLE|RESOURCE_EXHAUSTED|DEADLINE_EXCEEDED|timeout|fetch failed/i.test(
            message,
          );
        if (!transient && i === 0) throw error;
        if (i < attempts.length - 1) {
          this.logger.warn(
            `Gemini indisponível em ${attempts[i]} (tentativa ${i + 1}: ${message.slice(0, 120)}) — tentando ${attempts[i + 1]}.`,
          );
          await new Promise((resolve) => setTimeout(resolve, 600));
        }
      }
    }
    throw lastError;
  }

  // -------------------------------------------------------------------------
  // Extração de elementos
  // -------------------------------------------------------------------------

  async extractElements(text: string): Promise<ExtractedElement[]> {
    if (this.client) {
      try {
        const { response } = await this.generateWithRetry(
          {
            contents: `Relato do sonho:\n"""${text}"""`,
            config: {
              systemInstruction: EXTRACT_SYSTEM_INSTRUCTION,
              responseMimeType: 'application/json',
              responseSchema: {
                type: Type.OBJECT,
                properties: {
                  elements: {
                    type: Type.ARRAY,
                    items: {
                      type: Type.OBJECT,
                      properties: {
                        word: { type: Type.STRING },
                        type: {
                          type: Type.STRING,
                          enum: ['Substantivo', 'Verbo', 'Adjetivo', 'Pronome'],
                        },
                      },
                      required: ['word', 'type'],
                    },
                  },
                },
                required: ['elements'],
              },
              temperature: 0.2,
            },
          },
          { deadlineMs: 24_000, attemptTimeoutMs: 10_000 },
        );

        const parsed = JSON.parse(response.text ?? '{}');
        const elements: ExtractedElement[] = (parsed.elements ?? [])
          .filter((e: any) => typeof e.word === 'string' && e.word.trim().length > 1)
          .slice(0, 8)
          .map((e: any) => ({
            word: this.capitalize(e.word.trim()),
            type: this.normalizeType(e.type),
          }));

        if (elements.length > 0) return this.dedupe(elements);
        this.logger.warn('Extração via Gemini vazia — usando fallback local.');
      } catch (error) {
        this.logger.error(
          `Falha na extração via Gemini: ${error.message} — usando fallback local.`,
        );
      }
    }
    return this.extractElementsLocal(text);
  }

  /** Heurística local (mesma do protótipo) para ambientes sem IA. */
  extractElementsLocal(text: string): ExtractedElement[] {
    const tokens = text
      .replace(/[\n\r]/g, ' ')
      .split(/[^A-Za-zÀ-ÿ]+/)
      .filter(Boolean);

    const seen = new Set<string>();
    const out: ExtractedElement[] = [];

    for (const token of tokens) {
      const lower = token.toLowerCase();
      if (lower.length < 4 || STOPWORDS.has(lower) || seen.has(lower)) continue;
      seen.add(lower);
      const capitalized = token.charAt(0) !== token.charAt(0).toLowerCase();
      out.push({
        word: capitalized ? token : this.capitalize(lower),
        type: this.guessType(lower),
      });
      if (out.length >= 8) break;
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Geração de insight
  // -------------------------------------------------------------------------

  async generateInsight(envelope: InsightEnvelope): Promise<GeneratedInsight> {
    if (this.client) {
      try {
        const { response, modelUsed } = await this.generateWithRetry({
          contents: this.buildInsightPrompt(envelope),
          config: {
            systemInstruction: INSIGHT_SYSTEM_INSTRUCTION,
            responseMimeType: 'application/json',
            responseSchema: {
              type: Type.OBJECT,
              properties: {
                movement: { type: Type.STRING },
                message: { type: Type.STRING },
              },
              required: ['movement', 'message'],
            },
            temperature: 0.85,
          },
        });

        const parsed = JSON.parse(response.text ?? '{}');
        if (parsed.message && parsed.movement) {
          return {
            movement: String(parsed.movement).slice(0, 80),
            message: String(parsed.message).trim(),
            aiModel: modelUsed,
            promptTokens: response.usageMetadata?.promptTokenCount,
            outputTokens: response.usageMetadata?.candidatesTokenCount,
          };
        }
        this.logger.warn('Insight via Gemini incompleto — usando fallback local.');
      } catch (error) {
        this.logger.error(`Falha no insight via Gemini: ${error.message} — usando fallback local.`);
      }
    }
    return this.generateInsightLocal(envelope);
  }

  private buildInsightPrompt(envelope: InsightEnvelope): string {
    const lines: string[] = [];
    const mainLabel = emotionLabel(envelope.mainEmotion);

    lines.push('## Sonho relatado');
    lines.push(`"""${envelope.dreamText}"""`);

    lines.push('\n## Associações do sonhador (palavra → significado pessoal → emoção)');
    for (const el of envelope.elements) {
      if (!el.emotionKey) continue;
      const meaning = el.meaning ? ` → "${el.meaning}"` : '';
      const person = el.isPerson ? ' (pessoa do círculo do sonhador)' : '';
      lines.push(`- ${el.word}${meaning} → ${emotionLabel(el.emotionKey)}${person}`);
    }

    lines.push(`\n## Emoção principal do sonho: ${mainLabel}`);
    if (envelope.secondaryEmotion) {
      lines.push(`## Emoção secundária: ${emotionLabel(envelope.secondaryEmotion)}`);
    }
    if (envelope.timeframe) {
      lines.push(`## Para o sonhador, este sonho fala do: ${envelope.timeframe}`);
    }
    if (envelope.eventToday?.trim()) {
      lines.push(`## Compromisso importante do sonhador hoje: ${envelope.eventToday.trim()}`);
    }

    const p = envelope.profile;
    if (p) {
      lines.push('\n## Ficha anamnéstica (contexto — não citar diretamente)');
      if (p.nickname) lines.push(`- Prefere ser chamado(a) de: ${p.nickname}`);
      if (p.lifeMoment) lines.push(`- Momento de vida: ${p.lifeMoment}`);
      if (p.work)
        lines.push(`- Ocupação: ${p.work}${p.workFeel ? ` (sente-se: ${p.workFeel})` : ''}`);
      if (p.passions?.length) lines.push(`- Paixões: ${p.passions.join(', ')}`);
      if (p.fears?.length) lines.push(`- O que costuma preocupar: ${p.fears.join(', ')}`);
      if (p.currentEmotion)
        lines.push(`- Emoção que mais acompanha agora: ${emotionLabel(p.currentEmotion)}`);
      if (p.seeking) lines.push(`- O que busca: ${p.seeking}`);
    }

    if (envelope.anamnesis?.length) {
      lines.push('\n## Anamnese contínua (respostas recentes — contexto sutil)');
      for (const qa of envelope.anamnesis.slice(0, 12)) {
        lines.push(`- ${qa.question} → ${qa.answer}`);
      }
    }

    if (envelope.recentMovements?.length) {
      lines.push(`\n## Movimentos dos últimos sonhos: ${envelope.recentMovements.join(' · ')}`);
    }

    lines.push('\nEscreva agora o insight seguindo as regras.');
    return lines.join('\n');
  }

  /** Fallback local (mesma composição do protótipo navegável). */
  generateInsightLocal(envelope: InsightEnvelope): GeneratedInsight {
    const main = EMOTION_MAP.get(envelope.mainEmotion) ?? EMOTIONS[0];
    const secondary = envelope.secondaryEmotion ? EMOTION_MAP.get(envelope.secondaryEmotion) : null;
    const meanings = envelope.elements
      .filter((e) => e.meaning)
      .map((e) => e.meaning!.toLowerCase());

    const s1 = `Seu sonho carrega sobretudo ${main.label.toLowerCase()}.`;
    const s2 = meanings.length
      ? `Os sentidos que você deu — ${this.joinNice(meanings)} — apontam para um momento de ${main.movement.toLowerCase()}.`
      : `Há um movimento de ${main.movement.toLowerCase()} atravessando a cena.`;
    const s3 = secondary
      ? ` No fundo, ${secondary.label.toLowerCase()} acompanha o que você sentiu.`
      : '';
    const s4 = ` ${main.closing}`;
    const timeframeMap: Record<Timeframe, string> = {
      Passado: 'Ele parece conversar com algo do seu passado.',
      Presente: 'Ele dialoga com o seu presente.',
      Futuro: 'Ele aponta para o que ainda está por vir.',
    };
    const s5 = envelope.timeframe ? ` ${timeframeMap[envelope.timeframe]}` : '';
    const event = envelope.eventToday?.trim();
    const s6 = event
      ? ` Com ${event.toLowerCase()} à vista hoje, deixe que essa leitura te acompanhe com leveza.`
      : '';

    return {
      movement: main.movement,
      message: `${s1} ${s2}${s3}${s4}${s5}${s6}`,
    };
  }

  // -------------------------------------------------------------------------
  // Utilitários
  // -------------------------------------------------------------------------

  private joinNice(items: string[]): string {
    if (items.length <= 1) return items.join('');
    return `${items.slice(0, -1).join(', ')} e ${items[items.length - 1]}`;
  }

  private capitalize(word: string): string {
    return word.charAt(0).toUpperCase() + word.slice(1);
  }

  private guessType(word: string): ElementType {
    if (
      /^(meu|minha|meus|minhas|seu|sua|suas|seus|dele|dela|deles|delas|nosso|nossa|voc[eê]|voc[eê]s|algu[eé]m|ningu[eé]m|ele|ela|eles|elas|isso|isto|aquilo)$/.test(
        word,
      )
    ) {
      return 'Pronome';
    }
    if (/(ar|er|ir)$/.test(word)) return 'Verbo';
    if (/(oso|osa|vel|ado|ada|ico|ica|ante|ente)$/.test(word)) return 'Adjetivo';
    return 'Substantivo';
  }

  private normalizeType(type: string): ElementType {
    const valid: ElementType[] = ['Substantivo', 'Verbo', 'Adjetivo', 'Pronome'];
    return valid.includes(type as ElementType) ? (type as ElementType) : 'Substantivo';
  }

  private dedupe(elements: ExtractedElement[]): ExtractedElement[] {
    const seen = new Set<string>();
    return elements.filter((e) => {
      const key = e.word.toLowerCase();
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}
