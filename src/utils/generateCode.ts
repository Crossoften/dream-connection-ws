import { randomInt } from 'crypto';

/** Código numérico de 6 dígitos, de fonte criptográfica. */
export default function generateCode(): string {
  return randomInt(0, 1_000_000).toString().padStart(6, '0');
}
