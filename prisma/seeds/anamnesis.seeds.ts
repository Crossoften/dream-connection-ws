import { PrismaClient, QuestionKind } from '@prisma/client';

/**
 * Banco da ficha anamnéstica — servido em blocos de 5: a abertura no primeiro
 * acesso e mais 5 a cada 5 sonhos decodificados.
 *
 * PROVISÓRIO: a lista oficial do idealizador (~50 perguntas, citada na reunião
 * de 30/06/2026) ainda não chegou à equipe. Estas perguntas vêm do que ele
 * disse nas reuniões — "seu nome, você é casado, é solteiro… você gosta de
 * viajar? … você tem pai? … seus pais vivem juntos? … quando se separaram?
 * … se gosta de altura… se gosta de festa" (19/06 e 30/06). Quando a lista
 * oficial chegar, basta substituir QUESTIONS e rodar o seed: a sincronização
 * é por texto da pergunta, preserva as respostas já dadas e desativa (sem
 * apagar) o que sair da lista.
 *
 * `dependsOn` + `whenAnswer`: a pergunta só aparece quando a pergunta-mãe foi
 * respondida com aquele valor (comparação sem acento e sem caixa).
 */
interface BankQuestion {
  prompt: string;
  kind: QuestionKind;
  category: string;
  options?: string[];
  dependsOn?: string;
  whenAnswer?: string;
}

const QUESTIONS: BankQuestion[] = [
  // Abertura
  {
    prompt: 'Qual é o seu estado civil?',
    kind: 'Choice',
    options: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Separado(a) ou divorciado(a)', 'Viúvo(a)'],
    category: 'afetivo',
  },

  // Família e origens
  { prompt: 'Seu pai está presente na sua vida?', kind: 'YesNo', category: 'familia' },
  { prompt: 'Sua mãe está presente na sua vida?', kind: 'YesNo', category: 'familia' },
  { prompt: 'Seus pais viveram juntos durante a sua infância?', kind: 'YesNo', category: 'familia' },
  {
    prompt: 'Se seus pais se separaram, que idade você tinha?',
    kind: 'Text',
    category: 'familia',
    dependsOn: 'Seus pais viveram juntos durante a sua infância?',
    whenAnswer: 'Não',
  },
  { prompt: 'Como é (ou era) a sua relação com a sua mãe?', kind: 'Choice', options: ['Muito próxima', 'Boa', 'Distante', 'Conflituosa', 'Prefiro não dizer'], category: 'familia' },
  { prompt: 'Como é (ou era) a sua relação com o seu pai?', kind: 'Choice', options: ['Muito próxima', 'Boa', 'Distante', 'Conflituosa', 'Prefiro não dizer'], category: 'familia' },
  { prompt: 'Você tem irmãos? Como é a relação com eles?', kind: 'Text', category: 'familia' },
  { prompt: 'Você tem filhos?', kind: 'YesNo', category: 'familia' },

  // Infância e memórias
  { prompt: 'Como você descreveria a sua infância em uma palavra?', kind: 'Text', category: 'infancia' },
  { prompt: 'Existe alguma lembrança de infância que volta com frequência?', kind: 'Text', category: 'infancia' },
  { prompt: 'Você mudou muito de casa ou de cidade quando criança?', kind: 'YesNo', category: 'infancia' },

  // Vida afetiva
  { prompt: 'Você está em um relacionamento hoje?', kind: 'YesNo', category: 'afetivo' },
  { prompt: 'Como anda o seu coração ultimamente?', kind: 'Choice', options: ['Em paz', 'Apaixonado(a)', 'Saudade', 'Magoado(a)', 'Confuso(a)'], category: 'afetivo' },
  { prompt: 'Existe alguém com quem você gostaria de se reaproximar?', kind: 'Text', category: 'afetivo' },

  // Preferências e estilo de vida
  { prompt: 'Você gosta de viajar?', kind: 'YesNo', category: 'preferencias' },
  { prompt: 'Você gosta de festas e ambientes cheios?', kind: 'YesNo', category: 'preferencias' },
  { prompt: 'Você tem medo de altura?', kind: 'YesNo', category: 'preferencias' },
  { prompt: 'Você se sente melhor de dia ou de noite?', kind: 'Choice', options: ['De dia', 'De noite', 'Depende do dia'], category: 'preferencias' },
  { prompt: 'Você torce para algum time? Qual?', kind: 'Text', category: 'preferencias' },
  { prompt: 'Você tem algum animal de estimação?', kind: 'Text', category: 'preferencias' },

  // Corpo e rotina
  { prompt: 'Como anda o seu sono?', kind: 'Choice', options: ['Durmo bem', 'Acordo cansado(a)', 'Tenho insônia', 'Muito irregular'], category: 'rotina' },
  { prompt: 'Você costuma lembrar dos seus sonhos ao acordar?', kind: 'Choice', options: ['Quase sempre', 'Às vezes', 'Raramente'], category: 'rotina' },
  { prompt: 'O que costuma tirar a sua paz no dia a dia?', kind: 'Text', category: 'rotina' },

  // Espiritualidade e crenças
  { prompt: 'Você se considera uma pessoa espiritualizada?', kind: 'YesNo', category: 'espiritualidade' },
  { prompt: 'Você acredita que os sonhos trazem mensagens?', kind: 'Choice', options: ['Sim, sempre', 'Às vezes', 'Tenho curiosidade', 'Não sei dizer'], category: 'espiritualidade' },
  { prompt: 'Existe algo em que você deposita fé nos momentos difíceis?', kind: 'Text', category: 'espiritualidade' },

  // Sonhos recorrentes
  { prompt: 'Existe um sonho que se repete na sua vida? Conte um pouco.', kind: 'Text', category: 'sonhos' },
  { prompt: 'Você já sonhou com algo que depois aconteceu?', kind: 'YesNo', category: 'sonhos' },
  { prompt: 'Tem algum lugar que sempre aparece nos seus sonhos?', kind: 'Text', category: 'sonhos' },
  { prompt: 'Quando o sonho é ruim, o que você costuma sentir ao acordar?', kind: 'Choice', options: ['Medo', 'Ansiedade', 'Tristeza', 'Alívio ao perceber que era sonho', 'Curiosidade'], category: 'sonhos' },
];

