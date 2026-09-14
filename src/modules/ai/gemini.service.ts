import { Injectable, Logger } from '@nestjs/common';
import { EmotionKey, ElementType, Timeframe } from '@prisma/client';
import { GoogleGenAI, Type } from '@google/genai';
import { EMOTIONS, EMOTION_MAP, STOPWORDS, emotionLabel } from './emotion.catalog';

export interface ExtractedElement {
  word: string;
  type: ElementType;
  isPerson: boolean;
}

export interface InsightEnvelope {
  dreamText: string;
  eventToday?: string | null;
  mainEmotion: EmotionKey;
  secondaryEmotion?: EmotionKey | null;
  elements: {
    word: string;
    meaning?: string | null;
    emotionKey?: EmotionKey | null;
    timeframe?: Timeframe | null;
    isPerson?: boolean;
  }[];
  /** Símbolos deste sonho que já apareceram antes, com quantas vezes. */
  recurrence?: { symbol: string; previousDreams: number }[];
  anamnesis?: { question: string; answer: string }[];
  recentMovements?: string[];
}

export interface GeneratedInsight {
  movement: string;
  emotionalState: string;
  message: string;
  finalMessage: string;
  aiModel?: string;
  promptTokens?: number;
  outputTokens?: number;
}

const TIMEFRAME_LABEL: Record<Timeframe, string> = {
  Passado: 'passado',
  Presente: 'presente',
  Futuro: 'futuro',
};

/**
 * Método Dream Connection, conforme o idealizador (reuniões de 19/06, 30/06 e
 * 20/07/2026 e o "Relatório de Decodificação Emocional" que ele enviou):
 * — o sonho é um código pessoal, não um dicionário universal de símbolos;
 * — a decodificação nasce das associações que o próprio sonhador atribuiu;
 * — o app traz a solução, sem expor o processo ("não precisa colocar que ele
 *   falou que vaca é isso", 20/07);
 * — tom acolhedor e subjetivo, nunca previsão nem diagnóstico;
 * — o resultado segue o relatório dele: movimento e estado emocional
 *   identificados, a mensagem emocional do sonho e a mensagem final ao
 *   sonhador. A seção do relatório que percorre elemento por elemento fica de
 *   fora, pela mesma regra de não expor o processo.
 */
const INSIGHT_SYSTEM_INSTRUCTION = `Você é a voz do Dream Connection — o Método de Decodificação Emocional dos Sonhos.

Sua tarefa é escrever a decodificação emocional de um sonho a partir do material que o sonhador forneceu.

Regras do método — siga TODAS:
1. O significado é sempre do sonhador. Use exclusivamente as associações que ele deu aos elementos (palavra → significado pessoal → emoção). Nunca use significados universais de símbolos.
2. Traga a solução, não o processo: não liste os elementos e não repita "isto significa aquilo". Diga o que o sonho, decodificado, parece revelar ao sonhador.
3. Tom acolhedor, caloroso e levemente místico. Frases amplas e abertas, que estimulem a reflexão e a vontade de registrar novos sonhos.
4. Sempre subjetivo e probabilístico: "sugere", "aponta", "parece", "convida". NUNCA afirme que algo vai acontecer, NUNCA faça diagnóstico ou promessa, NUNCA preveja eventos concretos, NUNCA mencione morte, doença ou tragédia como previsão.
5. Português do Brasil, segunda pessoa ("você"). Seja breve: leituras longas cansam o sonhador. Respeite os limites de palavras abaixo.
6. Quando um elemento vier marcado como do passado, do presente ou do futuro, deixe essa marca orientar o que aquele elemento diz.
7. Se um símbolo já apareceu em sonhos anteriores, trate a repetição como um sinal: algo que o inconsciente insiste em mostrar.
8. Se o sonhador informou um compromisso importante hoje, observe com delicadeza se o sonho parece dialogar com esse foco do dia. O compromisso aparece SÓ na mensagem final, como uma postura sugerida para o dia — cautela leve, sem alarme. Não o mencione na mensagem emocional.
9. As respostas da ficha anamnéstica são contexto: deixe-as colorir a leitura com sutileza, sem citá-las. Saúde, doenças, remédios, álcool, drogas, gravidez, vida sexual, religião e dinheiro do sonhador NUNCA aparecem no texto. As cores que o sonhador associou a sentimentos valem como associação pessoal quando uma cor surgir no sonho.

Responda SOMENTE com JSON válido, com estes campos:
- "message": a Mensagem Emocional do Sonho — o que o sonho, decodificado, sugere ao sonhador —, em no máximo 2 frases e 45 palavras, sem percorrer os elementos um a um.
- "finalMessage": a Mensagem Final ao Sonhador, em no máximo 2 frases curtas e 30 palavras de acolhimento.
- "movement": o Movimento Emocional Identificado — rótulo de 2 a 4 palavras, como "Resolução afetiva", "Abertura para o novo" ou "Travessia de um receio".
- "emotionalState": o Estado Emocional Predominante — rótulo de 2 a 5 palavras, como "Fortalecimento de vínculos familiares".`;

