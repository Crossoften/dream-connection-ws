/** Texto sem acento, sem espaços nas pontas e em caixa baixa, para comparar respostas. */
export default function normalizeText(value: string | null | undefined): string {
  return (value ?? '')
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .trim()
    .toLowerCase();
}
