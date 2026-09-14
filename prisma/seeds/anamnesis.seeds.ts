import { Prisma, PrismaClient, QuestionKind } from '@prisma/client';

/**
 * Ficha anamnéstica OFICIAL do idealizador: "APLICATIVO YOUDREAM — FICHA
 * ANAMNÉSTICA DO USUÁRIO" (Ficha_Anamnestica_YOUDREAM.docx, recebida em
 * 14/09/2026), nas 5 etapas e na ordem do documento. Substitui as 31 perguntas
 * provisórias que tinham saído das reuniões.
 *
 * Servida em blocos de 5: a abertura no primeiro acesso e mais 5 a cada 5
 * sonhos decodificados. A abertura, portanto, é o começo da Etapa 1.
 *
 * Adaptações do papel para o app, sempre mínimas:
 * - campos em branco com poucas respostas possíveis viram escolha (estado civil,
 *   escolaridade); os demais continuam texto livre;
 * - "Se sim, quantos?", "Qual?", "Quais?" viram perguntas de seguimento com o
 *   texto completo ("Quantos filhos você tem?"), porque a IA lê cada pergunta
 *   com a sua resposta, fora do formulário;
 * - as caixas de marcar ganham "Nenhuma dessas": no app, deixar em branco é
 *   pular, e a pergunta voltaria no bloco seguinte;
 * - as 3 linhas de "Diga 3 coisas que você tem medo" são uma resposta só.
 *
 * `dependsOn` + `whenAnswer`: pergunta de seguimento — só aparece quando a
 * pergunta-mãe foi respondida com aquele valor (comparação sem acento e sem
 * caixa), logo depois dela e sem gastar o saldo do bloco.
 *
 * Sincronização por texto da pergunta: preserva as respostas já dadas e
 * desativa (sem apagar) o que saiu da lista.
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
  // Etapa 1 — Dados pessoais e contexto familiar
  {
    prompt: 'Qual é o seu estado civil?',
    kind: 'Choice',
    options: ['Solteiro(a)', 'Casado(a)', 'União estável', 'Separado(a) ou divorciado(a)', 'Viúvo(a)'],
    category: 'pessoal',
  },
  {
    prompt: 'Qual é a sua escolaridade?',
    kind: 'Choice',
    options: ['Ensino fundamental', 'Ensino médio', 'Ensino superior', 'Pós-graduação'],
    category: 'pessoal',
  },
  { prompt: 'Qual é a sua profissão?', kind: 'Text', category: 'pessoal' },
  { prompt: 'Qual é a sua religião?', kind: 'Text', category: 'pessoal' },
  { prompt: 'Possui filhos?', kind: 'YesNo', category: 'familia' },
  {
    prompt: 'Quantos filhos você tem?',
    kind: 'Text',
    category: 'familia',
    dependsOn: 'Possui filhos?',
    whenAnswer: 'Sim',
  },
  { prompt: 'Está grávida?', kind: 'Choice', options: ['Sim', 'Não', 'Não se aplica'], category: 'pessoal' },
  { prompt: 'Seu pai é vivo?', kind: 'YesNo', category: 'familia' },
  { prompt: 'Sua mãe é viva?', kind: 'YesNo', category: 'familia' },
  {
    prompt: 'Como é o seu relacionamento com seus familiares?',
    kind: 'Choice',
    options: ['Excelente', 'Bom', 'Regular', 'Ruim'],
    category: 'familia',
  },

  // Etapa 2 — Saúde física, mental e histórico clínico
  {
    prompt: 'Já teve ou tem alguma dessas enfermidades ou condições?',
    kind: 'Multi',
    options: ['Asma', 'Sinusite', 'Rinite', 'Diabetes', 'Cefaleia', 'Desmaios', 'Insônia', 'Tontura', 'Epilepsia', 'Nenhuma dessas'],
    category: 'saude',
  },
  { prompt: 'Possui alguma outra doença?', kind: 'YesNo', category: 'saude' },
  {
    prompt: 'Qual outra doença você possui?',
    kind: 'Text',
    category: 'saude',
    dependsOn: 'Possui alguma outra doença?',
    whenAnswer: 'Sim',
  },
  {
    prompt: 'Alguém da família teve ou tem esta doença?',
    kind: 'YesNo',
    category: 'saude',
    dependsOn: 'Possui alguma outra doença?',
    whenAnswer: 'Sim',
  },
  {
    prompt: 'Usa bebida alcoólica?',
    kind: 'Choice',
    options: ['Não', 'Casualmente', 'Sempre'],
    category: 'saude',
  },
  { prompt: 'Fuma?', kind: 'YesNo', category: 'saude' },
  { prompt: 'Usa drogas?', kind: 'YesNo', category: 'saude' },
  {
    prompt: 'Quais drogas você usa?',
    kind: 'Text',
    category: 'saude',
    dependsOn: 'Usa drogas?',
    whenAnswer: 'Sim',
  },
  { prompt: 'Usa medicamentos antidepressivos ou relaxantes?', kind: 'YesNo', category: 'saude' },
  { prompt: 'Já fez terapia com psicólogo ou psiquiatra?', kind: 'YesNo', category: 'saude' },
  {
    prompt: 'Considera que a terapia foi uma boa experiência?',
    kind: 'YesNo',
    category: 'saude',
    dependsOn: 'Já fez terapia com psicólogo ou psiquiatra?',
    whenAnswer: 'Sim',
  },
  {
    prompt: 'O que você faz ou sente quando está estressado(a) ou ansioso(a)?',
    kind: 'Multi',
    options: ['Grita', 'Chora', 'Treme', 'Tem desarranjo intestinal', 'Tem dores de estômago', 'Suor excessivo', 'Nenhuma dessas'],
    category: 'saude',
  },

  // Etapa 3 — Rotina, estilo de vida e comportamento
  {
    prompt: 'Pratica exercícios físicos?',
    kind: 'Choice',
    options: ['Musculação', 'Aeróbica', 'Caminhada', 'Não pratico'],
    category: 'rotina',
  },
  {
    prompt: 'Como é o seu humor logo de manhã?',
    kind: 'Choice',
    options: ['Bom', 'Estressado(a)', 'Calado(a)'],
    category: 'rotina',
  },
  {
    prompt: 'Como considera a sua vida sexual?',
    kind: 'Choice',
    options: ['Muito ativa', 'Média', 'Pouco ativa'],
    category: 'afetivo',
  },
  {
    prompt: 'Falar sobre sexo te traz quais sentimentos?',
    kind: 'Choice',
    options: ['Alegrias', 'Satisfação', 'Mágoas', 'Intrigas'],
    category: 'afetivo',
  },
  {
    prompt: 'Seus dias costumam ser rotineiros?',
    kind: 'Choice',
    options: ['Sim', 'Não', 'Mais ou menos'],
    category: 'rotina',
  },
  {
    prompt: 'Sua situação financeira está sob controle?',
    kind: 'Choice',
    options: ['Sim', 'Não', 'Mais ou menos'],
    category: 'rotina',
  },
  { prompt: 'Viaja muito?', kind: 'YesNo', category: 'rotina' },
  {
    prompt: 'Qual tipo de veículo usa para suas viagens?',
    kind: 'Choice',
    options: ['Carro', 'Avião', 'Ônibus', 'Outros'],
    category: 'rotina',
  },
  {
    prompt: 'Qual outro veículo você usa para suas viagens?',
    kind: 'Text',
    category: 'rotina',
    dependsOn: 'Qual tipo de veículo usa para suas viagens?',
    whenAnswer: 'Outros',
  },
  {
    prompt: 'O que mais te faz lembrar do passado?',
    kind: 'Choice',
    options: ['Quando olha no espelho', 'Quando vai ao hospital', 'Notícias de esporte'],
    category: 'rotina',
  },

  // Etapa 4 — Preferências, lazer e repertório simbólico
  {
    prompt: 'Qual é o seu passatempo predileto?',
    kind: 'Choice',
    options: ['Música', 'Esporte', 'Jogos de computador', 'Leitura'],
    category: 'preferencias',
  },
  { prompt: 'Qual o seu tipo de leitura preferida?', kind: 'Text', category: 'preferencias' },
  { prompt: 'Qual programa de TV você mais gosta?', kind: 'Text', category: 'preferencias' },
  { prompt: 'Qual o seu aroma predileto?', kind: 'Text', category: 'preferencias' },
  {
    prompt: 'Qual tipo de filme você mais gosta?',
    kind: 'Choice',
    options: ['Romance', 'Aventura', 'Ficção', 'Drama', 'Terror', 'Época', 'Comédia'],
    category: 'preferencias',
  },
  {
    prompt: 'Que estilo de música prefere?',
    kind: 'Choice',
    options: ['Rock', 'Romântica', 'Balada', 'Hip Hop', 'Break', 'Popular'],
    category: 'preferencias',
  },
  {
    prompt: 'Qual lugar prefere para descansar?',
    kind: 'Choice',
    options: ['Praia', 'Campo', 'Montanha'],
    category: 'preferencias',
  },
  { prompt: 'Qual a sua cor predileta?', kind: 'Text', category: 'simbolos' },
  {
    prompt: 'Que sensação a sua cor predileta te traz?',
    kind: 'Choice',
    options: ['Alegria', 'Bem-estar', 'Tranquilidade'],
    category: 'simbolos',
  },
  { prompt: 'Qual cor te lembra traição?', kind: 'Text', category: 'simbolos' },
  { prompt: 'Qual cor te lembra sucesso?', kind: 'Text', category: 'simbolos' },
  { prompt: 'Qual cor te lembra amor?', kind: 'Text', category: 'simbolos' },
  { prompt: 'Qual cor te lembra confiança?', kind: 'Text', category: 'simbolos' },

  // Etapa 5 — Psicologia dos sonhos e medos
  { prompt: 'Diga 3 coisas de que você tem medo.', kind: 'Text', category: 'sonhos' },
  {
    prompt: 'Você acredita que os sonhos te trazem alguma mensagem?',
    kind: 'Choice',
    options: ['Sim', 'Não', 'Às vezes'],
    category: 'sonhos',
  },
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
      // Pergunta que deixou de ser escolha perde as opções antigas.
      options: q.options ?? Prisma.DbNull,
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
    const parent = q.dependsOn ? QUESTIONS.find((p) => p.prompt === q.dependsOn) : null;
    if (parent?.options && q.whenAnswer && !parent.options.includes(q.whenAnswer)) {
      throw new Error(`"${q.whenAnswer}" não é opção de "${q.dependsOn}"`);
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