/** Sincroniza o banco de perguntas com QUESTIONS (idempotente). */
export async function seedAnamnesis(prisma: PrismaClient) {
  const existing = await prisma.anamnesisQuestion.findMany();
  const byPrompt = new Map(existing.map((q) => [q.prompt, q]));
  const idByPrompt = new Map<string, number>();

  let created = 0;
  let updated = 0;

  for (const [index, q] of QUESTIONS.entries()) {
    const data = {
      kind: q.kind,
      options: q.options ?? undefined,
      category: q.category,
      sortOrder: index,
      active: true,
    };
    const current = byPrompt.get(q.prompt);
    if (current) {
      await prisma.anamnesisQuestion.update({ where: { id: current.id }, data });
      idByPrompt.set(q.prompt, current.id);
      updated++;
    } else {
      const row = await prisma.anamnesisQuestion.create({ data: { prompt: q.prompt, ...data } });
      idByPrompt.set(q.prompt, row.id);
      created++;
    }
  }

  for (const q of QUESTIONS) {
    const dependsOnId = q.dependsOn ? idByPrompt.get(q.dependsOn) : null;
    if (q.dependsOn && !dependsOnId) {
      throw new Error(`Pergunta-mãe não encontrada no banco: "${q.dependsOn}"`);
    }
    await prisma.anamnesisQuestion.update({
      where: { id: idByPrompt.get(q.prompt)! },
      data: { dependsOnId: dependsOnId ?? null, dependsOnAnswer: q.whenAnswer ?? null },
    });
  }

  const retired = await prisma.anamnesisQuestion.updateMany({
    where: { prompt: { notIn: QUESTIONS.map((q) => q.prompt) }, active: true },
    data: { active: false },
  });

  console.log(
    `Ficha anamnéstica sincronizada 🌱 — ${QUESTIONS.length} perguntas (${created} novas, ${updated} atualizadas, ${retired.count} desativadas).`,
  );
}