const EXTRACT_SYSTEM_INSTRUCTION = `Você extrai os elementos centrais de relatos de sonhos em português.

Regras:
1. Extraia no máximo 8 elementos, entre substantivos, verbos, adjetivos e pronomes significativos.
2. Ordene por RELEVÂNCIA para o sonho: primeiro o que é mais central na cena (quem está nela, o que acontece, o que chama atenção); por último o acessório.
3. Ignore artigos, preposições, advérbios, palavras vazias e o próprio ato de sonhar ("sonhei", "sonho"). Cada palavra aparece UMA única vez (deduplique variações: "mãe" citada 4 vezes = 1 elemento).
4. Nomes próprios de pessoas são substantivos e ficam com a inicial maiúscula.
5. Verbos vão no infinitivo ("correndo" → "Correr"). Substantivos no singular, com inicial maiúscula.
6. Classifique cada elemento como Substantivo, Verbo, Adjetivo ou Pronome.
7. Marque "isPerson": true quando o elemento for uma pessoa — nome próprio ou papel de relação (mãe, pai, filho, irmã, avó, amigo, namorada, chefe…). Nos demais casos, false.

Responda SOMENTE com JSON válido: {"elements": [{"word": string, "type": "Substantivo"|"Verbo"|"Adjetivo"|"Pronome", "isPerson": boolean}]}.`;

