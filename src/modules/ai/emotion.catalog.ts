import { EmotionKey } from '@prisma/client';

export interface EmotionInfo {
  key: EmotionKey;
  label: string;
  color: string;
  /// "Movimento" interno associado à emoção — usado como fallback e como
  /// vocabulário de referência para a IA.
  movement: string;
  /// Fechamento acolhedor usado no fallback local (sem IA).
  closing: string;
}

export const EMOTIONS: EmotionInfo[] = [
  { key: 'Alegria', label: 'Alegria', color: '#F2C14E', movement: 'Celebração de algo', closing: 'Guarde essa leveza e leve um pouco dela para o seu dia.' },
  { key: 'Amor', label: 'Amor', color: '#FF7AA2', movement: 'Resolução afetiva', closing: 'Permita-se um gesto de carinho hoje — ele será bem recebido.' },
  { key: 'Medo', label: 'Medo', color: '#7B6CF6', movement: 'Encontro com um limite', closing: 'O que assusta também aponta o que importa. Vá com calma.' },
  { key: 'Raiva', label: 'Raiva', color: '#FF6B5E', movement: 'Pedido por mudança', closing: 'Há um pedido legítimo por trás disso. Escute-o com gentileza.' },
  { key: 'Tristeza', label: 'Tristeza', color: '#5B8DEF', movement: 'Despedida silenciosa', closing: 'Acolha o que passou sem pressa de virar a página.' },
  { key: 'Confianca', label: 'Confiança', color: '#3FC8B4', movement: 'Busca por segurança', closing: 'Confie no terreno que você já construiu; ele te sustenta.' },
  { key: 'Esperanca', label: 'Esperança', color: '#6FD08C', movement: 'Abertura para o novo', closing: 'Algo novo pede espaço. Dê um pequeno passo nessa direção.' },
  { key: 'Ansiedade', label: 'Ansiedade', color: '#FFA64D', movement: 'Travessia de um receio', closing: 'Respire fundo: nem tudo precisa de resposta agora.' },
  { key: 'Culpa', label: 'Culpa', color: '#9AA0C2', movement: 'Necessidade de reparo', closing: 'Talvez seja hora de um pequeno reparo — ou de um perdão.' },
  { key: 'Vergonha', label: 'Vergonha', color: '#C98BB9', movement: 'Reencontro com a vulnerabilidade', closing: 'Você merece o mesmo cuidado que oferece aos outros.' },
  { key: 'Orgulho', label: 'Orgulho', color: '#B36CE0', movement: 'Reconhecimento de si', closing: 'Reconheça o seu valor sem precisar de plateia.' },
  { key: 'Surpresa', label: 'Surpresa', color: '#4FD0E0', movement: 'Revelação inesperada', closing: 'Fique atento aos sinais; algo quer ser notado.' },
];

export const EMOTION_MAP = new Map(EMOTIONS.map((e) => [e.key, e]));

export const emotionLabel = (key: EmotionKey): string => EMOTION_MAP.get(key)?.label ?? key;

export const STOPWORDS = new Set(
  (
    'a o e de da do das dos em no na nos nas um uma uns umas que se com por para pelo pela ' +
    'como mas mais menos muito pouco já não sim ao aos à às minha meu meus minhas sua seu suas seus ' +
    'ele ela eles elas eu tu nós vós você vocês isso isto aquilo este esta esse essa aquele aquela ' +
    'tinha havia estava estavam era foram ser estar ter haver onde quando entao então depois antes ' +
    'ainda também só apenas bem meio cada todo toda todos todas algum alguma uns dele dela deles delas ' +
    'num numa pelo pela sobre sem sob até desde entre cima baixo lado dentro fora'
  ).split(/\s+/),
);
