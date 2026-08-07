import { PrismaClient, QuestionKind } from '@prisma/client';

/**
 * Banco inicial da anamnese contínua ("de cinco em cinco").
 * Perguntas curtas, servidas aos poucos ao longo dos dias, para a IA
 * conhecer o sonhador sem cansá-lo — conforme metodologia do idealizador.
 */
const QUESTIONS: { prompt: string; kind: QuestionKind; options?: string[]; category: string }[] = [
  // Família e origens
  { prompt: 'Seu pai está presente na sua vida?', kind: 'YesNo', category: 'familia' },
  { prompt: 'Sua mãe está presente na sua vida?', kind: 'YesNo', category: 'familia' },
  { prompt: 'Seus pais viveram juntos durante a sua infância?', kind: 'YesNo', category: 'familia' },
  { prompt: 'Se seus pais se separaram, que idade você tinha?', kind: 'Text', category: 'familia' },
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

export async function seedAnamnesis(prisma: PrismaClient) {
  const count = await prisma.anamnesisQuestion.count();
  if (count > 0) {
    console.log('Anamnesis questions already seeded, skipping.');
    return;
  }

  await prisma.anamnesisQuestion.createMany({
    data: QUESTIONS.map((q, index) => ({
      prompt: q.prompt,
      kind: q.kind,
      options: q.options ?? undefined,
      category: q.category,
      sortOrder: index,
      active: true,
    })),
  });

  console.log('Anamnesis questions seed added successfully 🌱.');
}