/** Papéis de relação reconhecidos pela extração local (sem IA). */
const PERSON_WORDS = new Set([
  'mae', 'pai', 'filho', 'filha', 'irmao', 'irma', 'avo', 'avos', 'tio', 'tia', 'primo', 'prima',
  'esposa', 'marido', 'namorado', 'namorada', 'amigo', 'amiga', 'chefe', 'sogra', 'sogro', 'neto', 'neta',
  'bebe', 'crianca', 'professor', 'professora',
]);

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
                        isPerson: { type: Type.BOOLEAN },
                      },
                      required: ['word', 'type', 'isPerson'],
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
            isPerson: e.isPerson === true,
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

    for (const [position, token] of tokens.entries()) {
      const lower = token.toLowerCase();
      if (lower.length < 3 || STOPWORDS.has(lower) || seen.has(lower) || /^sonh/.test(lower)) continue;
      const plain = lower.normalize('NFD').replace(/[\u0300-\u036f]/g, '');
      const isRelation = PERSON_WORDS.has(plain);
      if (lower.length < 4 && !isRelation) continue;
      seen.add(lower);
      const capitalized = token.charAt(0) !== token.charAt(0).toLowerCase();
      out.push({
        word: capitalized ? token : this.capitalize(lower),
        type: this.guessType(lower),
        isPerson: isRelation || (capitalized && position > 0),
      });
      if (out.length >= 8) break;
    }
    return out;
  }

  // -------------------------------------------------------------------------
  // Decodificação
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
                message: { type: Type.STRING },
                finalMessage: { type: Type.STRING },
                movement: { type: Type.STRING },
                emotionalState: { type: Type.STRING },
              },
              required: ['message', 'finalMessage', 'movement', 'emotionalState'],
            },
            temperature: 0.85,
          },
        });

        const parsed = JSON.parse(response.text ?? '{}');
        if (parsed.message && parsed.finalMessage && parsed.movement && parsed.emotionalState) {
          return {
            movement: String(parsed.movement).trim().slice(0, 80),
            emotionalState: String(parsed.emotionalState).trim().slice(0, 190),
            message: String(parsed.message).trim(),
            finalMessage: String(parsed.finalMessage).trim(),
            aiModel: modelUsed,
            promptTokens: response.usageMetadata?.promptTokenCount,
            outputTokens: response.usageMetadata?.candidatesTokenCount,
          };
        }
        this.logger.warn('Decodificação via Gemini incompleta — usando fallback local.');
      } catch (error) {
        this.logger.error(
          `Falha na decodificação via Gemini: ${error.message} — usando fallback local.`,
        );
      }
    }
    return this.generateInsightLocal(envelope);
  }

  private buildInsightPrompt(envelope: InsightEnvelope): string {
    const lines: string[] = [];

    lines.push('## Sonho relatado');
    lines.push(`"""${envelope.dreamText}"""`);

    lines.push('\n## Associações do sonhador (palavra → significado pessoal → emoção [→ tempo])');
    for (const el of envelope.elements) {
      if (!el.emotionKey) continue;
      const meaning = el.meaning ? ` → "${el.meaning}"` : '';
      const time = el.timeframe ? ` → fala do ${TIMEFRAME_LABEL[el.timeframe]}` : '';
      const person = el.isPerson ? ' (pessoa)' : '';
      lines.push(`- ${el.word}${person}${meaning} → ${emotionLabel(el.emotionKey)}${time}`);
    }

    lines.push(`\n## Emoção principal do sonho: ${emotionLabel(envelope.mainEmotion)}`);
    if (envelope.secondaryEmotion) {
      lines.push(`## Emoção secundária: ${emotionLabel(envelope.secondaryEmotion)}`);
    }

    if (envelope.recurrence?.length) {
      lines.push('\n## Símbolos que já apareceram em sonhos anteriores');
      for (const r of envelope.recurrence) {
        lines.push(`- ${r.symbol}: em ${r.previousDreams} sonho(s) anterior(es)`);
      }
    }

    if (envelope.eventToday?.trim()) {
      lines.push(`\n## Compromisso importante do sonhador hoje: ${envelope.eventToday.trim()}`);
    }

    if (envelope.anamnesis?.length) {
      lines.push('\n## Ficha anamnéstica (contexto — não citar)');
      for (const qa of envelope.anamnesis) {
        lines.push(`- ${qa.question} → ${qa.answer}`);
      }
    }

    if (envelope.recentMovements?.length) {
      lines.push(`\n## Movimentos dos últimos sonhos: ${envelope.recentMovements.join(' · ')}`);
    }

    lines.push('\nEscreva agora a decodificação seguindo as regras.');
    return lines.join('\n');
  }

  /** Fallback local no mesmo formato do relatório, para quando a IA não responde. */
  generateInsightLocal(envelope: InsightEnvelope): GeneratedInsight {
    const main = EMOTION_MAP.get(envelope.mainEmotion) ?? EMOTIONS[0];
    const secondary = envelope.secondaryEmotion ? EMOTION_MAP.get(envelope.secondaryEmotion) : null;
    const meanings = envelope.elements
      .filter((e) => e.emotionKey && e.meaning)
      .map((e) => e.meaning!.toLowerCase())
      .slice(0, 3);

    const s1 = meanings.length
      ? `Seu sonho carrega sobretudo ${main.label.toLowerCase()}: o que ele trouxe — ${this.joinNice(meanings)} — aponta para um momento de ${main.movement.toLowerCase()}.`
      : `Seu sonho carrega sobretudo ${main.label.toLowerCase()}, num movimento de ${main.movement.toLowerCase()}.`;
    const recurring = envelope.recurrence?.[0];
    const s2 = recurring
      ? ` ${recurring.symbol} volta a aparecer, como algo que o seu inconsciente insiste em mostrar.`
      : secondary
        ? ` No fundo, ${secondary.label.toLowerCase()} acompanha o que você sentiu.`
        : '';

    const event = envelope.eventToday?.trim();
    const finalMessage = event
      ? `${main.closing} Com ${event.toLowerCase()} hoje, leve essa leitura com leveza.`
      : main.closing;

    return {
      movement: main.movement,
      emotionalState: secondary
        ? `${main.label} com ${secondary.label.toLowerCase()} ao fundo`
        : `${main.label} em primeiro plano`,
      message: `${s1}${s2}`,
      finalMessage,
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
